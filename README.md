# DDRE War Room — Conversation Intelligence

A real estate conversation intelligence platform. Ingests WhatsApp messages from the luxury North London property market, classifies them into actionable signals (buyer searches, tenant searches, property listings), matches complementary signals, and alerts agents in real time.

## Stack

- **Client** — React 19 + Vite + Tailwind v4 + shadcn/ui + TanStack Query + wouter
- **Server** — Express + TypeScript (ESM, strict mode)
- **Database** — PostgreSQL 14+
- **Job queue** — pg-boss (PostgreSQL-backed, no Redis)
- **Realtime** — WebSocket (`ws`)
- **AI classification** — Hybrid rules engine + Anthropic Claude Haiku
- **WhatsApp** — `whatsapp-web.js` (unofficial, for group monitoring) + Meta Cloud API webhook (for 1-to-1)

## Prerequisites

- Node.js **20+**
- **pnpm 10** (the project pins pnpm 10.4.1 via `packageManager`; enable with `corepack enable`)
- PostgreSQL **14+** running locally or accessible via `DATABASE_URL`

## Quick start

```bash
# 1. Install dependencies
corepack enable
corepack pnpm install

# 2. Copy env template and fill in what you need
cp .env.example .env

# 3. Create the database (if not already created)
createdb ddre_warroom

# 4. Run migrations
pnpm db:migrate

# 5. (Optional) Seed with sample data
pnpm db:seed
pnpm db:seed-messages

# 6. Start the dev environment (frontend + backend)
# Run each in its own terminal:
pnpm dev          # Vite on http://localhost:3000 (frontend)
pnpm dev:server   # Express on http://localhost:3001 (backend)
```

Open <http://localhost:3000> and sign in via magic link. Check the backend terminal for the magic link URL in dev mode (or configure `RESEND_API_KEY` for real email delivery).

### Seeded test accounts

Running `pnpm db:seed` creates the following accounts (idempotent — safe to re-run, won't duplicate):

| Email | Role | Coverage areas |
|---|---|---|
| `admin@test.com` | admin | Hampstead, Highgate, Belsize Park, Primrose Hill, Muswell Hill, Crouch End |
| `agent@test.com` | agent | Hampstead, Belsize Park |

Sign in with either email — the magic link is printed to the backend terminal in dev mode. Use the **admin** account to access admin-only pages (Admin log, WhatsApp Log out / Restart buttons, monitored groups CRUD). Use the **agent** account to test the default agent experience.

Coverage areas control which alerts the agent receives — a match only triggers an alert if the match's locations overlap with the agent's `coverage_areas`. The admin test account covers more areas so most seeded test messages will trigger alerts for it.

## Environment variables

Copy `.env.example` to `.env`. Required variables marked with **required**; everything else has a default or is optional until you need the feature.

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/ddre_warroom` | **Required.** Postgres connection string. |
| `PORT` | `3001` | Backend port (frontend proxies `/api` to this). |
| `CORS_ORIGIN` | `http://localhost:3000` | Frontend origin for CORS. |
| `SESSION_SECRET` | `change-me-to-a-random-string` | **Required in production.** Any long random string. |
| `MAGIC_LINK_BASE_URL` | `http://localhost:3000` | Where magic links point (the frontend). |
| `RESEND_API_KEY` | (empty) | If empty, emails log to the backend terminal instead of sending. |
| `EMAIL_FROM` | `noreply@ddre.com` | From address on outbound email. |
| `ANTHROPIC_API_KEY` | (empty) | If empty, only the rules engine runs. LLM fallback is disabled. |
| `WHATSAPP_WEB_ENABLED` | `false` | Set `true` to enable wwebjs group monitoring. |
| `WHATSAPP_WEB_SESSION_PATH` | `./whatsapp-session` | Where the wwebjs session is persisted. |
| `WHATSAPP_WEB_GROUP_ALLOWLIST` | (empty) | Env-based group filter. Empty means monitor all. Per-group config now lives in the DB. |
| `WHATSAPP_VERIFY_TOKEN` | — | Meta Cloud API webhook verify token. |
| `WHATSAPP_APP_SECRET` | — | Meta app secret for webhook signature validation. |
| `WHATSAPP_ACCESS_TOKEN` | — | Meta WhatsApp Business access token (temporary or permanent). |
| `WHATSAPP_PHONE_NUMBER_ID` | — | Meta-issued phone number ID. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | — | Web Push (Phase 4, not wired to UI yet). |

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start Vite frontend on :3000 |
| `pnpm dev:server` | Start Express backend + workers on :3001 with `--watch` |
| `pnpm build` | Build frontend (Vite) + backend (esbuild) to `dist/` |
| `pnpm start` | Run the production build |
| `pnpm check` | Type check (`tsc --noEmit`) |
| `pnpm format` | Prettier on the repo |
| `pnpm db:migrate` | Apply pending SQL migrations from `server/db/migrations/` |
| `pnpm db:seed` | Seed agents + sample signals |
| `pnpm db:seed-messages` | Seed sample raw WhatsApp messages (triggers the classification pipeline) |
| `pnpm db:refresh` | Drop + recreate schema, then re-seed (dev only — destroys data) |
| `pnpm test` | Run Vitest (currently 0 tests, `--passWithNoTests`) |

## WhatsApp integration

Two independent paths can run at the same time — both feed the same ingestion pipeline.

### 1. `whatsapp-web.js` (recommended for group monitoring)

Unofficial library. Uses a real WhatsApp account linked via QR code. Can join groups natively.

**Setup:**
1. Use a **burner SIM** for the linked account (never a production business number — there's some ban risk).
2. Set `WHATSAPP_WEB_ENABLED=true` in `.env`.
3. Start the backend (`pnpm dev:server`).
4. Open the **Live Feed** page in the app — a QR code appears in the WhatsApp Connection panel.
5. On the burner phone: **WhatsApp → Settings → Linked Devices → Link a Device → scan QR**.
6. The panel turns green ("LIVE"). Add the burner to any WhatsApp groups you want monitored.
7. Manage the per-group allowlist under **Monitored Groups** on the same page.

The session persists to `./whatsapp-session/` (gitignored). Restart the server and it reconnects automatically — no re-scan needed until you hit Log out or the phone goes offline >14 days.

Full evaluation and trade-offs: [`docs/WHATSAPP-WEB-JS-EVALUATION.md`](docs/WHATSAPP-WEB-JS-EVALUATION.md).

### 2. Meta WhatsApp Cloud API (for 1-to-1 messaging / webhooks)

Official, rate-limited, requires Meta business verification. Does **not** support group monitoring — that's why we also use wwebjs.

**Setup:**
1. Create a Meta app linked to a verified Meta Business Account.
2. Fill `WHATSAPP_*` env vars (verify token, app secret, access token, phone number ID).
3. Expose the backend publicly (ngrok works for dev): `ngrok http 3001`.
4. In the Meta dashboard → WhatsApp → Configuration → Webhook:
   - Callback URL: `https://<your-ngrok>.ngrok-free.app/api/webhooks/whatsapp`
   - Verify Token: whatever you put in `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to the **messages** field.
5. Messages sent to the registered phone number now flow into the pipeline.

Full proposal: [`docs/WHATSAPP-INTEGRATION-PROPOSAL.md`](docs/WHATSAPP-INTEGRATION-PROPOSAL.md).

## Project structure

```
client/src/              React SPA
├── api/                 API client wrappers (auth, agents, signals, whatsapp-web, ...)
├── components/          UI + feature components (DashboardLayout, live-feed/*, ui/*)
├── contexts/            Auth + WebSocket providers
├── hooks/               Query hooks, useAuth, useWhatsAppStatus, ...
└── pages/               Route components (Dashboard, LiveFeed, Alerts, Signals, ...)

server/                  Express backend (modular monolith)
├── app.ts               Route registration
├── index.ts             Startup (DB, workers, HTTP, WebSocket, wwebjs)
├── db/                  Connection, migrations, pg-boss, seeds
├── middleware/          requireAuth, requireAdmin, errorHandler
└── modules/
    ├── auth/            Magic link auth
    ├── agents/          Agent CRUD
    ├── ingestion/       Message intake + fingerprint dedup
    ├── classification/  Rules engine + LLM fallback + worker
    ├── matching/        Buyer↔sale / tenant↔rent scoring + worker
    ├── alerts/          Alert CRUD + delivery
    ├── signals/         Signal CRUD
    ├── analytics/       KPIs, distributions
    ├── audit/           Action log
    ├── notifications/   WebSocket server + email + daily digest
    ├── webhook/         Meta Cloud API webhook
    └── whatsapp-web/    wwebjs client + accounts + monitored groups CRUD

shared/                  Zod schemas + types shared between client and server
docs/                    Architecture / integration docs
```

## Further reading

- [`docs/DEVELOPER-REVIEW-REPORT.md`](docs/DEVELOPER-REVIEW-REPORT.md) — architecture summary + phase-by-phase build history
- [`docs/WHATSAPP-INTEGRATION-PROPOSAL.md`](docs/WHATSAPP-INTEGRATION-PROPOSAL.md) — Meta Cloud API integration plan
- [`docs/WHATSAPP-WEB-JS-EVALUATION.md`](docs/WHATSAPP-WEB-JS-EVALUATION.md) — wwebjs feasibility, setup, reconnection, risk assessment

## Troubleshooting

**`The browser is already running for ...\whatsapp-session\session`**
Chromium from a previous wwebjs run is still holding the session directory lock. Kill lingering `chrome.exe` processes in Task Manager and restart the server. The reconnect path now destroys the old client before starting a new one, so this should be rare.

**QR never appears in the Live Feed**
Check `WHATSAPP_WEB_ENABLED=true` in `.env` and watch the backend terminal for `[wwebjs] starting client`. If the backend crashed, check logs; if Chromium failed to launch (common on Linux), add `--no-sandbox` (already in defaults) or install missing deps for Puppeteer.

**Messages come in as "Unclassified"**
The rules engine didn't match and the LLM fallback failed (usually `ANTHROPIC_API_KEY` invalid or empty). Either set a valid key or rely on rule matches only.

**Magic link email never arrives**
`RESEND_API_KEY` is empty by default — in dev, magic links are logged to the backend terminal. Grep for `Magic link:` in the console.

**Matches / alerts never fire**
Matching only pairs *complementary* signals (Buyer Search ↔ Property for Sale, Tenant Search ↔ Property for Rent) in overlapping locations, and alerts only fire to agents whose `coverage_areas` overlap the match. Make sure the seeded agent has coverage areas that match your test messages.
