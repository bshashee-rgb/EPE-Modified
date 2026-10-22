# quote-app/client/ — the React/Vite SPA

Scope: this file loads when you touch `quote-app/client/**`. Root guide: `../../CLAUDE.md`.
Deep reference (domain model, rule engine D1–D7, API surface): `../../docs/ARCHITECTURE.md`.
Full test methodology (incl. React `focusout` E2E pitfalls): `../TESTING.md`.

## What this is

React 18 + Vite SPA, hash router. No build framework beyond Vite, no CSS framework, no state
library, no TypeScript. Plain function components + hooks throughout — **match the surrounding
code**, don't introduce a new pattern for one feature.

- `src/App.jsx` — hash router, role switcher, Toaster, NotFound.
- `src/api.js` — fetch wrapper.
- `src/toast.js` — global toast bus.
- `src/styles.css` — all styles: hand-written CSS with the existing CSS-variable palette
  (`--accent #0b5cad` hydraulic blue, `--ok`/`--warn`/`--bad` semantics). Reuse these variables;
  don't hardcode new colors.
- `src/pages/` — Dashboard, Catalog, Configurator, QuoteDetail, Parts, Admin.
- `src/components/` — AddItemDrawer, CopyCode, CommitInput, CustomerHistoryPanel,
  ClarificationsPanel, etc.

## api.js contract

- Paths are **relative** (`/api/...`) — works unmodified against both the local Express proxy
  (port 4780) and the deployed Worker.
- Auto-toasts on any request error via the global toast bus. Pass `{quiet: true}` only when the
  calling form already renders its own inline error — never both, never neither (double- or
  zero-reporting a failure is a regression).

## CommitInput — commit on blur/Enter, never per-keystroke

Commercial inputs (qty, discount, GST, validity) use `CommitInput`. It commits on blur or Enter,
not on every keystroke. **Do not reintroduce `onChange` → PATCH** on these fields — that was
already tried and reverted; it thrashes the API and audit log on every character typed.

## Auth / legacy-mode contract

The client detects which backend it's talking to via `GET /api/auth/me`:

| Response | Meaning | Client behavior |
|---|---|---|
| `200` | Worker, session valid | signed-in app |
| `401` | Worker, no/expired session | show login screen |
| `404` | Express (legacy, no auth route) | legacy mode — keep the `X-Actor` role picker |

Don't collapse this three-way branch to a simple boolean — the `404` case is what keeps local
Express dev working without requiring a login flow.

## Build check

`npm run build --prefix .` after any client change — this is a required regression gate (see
`../TESTING.md` §7 Definition of Done), and the Worker serves this build output as static assets
in production.
