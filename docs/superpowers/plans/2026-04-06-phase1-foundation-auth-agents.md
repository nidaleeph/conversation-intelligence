# Phase 1: Foundation, Auth & Agents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the database, server module system, magic link authentication, and agents CRUD — producing an authenticated app where admins can invite agents and agents can log in.

**Architecture:** Modular monolith — single Express server with internal module boundaries. PostgreSQL for persistence, pg-boss for job queue (used by later phases). Shared Zod schemas for frontend/backend type safety.

**Tech Stack:** Express, PostgreSQL (pg), pg-boss, Zod, vitest, Resend (email), ws (WebSocket placeholder), TanStack Query (frontend)

**Note:** Do NOT auto-commit. The user reviews and pushes all changes manually.

**Spec reference:** `docs/superpowers/specs/2026-04-06-ddre-war-room-production-design.md`

---

## File Map

### New files — Server
- `server/index.ts` — **Modify** existing: replace static-only server with modular Express app
- `server/app.ts` — Create: Express app factory (separates app creation from listening for testability)
- `server/db/connection.ts` — Create: PostgreSQL connection pool
- `server/db/boss.ts` — Create: pg-boss instance setup
- `server/db/migrations/001-initial-schema.sql` — Create: all tables + indexes
- `server/db/migrate.ts` — Create: migration runner script
- `server/modules/auth/routes.ts` — Create: POST /api/auth/login, GET /api/auth/verify, POST /api/auth/logout
- `server/modules/auth/service.ts` — Create: magic link generation, token verification, session management
- `server/modules/auth/email.ts` — Create: send magic link email via Resend
- `server/modules/agents/routes.ts` — Create: agents CRUD endpoints
- `server/modules/agents/service.ts` — Create: agents business logic
- `server/middleware/auth.ts` — Create: session cookie auth guard
- `server/middleware/error.ts` — Create: global error handler
- `server/middleware/rate-limit.ts` — Create: in-memory rate limiter for login

### New files — Shared
- `shared/types.ts` — Create: all TypeScript interfaces (replaces client/src/lib/data.ts types)
- `shared/schemas.ts` — Create: Zod schemas for validation (used by both frontend and backend)

### New files — Frontend
- `client/src/api/client.ts` — Create: Axios instance with auth interceptors
- `client/src/api/auth.ts` — Create: login, verify, logout, getSession API calls
- `client/src/api/agents.ts` — Create: agents API calls
- `client/src/contexts/AuthContext.tsx` — Create: auth state provider
- `client/src/hooks/useAuth.ts` — Create: auth hook
- `client/src/components/ProtectedRoute.tsx` — Create: auth guard wrapper
- `client/src/pages/Login.tsx` — Create: magic link login page
- `client/src/pages/VerifyLogin.tsx` — Create: magic link verification page

### Modified files
- `client/src/App.tsx` — Modify: add auth provider, protected routes, login routes
- `client/src/components/DashboardLayout.tsx` — Modify: show current user, add logout
- `package.json` — Modify: add new dependencies and scripts
- `shared/const.ts` — Modify: add session cookie config
- `.env.example` — Create: document all required env vars
- `tsconfig.json` — Modify: add server test paths if needed

### Test files
- `server/__tests__/schemas.test.ts` — Create: Zod schema validation tests
- `server/__tests__/auth.test.ts` — Create: auth service unit tests
- `server/__tests__/agents.test.ts` — Create: agents service unit tests
- `vitest.config.ts` — Create: vitest configuration

---

## Task 1: Install Dependencies & Configure Environment

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Create: `.env` (local only, gitignored)

- [ ] **Step 1: Install backend dependencies**

```bash
pnpm add pg pg-boss resend web-push ws cookie-parser cors
pnpm add -D @types/pg @types/ws @types/cookie-parser @types/cors
```

- [ ] **Step 2: Install shared/test dependencies**

```bash
pnpm add @tanstack/react-query
```

Note: Zod is already installed. vitest is already in devDependencies.

- [ ] **Step 3: Create `.env.example`**

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ddre_warroom

# Server
CORS_ORIGIN=http://localhost:3000

# Auth
SESSION_SECRET=change-me-to-a-random-string
MAGIC_LINK_BASE_URL=http://localhost:3000

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@ddre.com

# AI Classification (Phase 2)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx

# Web Push (Phase 4)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:admin@ddre.com
```

- [ ] **Step 4: Copy `.env.example` to `.env` and fill in local values**

- [ ] **Step 5: Add `.env` to `.gitignore`**

Verify `.env` is already in `.gitignore`. If not, add it:

```
.env
.env.local
```

- [ ] **Step 6: Add `db:migrate` script to `package.json`**

Add to the `"scripts"` section:

```json
"db:migrate": "tsx server/db/migrate.ts",
"test": "vitest run",
"test:watch": "vitest"
```

---

## Task 2: Vitest Configuration

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create vitest config**

Create `vitest.config.ts` at project root:

```typescript
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/__tests__/**/*.test.ts"],
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
```

- [ ] **Step 2: Verify vitest runs (no tests yet, should exit cleanly)**

```bash
pnpm test
```

Expected: "No test files found" or exits with 0.

---

## Task 3: Shared Types

**Files:**
- Create: `shared/types.ts`

- [ ] **Step 1: Create shared types file**

Create `shared/types.ts` with all interfaces from the spec. These replace the types currently in `client/src/lib/data.ts`:

```typescript
// ============================================================
// DDRE War Room — Shared Type Definitions
// Used by both server and client via @shared/* alias
// ============================================================

export type SignalType =
  | "Buyer Search"
  | "Tenant Search"
  | "Seller Signal"
  | "Landlord Signal"
  | "Property for Sale"
  | "Property for Rent"
  | "Service Request"
  | "Service Reply"
  | "Contextual Reply"
  | "Social"
  | "Irrelevant"
  | "Market Commentary";

export const SIGNAL_TYPES: SignalType[] = [
  "Buyer Search",
  "Tenant Search",
  "Seller Signal",
  "Landlord Signal",
  "Property for Sale",
  "Property for Rent",
  "Service Request",
  "Service Reply",
  "Contextual Reply",
  "Social",
  "Irrelevant",
  "Market Commentary",
];

export type SignalStatus = "new" | "reviewed" | "alerted" | "matched";

export type AgentRole = "agent" | "admin";

export type AlertType = "new_signal" | "match_found" | "review_needed";

export type AlertPriority = "high" | "medium" | "low";

export type MatchStatus = "pending" | "confirmed" | "dismissed";

export type ClassificationMethod = "rules" | "llm";

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: AgentRole;
  coverageAreas: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  agentId: string;
  token: string;
  expiresAt: string;
  verified: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  sourceGroup: string;
  senderName: string;
  senderPhone: string;
  rawText: string;
  platform: string;
  receivedAt: string;
  fingerprint: string;
  classified: boolean;
  createdAt: string;
}

export interface Signal {
  id: string;
  messageId: string;
  type: SignalType;
  classificationMethod: ClassificationMethod;
  confidence: number;
  location: string[];
  postcodes: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  outsideSpace: boolean | null;
  parking: boolean | null;
  condition: string | null;
  summary: string;
  status: SignalStatus;
  reviewedBy: string | null;
  actionable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Match {
  id: string;
  signalAId: string;
  signalBId: string;
  matchScore: number;
  matchReasons: string[];
  status: MatchStatus;
  confirmedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  agentId: string;
  signalId: string;
  matchId: string | null;
  type: AlertType;
  priority: AlertPriority;
  summary: string;
  read: boolean;
  readAt: string | null;
  deliveredVia: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  id: string;
  agentId: string;
  inApp: boolean;
  email: boolean;
  whatsapp: boolean;
  push: boolean;
  signalTypes: SignalType[] | null;
  minPriority: AlertPriority;
  dailyDigest: boolean;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  agentId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

---

## Task 4: Shared Zod Schemas

**Files:**
- Create: `shared/schemas.ts`
- Create: `server/__tests__/schemas.test.ts`

- [ ] **Step 1: Write failing tests for Zod schemas**

Create `server/__tests__/schemas.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  loginSchema,
  createAgentSchema,
  updateAgentSchema,
} from "@shared/schemas";

describe("loginSchema", () => {
  it("accepts a valid email", () => {
    const result = loginSchema.safeParse({ email: "agent@ddre.com" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty email", () => {
    const result = loginSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });
});

describe("createAgentSchema", () => {
  it("accepts valid agent data", () => {
    const result = createAgentSchema.safeParse({
      name: "John Smith",
      email: "john@ddre.com",
      role: "agent",
      coverageAreas: ["Hampstead", "Highgate"],
    });
    expect(result.success).toBe(true);
  });

  it("defaults role to agent", () => {
    const result = createAgentSchema.safeParse({
      name: "John Smith",
      email: "john@ddre.com",
      coverageAreas: ["Hampstead"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("agent");
    }
  });

  it("rejects missing name", () => {
    const result = createAgentSchema.safeParse({
      email: "john@ddre.com",
      coverageAreas: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = createAgentSchema.safeParse({
      name: "John",
      email: "john@ddre.com",
      role: "superadmin",
      coverageAreas: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateAgentSchema", () => {
  it("accepts partial update", () => {
    const result = updateAgentSchema.safeParse({
      coverageAreas: ["Belsize Park"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no changes)", () => {
    const result = updateAgentSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test
```

Expected: FAIL — `@shared/schemas` module not found.

- [ ] **Step 3: Create Zod schemas**

Create `shared/schemas.ts`:

```typescript
import { z } from "zod/v4";

// ============================================================
// Auth schemas
// ============================================================

export const loginSchema = z.object({
  email: z.email(),
});

export const verifyTokenSchema = z.object({
  token: z.string().min(1),
});

// ============================================================
// Agent schemas
// ============================================================

export const createAgentSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(["agent", "admin"]).default("agent"),
  coverageAreas: z.array(z.string()),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  role: z.enum(["agent", "admin"]).optional(),
  coverageAreas: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================
// Signal schemas (used in Phase 2)
// ============================================================

export const SIGNAL_TYPE_VALUES = [
  "Buyer Search",
  "Tenant Search",
  "Seller Signal",
  "Landlord Signal",
  "Property for Sale",
  "Property for Rent",
  "Service Request",
  "Service Reply",
  "Contextual Reply",
  "Social",
  "Irrelevant",
  "Market Commentary",
] as const;

export const signalTypeSchema = z.enum(SIGNAL_TYPE_VALUES);

// ============================================================
// Pagination
// ============================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// Notification preferences
// ============================================================

export const updateNotificationPrefsSchema = z.object({
  inApp: z.boolean().optional(),
  email: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
  push: z.boolean().optional(),
  signalTypes: z.array(signalTypeSchema).nullable().optional(),
  minPriority: z.enum(["high", "medium", "low"]).optional(),
  dailyDigest: z.boolean().optional(),
});
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test
```

Expected: All 7 tests PASS.

---

## Task 5: Database Connection

**Files:**
- Create: `server/db/connection.ts`

- [ ] **Step 1: Create database connection pool**

Create `server/db/connection.ts`:

```typescript
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}

export async function closePool(): Promise<void> {
  await pool.end();
}

export default pool;
```

---

## Task 6: Database Migration

**Files:**
- Create: `server/db/migrations/001-initial-schema.sql`
- Create: `server/db/migrate.ts`

- [ ] **Step 1: Create the initial migration SQL**

Create `server/db/migrations/001-initial-schema.sql`:

```sql
-- ============================================================
-- DDRE War Room — Initial Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Agents
-- ============================================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('agent', 'admin')),
  coverage_areas TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Sessions (magic link auth)
-- ============================================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_agent_id ON sessions(agent_id);

-- ============================================================
-- Messages (raw WhatsApp messages)
-- ============================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_group TEXT,
  sender_name TEXT,
  sender_phone TEXT,
  raw_text TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'whatsapp',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fingerprint TEXT UNIQUE,
  classified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_fingerprint ON messages(fingerprint);
CREATE INDEX idx_messages_classified ON messages(classified) WHERE classified = false;

-- ============================================================
-- Signals (classified from messages)
-- ============================================================
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  classification_method TEXT NOT NULL CHECK (classification_method IN ('rules', 'llm')),
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0,
  location TEXT[] NOT NULL DEFAULT '{}',
  postcodes TEXT[] NOT NULL DEFAULT '{}',
  budget_min INTEGER,
  budget_max INTEGER,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  sqft INTEGER,
  outside_space BOOLEAN,
  parking BOOLEAN,
  condition TEXT,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'alerted', 'matched')),
  reviewed_by UUID REFERENCES agents(id) ON DELETE SET NULL,
  actionable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signals_type_status ON signals(type, status);
CREATE INDEX idx_signals_location ON signals USING GIN(location);
CREATE INDEX idx_signals_created_at ON signals(created_at);
CREATE INDEX idx_signals_status ON signals(status) WHERE status = 'new';

-- ============================================================
-- Matches (buyer ↔ listing)
-- ============================================================
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_a_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  signal_b_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  match_score DECIMAL(3,2) NOT NULL DEFAULT 0,
  match_reasons TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  confirmed_by UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(signal_a_id, signal_b_id)
);

-- ============================================================
-- Alerts
-- ============================================================
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('new_signal', 'match_found', 'review_needed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  summary TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  delivered_via TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_agent_read ON alerts(agent_id, read);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

-- ============================================================
-- Notification preferences
-- ============================================================
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID UNIQUE NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  in_app BOOLEAN NOT NULL DEFAULT true,
  email BOOLEAN NOT NULL DEFAULT true,
  whatsapp BOOLEAN NOT NULL DEFAULT false,
  push BOOLEAN NOT NULL DEFAULT false,
  signal_types TEXT[],
  min_priority TEXT NOT NULL DEFAULT 'low' CHECK (min_priority IN ('high', 'medium', 'low')),
  daily_digest BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Push subscriptions (Web Push API)
-- ============================================================
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_agent ON push_subscriptions(agent_id);

-- ============================================================
-- Audit log
-- ============================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);

-- ============================================================
-- Migration tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Create migration runner**

Create `server/db/migrate.ts`:

```typescript
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

async function migrate() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/ddre_warroom";

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Get already-applied migrations
    const applied = await client.query(
      "SELECT version FROM schema_migrations ORDER BY version"
    );
    const appliedVersions = new Set(
      applied.rows.map((r: { version: number }) => r.version)
    );

    // Read migration files
    const migrationsDir = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "migrations"
    );
    // Handle Windows paths: strip leading slash from /D:/...
    const normalizedDir = process.platform === "win32"
      ? migrationsDir.replace(/^\/([A-Za-z]:)/, "$1")
      : migrationsDir;

    const files = fs
      .readdirSync(normalizedDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const version = parseInt(file.split("-")[0], 10);
      if (appliedVersions.has(version)) {
        console.log(`  skip: ${file} (already applied)`);
        continue;
      }

      console.log(`  apply: ${file}`);
      const sql = fs.readFileSync(path.join(normalizedDir, file), "utf-8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
          [version, file]
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("Migrations complete.");
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Create local PostgreSQL database and run migration**

```bash
# Create the database (if it doesn't exist)
createdb ddre_warroom 2>/dev/null || echo "Database already exists"

# Run migrations
pnpm db:migrate
```

Expected: Prints "apply: 001-initial-schema.sql" then "Migrations complete."

- [ ] **Step 4: Verify tables exist**

```bash
psql ddre_warroom -c "\dt"
```

Expected: Lists agents, sessions, messages, signals, matches, alerts, notification_preferences, push_subscriptions, audit_log, schema_migrations.

---

## Task 7: pg-boss Setup

**Files:**
- Create: `server/db/boss.ts`

- [ ] **Step 1: Create pg-boss instance**

Create `server/db/boss.ts`:

```typescript
import PgBoss from "pg-boss";

let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;

  boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    retryLimit: 3,
    retryBackoff: true,
    expireInHours: 24,
    archiveCompletedAfterSeconds: 60 * 60 * 12, // 12 hours
    deleteAfterDays: 7,
  });

  boss.on("error", (err) => {
    console.error("pg-boss error:", err);
  });

  await boss.start();
  console.log("pg-boss started");
  return boss;
}

export async function stopBoss(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}
```

---

## Task 8: Server Restructure

**Files:**
- Create: `server/app.ts`
- Modify: `server/index.ts`
- Create: `server/middleware/error.ts`
- Create: `server/middleware/rate-limit.ts`

- [ ] **Step 1: Create global error handler middleware**

Create `server/middleware/error.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500 ? "Internal server error" : err.message;

  if (statusCode === 500) {
    console.error("Unhandled error:", err);
  }

  res.status(statusCode).json({ error: message });
}

export function createError(statusCode: number, message: string): AppError {
  const err = new Error(message) as AppError;
  err.statusCode = statusCode;
  return err;
}
```

- [ ] **Step 2: Create rate limiter for login**

Create `server/middleware/rate-limit.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref();

export function rateLimit(opts: {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = opts.keyFn
      ? opts.keyFn(req)
      : req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > opts.max) {
      res.status(429).json({
        error: "Too many requests. Please try again later.",
      });
      return;
    }

    next();
  };
}
```

- [ ] **Step 3: Create Express app factory**

Create `server/app.ts`:

```typescript
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { errorHandler } from "./middleware/error.js";
import { authRoutes } from "./modules/auth/routes.js";
import { agentsRoutes } from "./modules/agents/routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // Body parsing
  app.use(express.json());
  app.use(cookieParser());

  // CORS — restrict to app domain in production
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      credentials: true,
    })
  );

  // API routes
  app.use("/api/auth", authRoutes());
  app.use("/api/agents", agentsRoutes());

  // Static files (frontend)
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // SPA fallback — serve index.html for non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 4: Rewrite `server/index.ts` to use app factory + pg-boss**

Replace `server/index.ts` with:

```typescript
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { getBoss, stopBoss } from "./db/boss.js";
import pool from "./db/connection.js";

async function startServer() {
  // Verify database connection
  try {
    await pool.query("SELECT 1");
    console.log("PostgreSQL connected");
  } catch (err) {
    console.error("Failed to connect to PostgreSQL:", err);
    process.exit(1);
  }

  // Start pg-boss
  await getBoss();

  // Create Express app
  const app = createApp();
  const server = createServer(app);

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Graceful shutdown
  async function shutdown() {
    console.log("Shutting down...");
    server.close();
    await stopBoss();
    await pool.end();
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
```

---

## Task 9: Auth Middleware

**Files:**
- Create: `server/middleware/auth.ts`
- Modify: `shared/const.ts`

- [ ] **Step 1: Update shared constants**

Modify `shared/const.ts`:

```typescript
export const COOKIE_NAME = "ddre_session";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
export const MAGIC_LINK_EXPIRY_MS = 1000 * 60 * 15; // 15 minutes
```

- [ ] **Step 2: Create auth middleware**

Create `server/middleware/auth.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import { COOKIE_NAME } from "@shared/const.js";
import { query } from "../db/connection.js";

export interface AuthenticatedRequest extends Request {
  agent?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const sessionId = req.cookies?.[COOKIE_NAME];

  if (!sessionId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  query(
    `SELECT s.id, s.agent_id, s.expires_at, a.name, a.email, a.role, a.is_active
     FROM sessions s
     JOIN agents a ON a.id = s.agent_id
     WHERE s.id = $1 AND s.verified = true`,
    [sessionId]
  )
    .then((result) => {
      const session = result.rows[0];
      if (!session) {
        res.status(401).json({ error: "Invalid session" });
        return;
      }

      if (new Date(session.expires_at) < new Date()) {
        res.status(401).json({ error: "Session expired" });
        return;
      }

      if (!session.is_active) {
        res.status(403).json({ error: "Account deactivated" });
        return;
      }

      req.agent = {
        id: session.agent_id,
        name: session.name,
        email: session.email,
        role: session.role,
      };

      next();
    })
    .catch(next);
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (req.agent?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
```

---

## Task 10: Auth Module

**Files:**
- Create: `server/modules/auth/service.ts`
- Create: `server/modules/auth/email.ts`
- Create: `server/modules/auth/routes.ts`
- Create: `server/__tests__/auth.test.ts`

- [ ] **Step 1: Write failing tests for auth service**

Create `server/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMagicLinkToken,
  verifyMagicLinkToken,
  createSession,
} from "../modules/auth/service.js";

// Mock database
vi.mock("../db/connection.js", () => ({
  query: vi.fn(),
  getClient: vi.fn(),
}));

import { query, getClient } from "../db/connection.js";
const mockQuery = vi.mocked(query);
const mockGetClient = vi.mocked(getClient);

describe("auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMagicLinkToken", () => {
    it("returns null if agent not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await createMagicLinkToken("nobody@test.com");
      expect(result).toBeNull();
    });

    it("returns null if agent is inactive", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "agent-1", is_active: false }],
        rowCount: 1,
      } as any);

      const result = await createMagicLinkToken("inactive@test.com");
      expect(result).toBeNull();
    });

    it("returns a token for active agent", async () => {
      mockQuery
        // First call: find agent
        .mockResolvedValueOnce({
          rows: [{ id: "agent-1", is_active: true }],
          rowCount: 1,
        } as any)
        // Second call: insert session
        .mockResolvedValueOnce({
          rows: [{ token: "test-token-123" }],
          rowCount: 1,
        } as any);

      const result = await createMagicLinkToken("agent@test.com");
      expect(result).toBe("test-token-123");
    });
  });

  describe("verifyMagicLinkToken", () => {
    it("returns null for non-existent token", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await verifyMagicLinkToken("bad-token");
      expect(result).toBeNull();
    });

    it("returns null for expired token", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "session-1",
            agent_id: "agent-1",
            expires_at: new Date(Date.now() - 1000),
            verified: false,
          },
        ],
        rowCount: 1,
      } as any);

      const result = await verifyMagicLinkToken("expired-token");
      expect(result).toBeNull();
    });

    it("returns session ID for valid token", async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      // Find session
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "session-1",
            agent_id: "agent-1",
            expires_at: new Date(Date.now() + 60000),
            verified: false,
          },
        ],
        rowCount: 1,
      } as any);
      // getClient for transaction
      mockGetClient.mockResolvedValueOnce(mockClient as any);
      // BEGIN
      mockClient.query.mockResolvedValueOnce({} as any);
      // UPDATE session
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: "new-session-id", agent_id: "agent-1" }],
        rowCount: 1,
      } as any);
      // COMMIT
      mockClient.query.mockResolvedValueOnce({} as any);

      const result = await verifyMagicLinkToken("valid-token");
      expect(result).toEqual({ sessionId: "new-session-id", agentId: "agent-1" });
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement auth email sender**

Create `server/modules/auth/email.ts`:

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMagicLinkEmail(
  email: string,
  token: string
): Promise<void> {
  const baseUrl =
    process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000";
  const link = `${baseUrl}/verify-login?token=${token}`;

  if (!process.env.RESEND_API_KEY) {
    // Dev mode: log instead of sending
    console.log(`\n  Magic link for ${email}:\n  ${link}\n`);
    return;
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "DDRE War Room <noreply@ddre.com>",
    to: email,
    subject: "Your DDRE War Room Login Link",
    html: `
      <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a1e23;">Sign in to DDRE War Room</h2>
        <p>Click the button below to sign in. This link expires in 15 minutes.</p>
        <a href="${link}" style="display: inline-block; padding: 12px 32px; background: #77d5c0; color: #1a1e23; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Sign In
        </a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
```

- [ ] **Step 4: Implement auth service**

Create `server/modules/auth/service.ts`:

```typescript
import crypto from "node:crypto";
import { query, getClient } from "../../db/connection.js";
import { MAGIC_LINK_EXPIRY_MS, SESSION_MAX_AGE_MS } from "@shared/const.js";

export async function createMagicLinkToken(
  email: string
): Promise<string | null> {
  // Find active agent by email
  const agentResult = await query(
    "SELECT id, is_active FROM agents WHERE email = $1",
    [email]
  );

  const agent = agentResult.rows[0];
  if (!agent || !agent.is_active) return null;

  // Generate token and create unverified session
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS);

  const sessionResult = await query(
    `INSERT INTO sessions (agent_id, token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING token`,
    [agent.id, token, expiresAt]
  );

  return sessionResult.rows[0].token;
}

export async function verifyMagicLinkToken(
  token: string
): Promise<{ sessionId: string; agentId: string } | null> {
  // Find the unverified session
  const result = await query(
    `SELECT id, agent_id, expires_at, verified
     FROM sessions WHERE token = $1`,
    [token]
  );

  const session = result.rows[0];
  if (!session) return null;
  if (session.verified) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  // Verify and create a long-lived session in a transaction
  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Mark old session as verified (consumed)
    await client.query(
      "UPDATE sessions SET verified = true WHERE id = $1",
      [session.id]
    );

    // Create new long-lived session for the cookie
    const newExpiry = new Date(Date.now() + SESSION_MAX_AGE_MS);
    const newToken = crypto.randomUUID();
    const newSession = await client.query(
      `INSERT INTO sessions (agent_id, token, expires_at, verified)
       VALUES ($1, $2, $3, true)
       RETURNING id, agent_id`,
      [session.agent_id, newToken, newExpiry]
    );

    await client.query("COMMIT");
    return {
      sessionId: newSession.rows[0].id,
      agentId: newSession.rows[0].agent_id,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function refreshSession(sessionId: string): Promise<void> {
  const newExpiry = new Date(Date.now() + SESSION_MAX_AGE_MS);
  await query("UPDATE sessions SET expires_at = $1 WHERE id = $2", [
    newExpiry,
    sessionId,
  ]);
}

export async function destroySession(sessionId: string): Promise<void> {
  await query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

export async function destroyAllAgentSessions(
  agentId: string
): Promise<void> {
  await query("DELETE FROM sessions WHERE agent_id = $1", [agentId]);
}
```

- [ ] **Step 5: Implement auth routes**

Create `server/modules/auth/routes.ts`:

```typescript
import { Router } from "express";
import { loginSchema, verifyTokenSchema } from "@shared/schemas.js";
import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js";
import { createError } from "../../middleware/error.js";
import {
  createMagicLinkToken,
  verifyMagicLinkToken,
  destroySession,
} from "./service.js";
import { sendMagicLinkEmail } from "./email.js";

export function authRoutes(): Router {
  const router = Router();

  // POST /api/auth/login — request magic link
  router.post(
    "/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      keyFn: (req) => req.body?.email || req.ip || "unknown",
    }),
    async (req, res, next) => {
      try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
          throw createError(400, "Invalid email address");
        }

        const token = await createMagicLinkToken(parsed.data.email);

        // Always return success to prevent email enumeration
        if (token) {
          await sendMagicLinkEmail(parsed.data.email, token);
        }

        res.json({ message: "If an account exists, a login link has been sent." });
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/auth/verify?token=xxx — verify magic link
  router.get("/verify", async (req, res, next) => {
    try {
      const parsed = verifyTokenSchema.safeParse({ token: req.query.token });
      if (!parsed.success) {
        throw createError(400, "Invalid token");
      }

      const result = await verifyMagicLinkToken(parsed.data.token);
      if (!result) {
        throw createError(401, "Invalid or expired link");
      }

      // Set session cookie
      res.cookie(COOKIE_NAME, result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: SESSION_MAX_AGE_MS,
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/logout
  router.post("/logout", requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const sessionId = req.cookies?.[COOKIE_NAME];
      if (sessionId) {
        await destroySession(sessionId);
      }
      res.clearCookie(COOKIE_NAME);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/auth/me — get current user
  router.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ agent: req.agent });
  });

  return router;
}
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
pnpm test
```

Expected: All auth tests PASS, all schema tests PASS.

---

## Task 11: Agents Module

**Files:**
- Create: `server/modules/agents/service.ts`
- Create: `server/modules/agents/routes.ts`
- Create: `server/__tests__/agents.test.ts`

- [ ] **Step 1: Write failing tests for agents service**

Create `server/__tests__/agents.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAgents,
  getAgentById,
  createAgent,
  updateAgent,
} from "../modules/agents/service.js";

vi.mock("../db/connection.js", () => ({
  query: vi.fn(),
}));

import { query } from "../db/connection.js";
const mockQuery = vi.mocked(query);

describe("agents service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listAgents", () => {
    it("returns paginated agents", async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ count: "5" }],
        } as any)
        .mockResolvedValueOnce({
          rows: [
            { id: "a1", name: "Agent 1", email: "a1@test.com" },
            { id: "a2", name: "Agent 2", email: "a2@test.com" },
          ],
        } as any);

      const result = await listAgents({ page: 1, limit: 2 });
      expect(result.total).toBe(5);
      expect(result.agents).toHaveLength(2);
      expect(result.agents[0].name).toBe("Agent 1");
    });
  });

  describe("getAgentById", () => {
    it("returns agent when found", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "a1", name: "Agent 1", email: "a1@test.com" }],
      } as any);

      const result = await getAgentById("a1");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Agent 1");
    });

    it("returns null when not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await getAgentById("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("createAgent", () => {
    it("creates and returns a new agent", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "new-id",
            name: "New Agent",
            email: "new@test.com",
            role: "agent",
            coverage_areas: ["Hampstead"],
            is_active: true,
            created_at: "2026-04-06T00:00:00Z",
            updated_at: "2026-04-06T00:00:00Z",
          },
        ],
      } as any);

      const result = await createAgent({
        name: "New Agent",
        email: "new@test.com",
        role: "agent",
        coverageAreas: ["Hampstead"],
      });

      expect(result.id).toBe("new-id");
      expect(result.name).toBe("New Agent");
    });
  });

  describe("updateAgent", () => {
    it("updates specified fields only", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "a1",
            name: "Updated",
            email: "a1@test.com",
            role: "agent",
            coverage_areas: ["Highgate"],
            is_active: true,
            created_at: "2026-04-06T00:00:00Z",
            updated_at: "2026-04-06T00:00:00Z",
          },
        ],
      } as any);

      const result = await updateAgent("a1", { name: "Updated" });
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Updated");
    });

    it("returns null when agent not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await updateAgent("nonexistent", { name: "X" });
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement agents service**

Create `server/modules/agents/service.ts`:

```typescript
import { query } from "../../db/connection.js";

interface AgentRow {
  id: string;
  name: string;
  email: string;
  role: string;
  coverage_areas: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function toAgent(row: AgentRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    coverageAreas: row.coverage_areas,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAgents(opts: { page: number; limit: number }) {
  const offset = (opts.page - 1) * opts.limit;

  const countResult = await query("SELECT count(*) FROM agents");
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query<AgentRow>(
    `SELECT * FROM agents ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [opts.limit, offset]
  );

  return { agents: result.rows.map(toAgent), total };
}

export async function getAgentById(id: string) {
  const result = await query<AgentRow>(
    "SELECT * FROM agents WHERE id = $1",
    [id]
  );
  return result.rows[0] ? toAgent(result.rows[0]) : null;
}

export async function getAgentByEmail(email: string) {
  const result = await query<AgentRow>(
    "SELECT * FROM agents WHERE email = $1",
    [email]
  );
  return result.rows[0] ? toAgent(result.rows[0]) : null;
}

export async function createAgent(data: {
  name: string;
  email: string;
  role: string;
  coverageAreas: string[];
}) {
  const result = await query<AgentRow>(
    `INSERT INTO agents (name, email, role, coverage_areas)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.name, data.email, data.role, data.coverageAreas]
  );
  return toAgent(result.rows[0]);
}

export async function updateAgent(
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: string;
    coverageAreas?: string[];
    isActive?: boolean;
  }
) {
  // Build dynamic SET clause
  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    sets.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.email !== undefined) {
    sets.push(`email = $${paramIndex++}`);
    values.push(data.email);
  }
  if (data.role !== undefined) {
    sets.push(`role = $${paramIndex++}`);
    values.push(data.role);
  }
  if (data.coverageAreas !== undefined) {
    sets.push(`coverage_areas = $${paramIndex++}`);
    values.push(data.coverageAreas);
  }
  if (data.isActive !== undefined) {
    sets.push(`is_active = $${paramIndex++}`);
    values.push(data.isActive);
  }

  if (sets.length === 0) {
    return getAgentById(id);
  }

  sets.push(`updated_at = now()`);
  values.push(id);

  const result = await query<AgentRow>(
    `UPDATE agents SET ${sets.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result.rows[0] ? toAgent(result.rows[0]) : null;
}

export async function deleteAgent(id: string): Promise<boolean> {
  const result = await query("DELETE FROM agents WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
```

- [ ] **Step 4: Implement agents routes**

Create `server/modules/agents/routes.ts`:

```typescript
import { Router } from "express";
import {
  createAgentSchema,
  updateAgentSchema,
  paginationSchema,
} from "@shared/schemas.js";
import {
  requireAuth,
  requireAdmin,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";
import { createError } from "../../middleware/error.js";
import {
  listAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
} from "./service.js";

export function agentsRoutes(): Router {
  const router = Router();

  // All agent routes require authentication
  router.use(requireAuth);

  // GET /api/agents — list agents
  router.get("/", async (req, res, next) => {
    try {
      const pagination = paginationSchema.parse(req.query);
      const result = await listAgents(pagination);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/agents/:id — get single agent
  router.get("/:id", async (req, res, next) => {
    try {
      const agent = await getAgentById(req.params.id);
      if (!agent) throw createError(404, "Agent not found");
      res.json(agent);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/agents — create agent (admin only)
  router.post(
    "/",
    requireAdmin,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = createAgentSchema.safeParse(req.body);
        if (!parsed.success) {
          throw createError(400, "Invalid agent data");
        }
        const agent = await createAgent(parsed.data);

        // Create default notification preferences
        const { query: dbQuery } = await import("../../db/connection.js");
        await dbQuery(
          "INSERT INTO notification_preferences (agent_id) VALUES ($1)",
          [agent.id]
        );

        res.status(201).json(agent);
      } catch (err: any) {
        if (err.code === "23505") {
          // unique_violation
          next(createError(409, "An agent with this email already exists"));
        } else {
          next(err);
        }
      }
    }
  );

  // PATCH /api/agents/:id — update agent (admin only)
  router.patch(
    "/:id",
    requireAdmin,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = updateAgentSchema.safeParse(req.body);
        if (!parsed.success) {
          throw createError(400, "Invalid update data");
        }
        const agent = await updateAgent(req.params.id, parsed.data);
        if (!agent) throw createError(404, "Agent not found");

        // If agent was deactivated, kill all their sessions
        if (parsed.data.isActive === false) {
          const { destroyAllAgentSessions } = await import(
            "../auth/service.js"
          );
          await destroyAllAgentSessions(req.params.id);
        }

        res.json(agent);
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /api/agents/:id — delete agent (admin only)
  router.delete(
    "/:id",
    requireAdmin,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const deleted = await deleteAgent(req.params.id);
        if (!deleted) throw createError(404, "Agent not found");
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
```

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: All schema, auth, and agent tests PASS.

---

## Task 12: Frontend API Client

**Files:**
- Create: `client/src/api/client.ts`
- Create: `client/src/api/auth.ts`
- Create: `client/src/api/agents.ts`

- [ ] **Step 1: Create Axios instance with interceptors**

Create `client/src/api/client.ts`:

```typescript
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !window.location.pathname.startsWith("/login") &&
      !window.location.pathname.startsWith("/verify-login")
    ) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
```

- [ ] **Step 2: Create auth API functions**

Create `client/src/api/auth.ts`:

```typescript
import api from "./client";

export async function requestMagicLink(email: string) {
  const { data } = await api.post("/auth/login", { email });
  return data;
}

export async function verifyMagicLink(token: string) {
  const { data } = await api.get("/auth/verify", { params: { token } });
  return data;
}

export async function logout() {
  const { data } = await api.post("/auth/logout");
  return data;
}

export async function getCurrentUser() {
  const { data } = await api.get("/auth/me");
  return data.agent;
}
```

- [ ] **Step 3: Create agents API functions**

Create `client/src/api/agents.ts`:

```typescript
import api from "./client";
import type { Agent } from "@shared/types";

export async function getAgents(page = 1, limit = 20) {
  const { data } = await api.get("/agents", { params: { page, limit } });
  return data as { agents: Agent[]; total: number };
}

export async function getAgentById(id: string) {
  const { data } = await api.get(`/agents/${id}`);
  return data as Agent;
}

export async function createAgent(agent: {
  name: string;
  email: string;
  role?: string;
  coverageAreas: string[];
}) {
  const { data } = await api.post("/agents", agent);
  return data as Agent;
}

export async function updateAgent(
  id: string,
  updates: {
    name?: string;
    email?: string;
    role?: string;
    coverageAreas?: string[];
    isActive?: boolean;
  }
) {
  const { data } = await api.patch(`/agents/${id}`, updates);
  return data as Agent;
}

export async function deleteAgent(id: string) {
  await api.delete(`/agents/${id}`);
}
```

---

## Task 13: Frontend Auth Flow

**Files:**
- Create: `client/src/contexts/AuthContext.tsx`
- Create: `client/src/hooks/useAuth.ts`
- Create: `client/src/components/ProtectedRoute.tsx`
- Create: `client/src/pages/Login.tsx`
- Create: `client/src/pages/VerifyLogin.tsx`

- [ ] **Step 1: Create AuthContext**

Create `client/src/contexts/AuthContext.tsx`:

```tsx
import {
  createContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { getCurrentUser, logout as apiLogout } from "@/api/auth";
import type { Agent } from "@shared/types";

interface AuthState {
  agent: Agent | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  agent: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      setAgent(user);
    } catch {
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setAgent(null);
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ agent, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: Create useAuth hook**

Create `client/src/hooks/useAuth.ts`:

```typescript
import { useContext } from "react";
import { AuthContext } from "@/contexts/AuthContext";

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 3: Create ProtectedRoute component**

Create `client/src/components/ProtectedRoute.tsx`:

```tsx
import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({
  children,
}: {
  children: ReactNode;
}) {
  const { agent, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1a1e23]">
        <div className="w-6 h-6 border-2 border-[#77d5c0] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 4: Create Login page**

Create `client/src/pages/Login.tsx`:

```tsx
import { useState } from "react";
import { requestMagicLink } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ArrowRight, CheckCircle } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await requestMagicLink(email);
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1a1e23]">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <img
            src="/ddre-logo-white.svg"
            alt="DDRE Global"
            className="w-12 h-auto mx-auto mb-4 opacity-90"
          />
          <h1 className="text-xl font-semibold text-[#f1f2f7]">
            DDRE War Room
          </h1>
          <p className="text-sm text-[#6b7280] mt-1">
            Sign in to your account
          </p>
        </div>

        <div className="bg-[#22272d] rounded-xl border border-[#2a2f35] p-6">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle className="w-10 h-10 text-[#77d5c0] mx-auto mb-3" />
              <p className="text-[#f1f2f7] font-medium">Check your email</p>
              <p className="text-sm text-[#6b7280] mt-1">
                We sent a login link to{" "}
                <span className="text-[#77d5c0]">{email}</span>
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-sm text-[#77d5c0] mt-4 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="block text-xs uppercase tracking-wider text-[#77d5c0] mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@ddre.com"
                  required
                  className="pl-10 bg-[#1a1e23] border-[#3a3f45] text-[#f1f2f7] placeholder:text-[#4b5563]"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 mt-2">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full mt-4 bg-[#77d5c0] text-[#1a1e23] hover:bg-[#5fc4ad] font-semibold"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-[#1a1e23] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Send Login Link
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>

        <p className="text-xs text-center text-[#4b5563] mt-6">
          Contact your admin if you don't have an account
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create VerifyLogin page**

Create `client/src/pages/VerifyLogin.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { verifyMagicLink } from "@/api/auth";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle, XCircle } from "lucide-react";

export default function VerifyLogin() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { refresh } = useAuth();
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");

    if (!token) {
      setError("No token provided");
      setVerifying(false);
      return;
    }

    verifyMagicLink(token)
      .then(async () => {
        await refresh();
        setLocation("/");
      })
      .catch(() => {
        setError("This link is invalid or has expired.");
        setVerifying(false);
      });
  }, [search, setLocation, refresh]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#1a1e23]">
      <div className="text-center">
        {verifying ? (
          <>
            <div className="w-8 h-8 border-2 border-[#77d5c0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[#f1f2f7]">Verifying your login...</p>
          </>
        ) : error ? (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-[#f1f2f7] font-medium">Login failed</p>
            <p className="text-sm text-[#6b7280] mt-1">{error}</p>
            <a
              href="/login"
              className="inline-block mt-4 text-sm text-[#77d5c0] hover:underline"
            >
              Back to login
            </a>
          </>
        ) : (
          <>
            <CheckCircle className="w-10 h-10 text-[#77d5c0] mx-auto mb-3" />
            <p className="text-[#f1f2f7]">Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
}
```

---

## Task 14: Wire Up App.tsx & DashboardLayout

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/DashboardLayout.tsx`

- [ ] **Step 1: Update App.tsx with auth provider and login routes**

Replace `client/src/App.tsx` with:

```tsx
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Parser from "./pages/Parser";
import LiveFeed from "./pages/LiveFeed";
import Agents from "./pages/Agents";
import AgentProfile from "./pages/AgentProfile";
import Login from "./pages/Login";
import VerifyLogin from "./pages/VerifyLogin";

function ProtectedRouter() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/parser" component={Parser} />
          <Route path="/live" component={LiveFeed} />
          <Route path="/agents" component={Agents} />
          <Route path="/agents/:name" component={AgentProfile} />
          <Route path="/alerts" component={Dashboard} />
          <Route path="/signals" component={Dashboard} />
          <Route path="/areas" component={Dashboard} />
          <Route path="/settings" component={Dashboard} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Switch>
              <Route path="/login" component={Login} />
              <Route path="/verify-login" component={VerifyLogin} />
              <Route component={ProtectedRouter} />
            </Switch>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
```

- [ ] **Step 2: Add logout button to DashboardLayout**

In `client/src/components/DashboardLayout.tsx`:

Add these imports at the top:
```tsx
import { useAuth } from "@/hooks/useAuth";
import { LogOut } from "lucide-react";
```

Update the component function signature to call `useAuth` at the component level:
```tsx
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { agent, logout } = useAuth();
```

Add this block at the bottom of the `<aside>`, after the closing `</nav>` tag and before `</aside>`:

```tsx
        {/* User section */}
        <div className="mt-auto pb-2 flex flex-col items-center gap-1">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={logout}
                className="w-10 h-10 flex items-center justify-center rounded-lg text-[#6b7280] hover:text-[#9ca3af] hover:bg-[#22272d] transition-all duration-200"
              >
                <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[#22272d] text-[#f1f2f7] border-[#3a3f45] text-xs">
              Sign Out
            </TooltipContent>
          </Tooltip>
        </div>
```

---

## Task 15: Verify End-to-End

- [ ] **Step 1: Ensure PostgreSQL is running and database exists**

```bash
createdb ddre_warroom 2>/dev/null || echo "Database already exists"
pnpm db:migrate
```

- [ ] **Step 2: Run all unit tests**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 3: Build and start the server**

```bash
pnpm build && pnpm start
```

Expected: Server starts, prints "PostgreSQL connected", "pg-boss started", "Server running on http://localhost:3000/".

- [ ] **Step 4: Test login endpoint manually**

First, seed an admin agent directly in the database:

```bash
psql ddre_warroom -c "INSERT INTO agents (name, email, role, coverage_areas) VALUES ('Admin', 'admin@ddre.com', 'admin', '{\"Hampstead\",\"Highgate\"}')"
```

Then test the login API:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ddre.com"}'
```

Expected: `{"message":"If an account exists, a login link has been sent."}` and a magic link logged in the server console (since no RESEND_API_KEY is set in dev).

- [ ] **Step 5: Verify frontend loads login page**

Open `http://localhost:3000` in browser. Expected: redirected to `/login`, sees the DDRE login form.

---

## Phase Roadmap (Future Plans)

After Phase 1 is complete, the remaining phases in build order:

**Phase 2: Ingestion & Classification**
- Message ingestion endpoint (POST /api/messages/ingest)
- Deduplication via fingerprint hashing
- Rules engine with regex patterns for common classifications
- Claude Haiku API integration for ambiguous messages
- Confidence review queue (signals with status 'review_needed')
- pg-boss workers for classify-message jobs

**Phase 3: Matching & Alerts**
- Matching engine with weighted scoring (area 30%, budget 25%, bedrooms 20%, type 15%, recency 10%)
- pg-boss job triggered on new matchable signals
- Nightly batch matching cron via pg-boss
- Alert generation for agents based on coverage areas
- Alerts CRUD API

**Phase 4: Notifications & Real-time**
- WebSocket server on same HTTP server
- agentId → connection map
- Real-time events: alert:new, signal:new, match:new, livefeed:*
- Email notifications via Resend
- Daily digest pg-boss cron (7 AM London time)
- Web Push subscription and delivery
- WhatsApp outbound stub interface

**Phase 5: Frontend Restructure**
- TanStack Query integration (QueryClientProvider, query hooks)
- Connect Dashboard to real analytics API
- Connect Parser to real messages/signals API
- Connect LiveFeed to WebSocket
- Connect Agents pages to real agents API
- New pages: Alerts, Signals, Areas, Settings, Admin
- Remove mock data (delete lib/data.ts)

**Phase 6: Analytics, Audit & Polish**
- Audit trail logging on all actions
- Analytics API endpoints (KPIs, charts, classification health)
- Area heatmap visualization
- Mobile-responsive improvements
- Classification accuracy monitoring
