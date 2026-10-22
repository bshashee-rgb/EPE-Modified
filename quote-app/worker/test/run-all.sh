#!/usr/bin/env bash
# One-shot local verification harness for the Cloudflare Workers migration.
#
# Resets local D1 from a fresh snapshot of the live Express sqlite DB, boots
# Express (4781) and `wrangler dev` (8787) against that identical data, runs
# the three functional suites (parity, writes, admin-writes) in sequence, and
# always tears down exactly the two servers it started — regardless of
# outcome. Exits non-zero if the D1 reset, either server, or any suite fails.
#
# Usage: ./test/run-all.sh   (run from quote-app/worker)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # quote-app/worker/test
WORKER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"                    # quote-app/worker
APP_DIR="$(cd "$WORKER_DIR/.." && pwd)"                       # quote-app

EXPRESS_PORT=4781
WORKER_PORT=8787
# NEVER touch 4780 — that's the production Express port.

LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/epe-run-all.XXXXXX")"
EXPRESS_PID=""
WORKER_PID=""

log() { echo "[run-all] $*"; }

# ---------------------------------------------------------------------------
# Kill every process listening on a given port. Used (a) at start-of-run to
# clear stragglers from a previous crashed run, and (b) never for 4780.
# ---------------------------------------------------------------------------
kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    log "killing stragglers on port ${port}: ${pids}"
    kill -9 $pids 2>/dev/null || true
  fi
}

# ---------------------------------------------------------------------------
# Cleanup: kill only the PIDs (process groups) this script itself started.
# Runs on every exit path — success, suite failure, or early abort.
# ---------------------------------------------------------------------------
cleanup() {
  log "cleanup: stopping servers this run started"
  for pid in "$WORKER_PID" "$EXPRESS_PID"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  sleep 1
  for pid in "$WORKER_PID" "$EXPRESS_PID"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Poll a URL until it answers with ANY HTTP response (connection accepted +
# response received), or until timeout seconds elapse.
# ---------------------------------------------------------------------------
wait_for() {
  local url="$1" label="$2" timeout="${3:-60}"
  local waited=0 code
  while true; do
    log "waiting for ${label} at ${url} (attempt ${waited}/${timeout}s)..."
    # Under the script's `set -euo pipefail`, a plain `code="$(curl ...)"` with
    # no fallback aborts the ENTIRE script the first time curl exits non-zero
    # (e.g. exit 7, connection refused) — errexit fires on the assignment's
    # exit status, so the retry loop below would never get a chance to retry.
    # `|| true` neutralizes that. curl itself also writes "000" via -w on a
    # failed transfer, so the `${code:-000}` default only covers the rarer
    # case of curl producing no output at all. Do NOT `|| echo 000` instead —
    # that runs even when curl already printed "000" via -w, concatenating
    # into "000000" (!= "000"), which would falsely report the server "up".
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$url" 2>/dev/null || true)"
    code="${code:-000}"
    if [ "$code" != "000" ]; then
      log "${label} is up (HTTP ${code}) after ${waited}s"
      return 0
    fi
    waited=$((waited + 1))
    if [ "$waited" -ge "$timeout" ]; then
      log "TIMEOUT waiting for ${label} at ${url} after ${timeout}s"
      return 1
    fi
    sleep 1
  done
}

# ===========================================================================
# Step 0 — kill stragglers on 4781/8787 only (never 4780).
# ===========================================================================
log "=== Step 0: killing stragglers on ${EXPRESS_PORT}/${WORKER_PORT} ==="
kill_port "$EXPRESS_PORT"
kill_port "$WORKER_PORT"

# ===========================================================================
# Step 1 — reset local D1 from a fresh export of the live Express sqlite DB.
# ===========================================================================
log "=== Step 1: resetting local D1 ==="
cd "$WORKER_DIR"
rm -rf .wrangler/state
npx wrangler d1 execute epe-quote --local --file=./schema.sql
./export-data.sh
npx wrangler d1 execute epe-quote --local --file=./data.sql
npx wrangler d1 execute epe-quote --local --file=./auth-schema.sql
node seed-admin.mjs --email admin@test.local --name "Test Admin" --role admin --password 'test-admin-pw'
node seed-admin.mjs --email sales@test.local --name "Test Sales" --role sales --password 'test-sales-pw'

# ===========================================================================
# Step 2 — build the client (wrangler dev serves ../client/dist as assets).
# ===========================================================================
log "=== Step 2: building client ==="
npm run build --prefix ../client

# ===========================================================================
# Step 3 — start Express (4781) and wrangler dev (8787).
# `set -m` gives each background job its own process group so cleanup() can
# kill the whole tree (wrangler dev spawns a workerd child), not just the
# top-level PID.
# ===========================================================================
log "=== Step 3: starting Express (${EXPRESS_PORT}) and wrangler dev (${WORKER_PORT}) ==="
set -m

cd "$APP_DIR"
PORT="$EXPRESS_PORT" node server/index.js > "${LOG_DIR}/express.log" 2>&1 &
EXPRESS_PID=$!
log "Express started, pid ${EXPRESS_PID}, log: ${LOG_DIR}/express.log"

cd "$WORKER_DIR"
npx wrangler dev > "${LOG_DIR}/worker.log" 2>&1 &
WORKER_PID=$!
log "wrangler dev started, pid ${WORKER_PID}, log: ${LOG_DIR}/worker.log"

set +m

# ===========================================================================
# Step 4 — wait for both to be ready.
# The worker now has /api/ping (added for the auth-exempt health check), but
# we still poll /api/catalog here — a real DB-backed route that only succeeds
# once the D1 binding is live, so it doubles as proof the worker is actually
# ready to serve, not just that the TCP listener bound.
# ===========================================================================
log "=== Step 4: waiting for both servers ==="
if ! wait_for "http://localhost:${EXPRESS_PORT}/api/catalog" "Express (${EXPRESS_PORT})" 60; then
  echo "----- express.log -----"; cat "${LOG_DIR}/express.log" || true
  exit 1
fi
if ! wait_for "http://localhost:${WORKER_PORT}/api/catalog" "Worker (${WORKER_PORT})" 60; then
  echo "----- worker.log -----"; cat "${LOG_DIR}/worker.log" || true
  exit 1
fi

# ===========================================================================
# Step 5 — run the three suites in sequence, regardless of individual result.
# ===========================================================================
log "=== Step 5: running test suites ==="
cd "$WORKER_DIR"
set +e

# parity.mjs MUST run before auth.mjs: parity diffs the Worker's freshly-imported
# data against Express's, and auth.mjs's audit-actor-spoof check creates+deletes a
# quote against the Worker, which (by design, see index.js's DELETE /api/quotes/:id)
# leaves a permanent 'quote-deleted' row in the global audit log. Running auth first
# would make parity see a Worker audit_log one row ahead of Express's, which is a
# test-ordering bug, not a real parity break.
log "--- parity.mjs ---"
node test/parity.mjs
R_PARITY=$?

log "--- auth.mjs ---"
node test/auth.mjs
R_AUTH=$?

log "--- writes.mjs ---"
node test/writes.mjs
R_WRITES=$?

log "--- admin-writes.mjs ---"
node test/admin-writes.mjs
R_ADMIN=$?

log "--- clarifications.mjs ---"
node test/clarifications.mjs
R_CLARIF=$?

set -e

# ===========================================================================
# Step 6 — summary + exit code. cleanup() (trap EXIT) tears down the servers.
# ===========================================================================
pass_fail() { [ "$1" -eq 0 ] && echo PASS || echo FAIL; }

echo
log "==================== SUMMARY ===================="
log "auth.mjs:          $(pass_fail "$R_AUTH")"
log "parity.mjs:        $(pass_fail "$R_PARITY")"
log "writes.mjs:        $(pass_fail "$R_WRITES")"
log "admin-writes.mjs:  $(pass_fail "$R_ADMIN")"
log "clarifications.mjs: $(pass_fail "$R_CLARIF")"
log "==================================================="

if [ "$R_AUTH" -ne 0 ] || [ "$R_PARITY" -ne 0 ] || [ "$R_WRITES" -ne 0 ] || [ "$R_ADMIN" -ne 0 ] || [ "$R_CLARIF" -ne 0 ]; then
  log "run-all: FAILED"
  exit 1
fi

log "run-all: ALL GREEN"
exit 0
