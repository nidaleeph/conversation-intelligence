# DDRE War Room — Production Architecture Design Spec

**Date:** 2026-04-06
**Status:** Approved
**Scope:** Full production rewrite of the DDRE War Room conversation intelligence platform

---

## 1. Overview

The DDRE War Room is a real estate conversation intelligence platform that monitors WhatsApp group conversations in the North London luxury property market, classifies messages into actionable signals (buyer searches, tenant searches, property listings, etc.), matches complementary signals, and alerts agents in real time.

**Current state:** Frontend-only SPA with hardcoded mock data, no backend API, no database, no authentication.

**Target state:** Production-ready modular monolith with real-time ingestion, hybrid AI classification, signal matching, multi-channel notifications, and proper auth.

---

## 2. Architecture Decision: Modular Monolith

Single Node.js/Express server with internally separated modules. One PostgreSQL database. pg-boss for job queuing (PostgreSQL-backed, no Redis needed).

**Why this over microservices:** Faster to build, simpler to deploy, sufficient for target scale (thousands of messages/day). Modules have clean boundaries and can be extracted later if needed.

**Why this over serverless:** WebSocket support is essential for real-time features. Serverless makes that awkward. Local development is simpler with a single server.

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                 │
│         existing UI → connect to real API endpoints      │
└──────────────────────────┬──────────────────────────────┘
                           │ REST + WebSocket
┌──────────────────────────┴──────────────────────────────┐
│                   Express API Server                     │
│                                                          │
│  ┌──────────┐ ┌──────────────┐ ┌───────────────────┐   │
│  │   Auth    │ │   Signals    │ │   Agents          │   │
│  │  Module   │ │   Module     │ │   Module          │   │
│  └──────────┘ └──────────────┘ └───────────────────┘   │
│  ┌──────────┐ ┌──────────────┐ ┌───────────────────┐   │
│  │Ingestion │ │Classification│ │  Notifications     │   │
│  │  Module   │ │   Module     │ │   Module          │   │
│  └──────────┘ └──────────────┘ └───────────────────┘   │
│  ┌──────────┐ ┌──────────────┐                          │
│  │  Alerts  │ │  Matching    │                          │
│  │  Module   │ │   Engine     │                          │
│  └──────────┘ └──────────────┘                          │
│                                                          │
│              pg-boss (job queue)                         │
└──────────────────────────┬──────────────────────────────┘
                           │
                  ┌────────┴────────┐
                  │   PostgreSQL    │
                  └─────────────────┘
```

### Message Processing Flow

1. Messages arrive (source TBD) → **Ingestion Module**
2. Ingestion deduplicates (fingerprint check) and queues a classification job via **pg-boss**
3. **Classification Module** picks up the job → rules-based check first, Claude API for ambiguous ones
4. Classified signal stored → **Signals Module**
5. **Matching Engine** checks for buyer ↔ listing matches
6. **Alerts Module** generates alerts for relevant agents
7. **Notifications Module** delivers via in-app (WebSocket), WhatsApp, email, push
8. Everything logged in **audit_log**

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind v4, shadcn/ui, wouter |
| Data fetching | TanStack Query (React Query) |
| Real-time | WebSocket via `ws` library |
| Backend | Express.js, TypeScript |
| Database | PostgreSQL |
| Job queue | pg-boss (PostgreSQL-backed) |
| AI classification | Claude Haiku (via Anthropic SDK) + rules engine |
| Email | Resend or SendGrid |
| Push | Web Push API + `web-push` npm package |
| WhatsApp outbound | Stub interface (provider TBD) |
| Validation | Zod (shared schemas frontend + backend) |
| Migrations | Node-pg-migrate or similar |

---

## 4. Server Directory Structure

```
server/
├── index.ts              # Express app bootstrap, WebSocket setup
├── modules/
│   ├── auth/             # Magic link auth, sessions, middleware
│   ├── ingestion/        # Message intake, deduplication, queueing
│   ├── classification/   # Rules engine + Claude API fallback
│   ├── signals/          # CRUD, search, filtering
│   ├── alerts/           # Alert generation, delivery tracking
│   ├── agents/           # Agent profiles, coverage areas, preferences
│   ├── matching/         # Buyer ↔ listing signal matching
│   └── notifications/    # WebSocket, email, WhatsApp, push delivery
├── db/
│   ├── connection.ts     # PostgreSQL connection pool
│   └── migrations/       # Schema migrations
├── middleware/            # Auth guards, rate limiting, error handling
└── utils/                # Server-only utilities
```

---

## 5. Frontend Architecture

### Current Problems
- All data hardcoded in `lib/data.ts` — no API calls
- No real state management — scattered useState
- No loading/error states for async data
- No auth flow
- No WebSocket for real-time updates
- `/alerts`, `/signals`, `/areas`, `/settings` routes are stubs rendering Dashboard

### Restructured Frontend

```
client/src/
├── api/                    # API layer — all backend calls
│   ├── client.ts           # Axios instance, auth headers, error interceptors
│   ├── auth.ts             # login, verifyMagicLink, logout, getSession
│   ├── signals.ts          # getSignals, getSignalById, reviewSignal
│   ├── agents.ts           # getAgents, getAgentProfile, updatePreferences
│   ├── alerts.ts           # getAlerts, markRead, dismissAlert
│   ├── messages.ts         # getRawMessages, getMessageStats
│   ├── matching.ts         # getMatches, confirmMatch, dismissMatch
│   └── analytics.ts        # getDashboardStats, getAreaHeatmap, getTrends
├── hooks/
│   ├── queries/            # TanStack Query hooks — data fetching + caching
│   │   ├── useSignals.ts
│   │   ├── useAgents.ts
│   │   ├── useAlerts.ts
│   │   ├── useMessages.ts
│   │   ├── useMatches.ts
│   │   └── useAnalytics.ts
│   ├── useWebSocket.ts     # Real-time connection
│   ├── useAuth.ts          # Auth state, login/logout, session check
│   └── (existing hooks)
├── contexts/
│   ├── ThemeContext.tsx     # (existing)
│   ├── AuthContext.tsx      # Current user, permissions, session
│   └── WebSocketContext.tsx # Shared WS connection
├── pages/
│   ├── Dashboard.tsx        # Real KPI data from useAnalytics
│   ├── Parser.tsx           # Real messages, review actions hit API
│   ├── LiveFeed.tsx         # WebSocket-driven, not simulated
│   ├── Agents.tsx           # Real agent list
│   ├── AgentProfile.tsx     # Real agent data + their signals/alerts
│   ├── Alerts.tsx           # NEW — dedicated alerts page
│   ├── Signals.tsx          # NEW — dedicated signals browse/search
│   ├── Areas.tsx            # NEW — area heatmap + demand analysis
│   ├── Settings.tsx         # NEW — agent preferences, notification settings
│   ├── Login.tsx            # NEW — magic link request
│   ├── VerifyLogin.tsx      # NEW — magic link landing page
│   └── Admin.tsx            # NEW — agent management, invite agents
├── components/
│   ├── DashboardLayout.tsx  # (existing — add auth guard, active user display)
│   ├── ErrorBoundary.tsx    # (existing)
│   ├── ProtectedRoute.tsx   # NEW — redirects to login if not authenticated
│   ├── RealTimeIndicator.tsx# NEW — shows WS connection status
│   └── ui/                  # (existing shadcn components)
└── lib/
    ├── utils.ts             # (existing)
    ├── types.ts             # NEW — moved from data.ts, shared via @shared
    └── constants.ts         # Signal type colors, status labels
```

### Key Frontend Changes
1. **TanStack Query** for all data fetching — caching, refetching, loading/error states, pagination
2. **API layer** (`api/`) — Axios instance with auth token injection, 401 → redirect to login
3. **WebSocket context** — single connection shared app-wide for real-time events
4. **Auth flow** — AuthContext wraps app, ProtectedRoute guards all pages except Login/VerifyLogin
5. **Shared types** — move interfaces to the existing top-level `shared/types.ts` (already aliased as `@shared/*`), kill `lib/data.ts` once API is connected
6. **Real pages** for Alerts, Signals, Areas, Settings (replacing Dashboard stubs)

---

## 6. Database Schema

### agents
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT NOT NULL | |
| email | TEXT UNIQUE NOT NULL | |
| role | TEXT | 'agent' or 'admin' |
| coverage_areas | TEXT[] | e.g. ['Hampstead', 'Highgate'] |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### sessions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| agent_id | UUID FK → agents | |
| token | TEXT UNIQUE | magic link token |
| expires_at | TIMESTAMPTZ | 15 min from creation |
| verified | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | |

### messages
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| source_group | TEXT | which WhatsApp group |
| sender_name | TEXT | |
| sender_phone | TEXT | for dedup + identity |
| raw_text | TEXT NOT NULL | |
| platform | TEXT | DEFAULT 'whatsapp' |
| received_at | TIMESTAMPTZ | |
| fingerprint | TEXT UNIQUE | hash for deduplication |
| classified | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | |

### signals
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| message_id | UUID FK → messages | |
| type | TEXT | 'Buyer Search', 'Tenant Search', etc. |
| classification_method | TEXT | 'rules' or 'llm' |
| confidence | DECIMAL(3,2) | 0.00 to 1.00 |
| location | TEXT[] | |
| postcodes | TEXT[] | |
| budget_min | INTEGER | GBP |
| budget_max | INTEGER | GBP |
| property_type | TEXT | 'House', 'Flat', etc. |
| bedrooms | INTEGER | |
| bathrooms | INTEGER | |
| sqft | INTEGER | |
| outside_space | BOOLEAN | |
| parking | BOOLEAN | |
| condition | TEXT | 'Any', 'Refurbished', 'New Build' |
| summary | TEXT | LLM-generated one-liner |
| status | TEXT | DEFAULT 'new' — new/reviewed/alerted/matched |
| reviewed_by | UUID FK → agents | null until reviewed |
| actionable | BOOLEAN | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### matches
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| signal_a_id | UUID FK → signals | e.g. buyer search |
| signal_b_id | UUID FK → signals | e.g. property listing |
| match_score | DECIMAL(3,2) | 0.00 to 1.00 |
| match_reasons | TEXT[] | e.g. ['area overlap', 'budget fit'] |
| status | TEXT | DEFAULT 'pending' — pending/confirmed/dismissed |
| confirmed_by | UUID FK → agents | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### alerts
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| agent_id | UUID FK → agents | recipient |
| signal_id | UUID FK → signals | what triggered it |
| match_id | UUID FK → matches | optional, if about a match |
| type | TEXT | 'new_signal', 'match_found', 'review_needed' |
| priority | TEXT | 'high', 'medium', 'low' |
| summary | TEXT | |
| read | BOOLEAN | DEFAULT false |
| read_at | TIMESTAMPTZ | |
| delivered_via | TEXT[] | ['in_app', 'email', 'whatsapp', 'push'] |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### notification_preferences
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| agent_id | UUID FK → agents UNIQUE | |
| in_app | BOOLEAN | DEFAULT true |
| email | BOOLEAN | DEFAULT true |
| whatsapp | BOOLEAN | DEFAULT false |
| push | BOOLEAN | DEFAULT false |
| signal_types | TEXT[] | which types to alert on (null = all) |
| min_priority | TEXT | DEFAULT 'low' |
| daily_digest | BOOLEAN | DEFAULT false — one summary email instead of individual alerts |
| updated_at | TIMESTAMPTZ | |

### push_subscriptions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| agent_id | UUID FK → agents | |
| endpoint | TEXT NOT NULL | Web Push endpoint URL |
| keys | JSONB NOT NULL | p256dh + auth keys |
| user_agent | TEXT | browser info |
| created_at | TIMESTAMPTZ | |

### audit_log
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| agent_id | UUID FK → agents | null for system actions |
| action | TEXT | e.g. 'signal_reviewed', 'alert_read' |
| entity_type | TEXT | 'signal', 'alert', 'match', 'agent' |
| entity_id | UUID | |
| metadata | JSONB | extra context |
| created_at | TIMESTAMPTZ | |

### Key Indexes
- `messages.fingerprint` — UNIQUE, deduplication lookups
- `signals.type` + `signals.status` — filtering on dashboard
- `signals.location` — GIN index for array containment queries (matching engine)
- `signals.created_at` — range queries for recency scoring
- `alerts.agent_id` + `alerts.read` — unread alert count per agent
- `audit_log.entity_type` + `audit_log.entity_id` — history lookups
- `audit_log.created_at` — time-range queries

---

## 7. Classification Engine

### Hybrid Pipeline

```
Message In → Deduplication (fingerprint) → Rules Engine (~70%) → Store signal
                                                    ↓ no match
                                           Claude Haiku (~30%) → Store signal
                                                    ↓ low confidence
                                           Human review queue
```

### Rules Engine
Pattern-based classification for obvious messages. Rules defined as:
```typescript
{ patterns: RegExp[], classification: SignalType, confidence: number }
```

Examples:
- "looking to buy" → Buyer Search
- "looking for a tenant" → Landlord Signal
- "just listed" → Property for Sale
- "available to rent" → Property for Rent
- "does anyone know a good" → Service Request
- "happy birthday" → Social (skip)

Rules also run lightweight regex extractors for locations, budgets ("£2m" → 2000000), and bedrooms ("3 bed" → 3).

### Claude API (Haiku)
Ambiguous messages get a structured prompt requesting JSON classification with type, confidence, actionable flag, and extracted fields.

Model: `claude-haiku-4-5-20251001` for cost efficiency.

### Confidence Thresholds
- **>= 0.85** — auto-process, generate alerts immediately
- **0.70 - 0.84** — auto-process, flag for optional review
- **< 0.70** — queue for human review, no alerts until reviewed

### Cost Estimate
- ~3,000 messages/day
- ~70% caught by rules (free)
- ~900 hit Haiku ≈ $1-3/day

---

## 8. Matching Engine

Runs when a new matchable signal is stored (Buyer Search ↔ Property for Sale, Tenant Search ↔ Property for Rent). Also runs nightly batch.

### Scoring Criteria

| Criteria | Weight | Logic |
|----------|--------|-------|
| Area overlap | 30% | Signal locations intersect |
| Budget fit | 25% | Buyer budget covers listing price (±15% tolerance) |
| Bedrooms | 20% | Exact match or ±1 |
| Property type | 15% | Same type |
| Recency | 10% | Newer scores higher, >30 days decays |

Threshold: matches scoring > 0.5 are stored and both agents alerted.

### Match Lifecycle
1. `pending` — system found match, agents notified
2. `confirmed` — agent confirms it's a real opportunity
3. `dismissed` — agent says not relevant

---

## 9. Real-Time & Notifications

### WebSocket Events (in-app)
```
alert:new           — new alert for this agent
signal:new          — new signal in agent's coverage area
signal:updated      — signal status changed
match:new           — new match involving agent's signal
livefeed:message    — raw message received
livefeed:classified — message just classified
```

Server maintains `agentId → WebSocket connection(s)` map.

### Email
Transactional via Resend or SendGrid. Templates: new alert, match found, daily digest.
Daily digest runs as a pg-boss cron job at 7:00 AM London time — aggregates previous 24h of alerts for agents who opted in.

### WhatsApp Outbound
Stub interface (`WhatsAppProvider`) — provider to be plugged in later.

### Push
Web Push API via `web-push` npm package. Service worker registration, subscription stored in DB.

### Delivery Flow
Alert created → load agent's notification_preferences → queue separate pg-boss job per enabled channel. Failures retry with exponential backoff (3 attempts).

---

## 10. Authentication & Security

### Magic Link Flow
1. Agent enters email on Login page
2. Server checks agent exists and is_active
3. Generates `crypto.randomUUID()` token, stores in sessions (15 min expiry)
4. Sends email with link: `/verify-login?token=abc123`
5. Agent clicks → server verifies token → sets httpOnly session cookie (7-day expiry)
6. Cookie auto-refreshes on API activity

### Session
- httpOnly, Secure, SameSite=Strict cookie
- 7-day expiry, refreshed on each API call
- Logout invalidates session in DB

### Admin Capabilities
- Invite new agent (name + email → sends first magic link)
- Deactivate agent (revokes access, kills sessions)
- Assign/change coverage areas
- View audit log

### API Security
- Auth middleware on all routes except `/api/auth/login` and `/api/auth/verify`
- Rate limiting on login: 5 requests per email per 15 min
- Input validation with Zod on every endpoint (shared schemas)
- CORS restricted to app domain

---

## 11. Audit Trail & Analytics

### Audited Actions
| Action | Triggered By |
|--------|-------------|
| message_received | System |
| signal_classified | System |
| signal_reviewed | Agent |
| alert_created | System |
| alert_read | Agent |
| match_found | System |
| match_confirmed | Agent |
| match_dismissed | Agent |
| agent_invited | Admin |
| agent_deactivated | Admin |
| preferences_updated | Agent |
| login | Agent |

### Analytics Dashboard (Real Metrics)

**KPIs:**
- Total signals (today/week/month)
- Active alerts (unread)
- Classification accuracy (human agreement rate)
- Average classification time (rules vs LLM)
- Match rate (confirmed ÷ found)

**Charts:**
- Signal volume over time (line)
- Signal type distribution (pie)
- Area demand heatmap
- Budget distribution (histogram)
- Agent activity (reviews, alert responses)
- Rules vs LLM classification split

**Classification Health:**
- Human review queue depth
- Average confidence trending
- Common low-confidence patterns (informs new rules)

All analytics query PostgreSQL directly — sufficient for current scale with proper indexes.

---

## 12. Features Summary

### Must-Haves
1. Real backend API (Express, modular routes)
2. PostgreSQL database with migrations
3. Message ingestion pipeline (pg-boss queue)
4. Hybrid classification engine (rules + Claude Haiku)
5. Magic link authentication
6. Real-time alerts (WebSocket + email + WhatsApp stub + push)
7. Agent management (admin panel)

### High-Value Additions
8. Message deduplication (fingerprint hashing)
9. Confidence review queue (human review for low-confidence)
10. Signal matching engine (buyer ↔ listing, weighted scoring)
11. Analytics dashboard (real metrics, classification health)
12. Audit trail (all actions logged with JSONB metadata)
13. Area heatmaps (demand concentration visualization)
14. Mobile-responsive improvements
