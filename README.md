# EPE Quote Builder

[![Live](https://img.shields.io/badge/status-live-brightgreen)](https://epe-quote.ramki-461.workers.dev)
[![Stack](https://img.shields.io/badge/stack-React%20%2B%20Hono%20%2B%20D1-0b5cad)]()

A Configure-Price-Quote (CPQ) web application built for **EPE Process Filters & Accumulators
Pvt. Ltd.**, a Hyderabad-based manufacturer of hydraulic and process filters and hydro-pneumatic
accumulators.

## 1. What it is

EPE sells engineered products through **positional ordering codes** — each product family (e.g.
filter series "LD", accumulator series "AS") has a fixed sequence of code positions, and each
position offers a set of options with dependency rules on one another (some options require or
exclude others, some are only valid in combination with a parent selection, some are regulatory
certifications with prerequisite chains).

This app lets:
- **Sales** staff configure a product step by step against those rules, see the resulting price
  and ordering code, and assemble line items into a customer quotation (PDF-ready, revisable,
  auditable).
- **Product Admins** maintain the *entire* catalogue — families, segments, options, dependency
  rules, prices, spare parts, categories — as data, through an admin UI. No code changes are
  needed to add a new product family or change a pricing rule.

## 2. Live app

**https://epe-quote.ramki-461.workers.dev**

Sign-in is required (temporary email/password auth — see [Status & roadmap](#8-status--roadmap)).
The production system of record is **Cloudflare D1**; there are no real customer quotations in
this repository, and no credentials or secrets are stored here.

## 3. Architecture at a glance

```
┌─────────────────┐      ┌──────────────────────┐      ┌───────────────┐
│  React (Vite)    │ ───▶ │  Hono Worker (API)    │ ───▶ │  Cloudflare   │
│  SPA client      │◀──── │  on Cloudflare Workers│◀──── │  D1 database  │
└─────────────────┘      └──────────────────────┘      └───────────────┘
                                    │
                          shared rule engine
                        (evaluate / price / render
                         ordering code — D1–D7 rules)
```

- **Client**: React 18 + Vite single-page app, hash-routed, hand-written CSS (no CSS framework).
- **API**: a [Hono](https://hono.dev) app running on Cloudflare Workers, backed by **D1**
  (Cloudflare's serverless SQLite) in production.
- **Rule engine**: one shared module evaluates the ordering-code dependency rules and pricing —
  used unchanged by both runtimes described below.
- **Two runtimes, one engine** — locally you run a plain **Express + better-sqlite3** server for
  fast iteration; production runs the **Hono + D1 Worker**. They share the same rule engine so
  configurator/pricing behavior is identical; only the server shell and database driver differ.

Full details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 4. Quickstart (local dev)

Requires Node ≥ 18.

```bash
# 1. Install dependencies
npm install --prefix quote-app/server
npm install --prefix quote-app/client

# 2. Start the API server (port 4780) — plain node, no auto-reload
npm run dev --prefix quote-app/server

# 3. In a second terminal, start the client (port 5178) — Vite, hot reload
npm run dev --prefix quote-app/client
```

Open **http://localhost:5178**. The client proxies `/api` calls to the local server on 4780.

**Run the worker locally** (Cloudflare's Workers runtime + local D1, mirrors production):

```bash
cd quote-app/worker
npm install
npx wrangler dev   # http://localhost:8787
```

**Run the test suite** (parity, writes, admin-writes — the same gate CI runs on every PR):

```bash
cd quote-app/worker && ./test/run-all.sh
```

## 5. Deploy & releases

- Branch model: `feature/*` → `develop` (staging) → `main` (production).
- Merging to `main` does **not** deploy by itself — a deploy is triggered by pushing a `v*` git
  tag (e.g. `git tag -a v1.1.0 -m "…" && git push origin v1.1.0`).
- Tagging runs `wrangler deploy` via GitHub Actions; it ships code + built client assets only —
  it never touches production data or runs migrations.
- Only cut a tag from a green (CI-passing) `main`.

Full workflow, environments, secrets, and rollback steps: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## 6. Repo layout

```
EPE/
├── quote-app/                  # the runnable application
│   ├── client/                 # React (Vite) SPA
│   ├── server/                 # local Express + better-sqlite3 dev server (shared rule engine)
│   └── worker/                 # Cloudflare Worker (Hono + D1) — production API
├── Quote-App-Requirements/      # the PRD and per-category spec-hierarchy appendices
├── Filters/  Accumulators/      # source datasheets (PDFs) for the filter & accumulator families
├── Switches/  Valves/           # source datasheets (PDFs) for the switch & valve families
├── docs/                        # architecture, deployment & operational reference docs
└── .github/                     # CI/CD workflows (build, test, deploy)
```

## 7. Docs index

| Doc | What's in it |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Domain model, the ordering-code rule engine, API surface, data model |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Environments, CI/CD workflows, release/tag flow, secrets, rollback |
| [`quote-app/TESTING.md`](quote-app/TESTING.md) | Test layers, conventions, checklists, definition-of-done gate |
| [`Quote-App-Requirements/`](Quote-App-Requirements/) | Product requirements document (PRD) and spec-hierarchy appendices |

> **AI agents:** start at [`CLAUDE.md`](CLAUDE.md) instead of this file.

## 8. Status & roadmap

**Deployed and live.** The full configurator, quoting lifecycle (create/revise/clone/archive),
admin catalogue authoring, and data-safety layer are built, tested, and running in production on
Cloudflare Workers + D1, currently behind a temporary email/password login.

**Next up:** replacing the temporary auth with **Zoho OAuth** sign-in, followed by role-based
access control, pricing operations (multiple price lists, effective dates), and discount
governance workflows.
