# Phase 3: Matching & Alerts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the signal matching engine that automatically pairs buyer searches with property listings (and tenant searches with rental listings), scores them with weighted criteria, generates alerts for relevant agents, and exposes alerts via API and frontend.

**Architecture:** When a new matchable signal is classified, the pipeline queues a `match-signals` pg-boss job. The matching worker finds opposite signals, scores each pair, stores matches above 0.5, and creates alerts for agents whose coverage areas overlap. Alerts are served via REST API and displayed on the frontend.

**Tech Stack:** PostgreSQL (scoring queries), pg-boss (job queue), Express (API), TanStack Query (frontend)

**Note:** Do NOT auto-commit. The user reviews and pushes all changes manually.

**Depends on:** Phase 1 (foundation), Phase 2 (ingestion/classification), Phase 5 (frontend restructure)

---

## File Map

### New files — Server
- `server/modules/matching/scorer.ts` — pure function: weighted scoring for two signals
- `server/modules/matching/service.ts` — find candidates, score, store matches, generate alerts
- `server/modules/matching/worker.ts` — pg-boss worker for match-signals jobs
- `server/modules/alerts/service.ts` — alerts CRUD (list, mark read, get counts)
- `server/modules/alerts/routes.ts` — alerts REST API

### New files — Frontend
- `client/src/api/alerts.ts` — alerts API functions
- `client/src/hooks/queries/useAlerts.ts` — TanStack Query hook for alerts

### New test files
- `server/__tests__/scorer.test.ts` — weighted scoring unit tests
- `server/__tests__/matching.test.ts` — matching service tests
- `server/__tests__/alerts.test.ts` — alerts service tests

### Modified files
- `server/modules/classification/worker.ts` — queue match-signals job after classification
- `server/app.ts` — register alerts routes
- `server/index.ts` — start matching worker
- `shared/schemas.ts` — add alert filter schema
- `client/src/pages/Dashboard.tsx` — replace alert placeholder with real data
- `client/src/components/DashboardLayout.tsx` — add unread alert badge on sidebar

---

## Task 1: Match Scorer (Pure Function)

**Files:**
- Create: `server/modules/matching/scorer.ts`
- Create: `server/__tests__/scorer.test.ts`

- [ ] **Step 1: Write failing tests for scorer**

Create `server/__tests__/scorer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { scoreMatch } from "../modules/matching/scorer.js";

const buyerSignal = {
  id: "buyer-1",
  type: "Buyer Search" as const,
  location: ["Hampstead", "Belsize Park"],
  budgetMin: null,
  budgetMax: 3_000_000,
  bedrooms: 3,
  propertyType: "House",
  createdAt: new Date().toISOString(),
};

const listingSignal = {
  id: "listing-1",
  type: "Property for Sale" as const,
  location: ["Hampstead"],
  budgetMin: null,
  budgetMax: 2_800_000,
  bedrooms: 3,
  propertyType: "House",
  createdAt: new Date().toISOString(),
};

describe("scoreMatch", () => {
  it("scores a perfect match above 0.9", () => {
    const result = scoreMatch(buyerSignal, listingSignal);
    expect(result.score).toBeGreaterThan(0.9);
    expect(result.reasons).toContain("area overlap");
    expect(result.reasons).toContain("budget fit");
    expect(result.reasons).toContain("bedroom match");
    expect(result.reasons).toContain("property type match");
  });

  it("scores zero when no area overlap", () => {
    const noOverlap = { ...listingSignal, location: ["Islington"] };
    const result = scoreMatch(buyerSignal, noOverlap);
    expect(result.score).toBeLessThan(0.5);
    expect(result.reasons).not.toContain("area overlap");
  });

  it("scores budget fit with 15% tolerance", () => {
    // Buyer budget 3m, listing price 3.4m (13% over) — should still fit
    const slightlyOver = { ...listingSignal, budgetMax: 3_400_000 };
    const result = scoreMatch(buyerSignal, slightlyOver);
    expect(result.reasons).toContain("budget fit");
  });

  it("fails budget fit when listing is >15% over buyer budget", () => {
    // Buyer budget 3m, listing price 4m (33% over) — too expensive
    const tooExpensive = { ...listingSignal, budgetMax: 4_000_000 };
    const result = scoreMatch(buyerSignal, tooExpensive);
    expect(result.reasons).not.toContain("budget fit");
  });

  it("scores bedroom match for exact match", () => {
    const result = scoreMatch(buyerSignal, listingSignal);
    expect(result.reasons).toContain("bedroom match");
  });

  it("scores bedroom match for ±1", () => {
    const fourBed = { ...listingSignal, bedrooms: 4 };
    const result = scoreMatch(buyerSignal, fourBed);
    expect(result.reasons).toContain("bedroom match");
  });

  it("fails bedroom match for ±2 or more", () => {
    const sixBed = { ...listingSignal, bedrooms: 6 };
    const result = scoreMatch(buyerSignal, sixBed);
    expect(result.reasons).not.toContain("bedroom match");
  });

  it("handles null budgets gracefully", () => {
    const noBudget = { ...buyerSignal, budgetMax: null };
    const result = scoreMatch(noBudget, listingSignal);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("handles null bedrooms gracefully", () => {
    const noBeds = { ...buyerSignal, bedrooms: null };
    const result = scoreMatch(noBeds, listingSignal);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("applies recency decay for old signals", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 45);
    const oldListing = { ...listingSignal, createdAt: oldDate.toISOString() };
    const freshResult = scoreMatch(buyerSignal, listingSignal);
    const oldResult = scoreMatch(buyerSignal, oldListing);
    expect(oldResult.score).toBeLessThan(freshResult.score);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test
```

- [ ] **Step 3: Implement scorer**

Create `server/modules/matching/scorer.ts`:

```typescript
interface MatchableSignal {
  id: string;
  type: string;
  location: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  bedrooms: number | null;
  propertyType: string | null;
  createdAt: string;
}

interface ScoreResult {
  score: number;
  reasons: string[];
}

const WEIGHTS = {
  area: 0.30,
  budget: 0.25,
  bedrooms: 0.20,
  propertyType: 0.15,
  recency: 0.10,
};

export function scoreMatch(
  demand: MatchableSignal,
  supply: MatchableSignal
): ScoreResult {
  let score = 0;
  const reasons: string[] = [];

  // Area overlap (30%)
  const demandAreas = new Set(demand.location.map((l) => l.toLowerCase()));
  const supplyAreas = new Set(supply.location.map((l) => l.toLowerCase()));
  let areaOverlap = 0;
  for (const area of demandAreas) {
    if (supplyAreas.has(area)) areaOverlap++;
  }
  if (areaOverlap > 0) {
    const overlapRatio = areaOverlap / Math.max(demandAreas.size, 1);
    score += WEIGHTS.area * overlapRatio;
    reasons.push("area overlap");
  }

  // Budget fit (25%) — listing price within buyer budget ±15%
  if (demand.budgetMax && supply.budgetMax) {
    const tolerance = demand.budgetMax * 0.15;
    if (supply.budgetMax <= demand.budgetMax + tolerance) {
      const ratio = Math.min(supply.budgetMax / demand.budgetMax, 1);
      score += WEIGHTS.budget * (ratio > 0.5 ? 1 : ratio * 2);
      reasons.push("budget fit");
    }
  } else if (!demand.budgetMax && !supply.budgetMax) {
    // Both unknown — neutral, give half weight
    score += WEIGHTS.budget * 0.5;
  }

  // Bedrooms (20%) — exact or ±1
  if (demand.bedrooms !== null && supply.bedrooms !== null) {
    const diff = Math.abs(demand.bedrooms - supply.bedrooms);
    if (diff === 0) {
      score += WEIGHTS.bedrooms;
      reasons.push("bedroom match");
    } else if (diff === 1) {
      score += WEIGHTS.bedrooms * 0.7;
      reasons.push("bedroom match");
    }
  } else if (demand.bedrooms === null && supply.bedrooms === null) {
    score += WEIGHTS.bedrooms * 0.5;
  }

  // Property type (15%)
  if (demand.propertyType && supply.propertyType) {
    if (
      demand.propertyType.toLowerCase() ===
      supply.propertyType.toLowerCase()
    ) {
      score += WEIGHTS.propertyType;
      reasons.push("property type match");
    }
  } else if (!demand.propertyType || !supply.propertyType) {
    score += WEIGHTS.propertyType * 0.5;
  }

  // Recency (10%) — newer signals score higher, >30 days decays
  const now = Date.now();
  const demandAge = (now - new Date(demand.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const supplyAge = (now - new Date(supply.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const avgAge = (demandAge + supplyAge) / 2;

  if (avgAge <= 7) {
    score += WEIGHTS.recency;
    reasons.push("recent");
  } else if (avgAge <= 30) {
    score += WEIGHTS.recency * (1 - (avgAge - 7) / 23);
  }
  // >30 days: no recency bonus

  return { score: Math.round(score * 100) / 100, reasons };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test
```

---

## Task 2: Matching Service

**Files:**
- Create: `server/modules/matching/service.ts`
- Create: `server/__tests__/matching.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/__tests__/matching.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { findAndStoreMatches } from "../modules/matching/service.js";

vi.mock("../db/connection.js", () => ({
  query: vi.fn(),
}));

import { query } from "../db/connection.js";
const mockQuery = vi.mocked(query);

describe("findAndStoreMatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds matching listings for a buyer search", async () => {
    // Mock: get the new signal
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "buyer-1",
          type: "Buyer Search",
          location: ["Hampstead"],
          budget_min: null,
          budget_max: 3000000,
          bedrooms: 3,
          property_type: "House",
          created_at: new Date().toISOString(),
          message_id: "msg-1",
        },
      ],
    } as any);

    // Mock: find opposite signals (Property for Sale)
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "listing-1",
          type: "Property for Sale",
          location: ["Hampstead"],
          budget_min: null,
          budget_max: 2800000,
          bedrooms: 3,
          property_type: "House",
          created_at: new Date().toISOString(),
          message_id: "msg-2",
        },
      ],
    } as any);

    // Mock: check existing match
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);

    // Mock: insert match
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "match-1" }],
    } as any);

    // Mock: get sender names for alert generation (2 queries)
    mockQuery.mockResolvedValueOnce({
      rows: [{ sender_name: "Scott Bennett" }],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [{ sender_name: "Jonathan Singer" }],
    } as any);

    // Mock: find agents with overlapping coverage
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "agent-1", name: "Agent One" }],
    } as any);

    // Mock: insert alerts (one per agent)
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "alert-1" }],
    } as any);

    const result = await findAndStoreMatches("buyer-1");
    expect(result.matchesFound).toBeGreaterThanOrEqual(1);
  });

  it("skips non-matchable signal types", async () => {
    // Mock: get signal — Social type (not matchable)
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "social-1",
          type: "Social",
          location: [],
          budget_min: null,
          budget_max: null,
          bedrooms: null,
          property_type: null,
          created_at: new Date().toISOString(),
          message_id: "msg-3",
        },
      ],
    } as any);

    const result = await findAndStoreMatches("social-1");
    expect(result.matchesFound).toBe(0);
  });

  it("skips duplicate matches", async () => {
    // Mock: get buyer signal
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "buyer-2",
          type: "Buyer Search",
          location: ["Hampstead"],
          budget_min: null,
          budget_max: 3000000,
          bedrooms: 3,
          property_type: "House",
          created_at: new Date().toISOString(),
          message_id: "msg-4",
        },
      ],
    } as any);

    // Mock: find listings
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "listing-2",
          type: "Property for Sale",
          location: ["Hampstead"],
          budget_min: null,
          budget_max: 2800000,
          bedrooms: 3,
          property_type: "House",
          created_at: new Date().toISOString(),
          message_id: "msg-5",
        },
      ],
    } as any);

    // Mock: match already exists
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "existing-match" }],
    } as any);

    const result = await findAndStoreMatches("buyer-2");
    expect(result.matchesFound).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test
```

- [ ] **Step 3: Implement matching service**

Create `server/modules/matching/service.ts`:

```typescript
import { query } from "../../db/connection.js";
import { scoreMatch } from "./scorer.js";

const MATCH_PAIRS: Record<string, string> = {
  "Buyer Search": "Property for Sale",
  "Property for Sale": "Buyer Search",
  "Tenant Search": "Property for Rent",
  "Property for Rent": "Tenant Search",
};

const MATCH_THRESHOLD = 0.5;

interface MatchResult {
  matchesFound: number;
  alertsCreated: number;
}

export async function findAndStoreMatches(
  signalId: string
): Promise<MatchResult> {
  // Get the new signal
  const signalResult = await query(
    `SELECT id, type, location, budget_min, budget_max, bedrooms,
            property_type, created_at, message_id
     FROM signals WHERE id = $1`,
    [signalId]
  );

  const signal = signalResult.rows[0];
  if (!signal) return { matchesFound: 0, alertsCreated: 0 };

  // Check if this signal type is matchable
  const oppositeType = MATCH_PAIRS[signal.type];
  if (!oppositeType) return { matchesFound: 0, alertsCreated: 0 };

  // Find opposite signals from the last 60 days
  const candidatesResult = await query(
    `SELECT id, type, location, budget_min, budget_max, bedrooms,
            property_type, created_at, message_id
     FROM signals
     WHERE type = $1
       AND actionable = true
       AND created_at > now() - interval '60 days'
       AND id != $2
     ORDER BY created_at DESC
     LIMIT 100`,
    [oppositeType, signalId]
  );

  let matchesFound = 0;
  let alertsCreated = 0;

  // Determine which is demand vs supply
  const isDemand = signal.type === "Buyer Search" || signal.type === "Tenant Search";

  for (const candidate of candidatesResult.rows) {
    const demand = isDemand ? signal : candidate;
    const supply = isDemand ? candidate : signal;

    const { score, reasons } = scoreMatch(
      {
        id: demand.id,
        type: demand.type,
        location: demand.location,
        budgetMin: demand.budget_min,
        budgetMax: demand.budget_max,
        bedrooms: demand.bedrooms,
        propertyType: demand.property_type,
        createdAt: demand.created_at,
      },
      {
        id: supply.id,
        type: supply.type,
        location: supply.location,
        budgetMin: supply.budget_min,
        budgetMax: supply.budget_max,
        bedrooms: supply.bedrooms,
        propertyType: supply.property_type,
        createdAt: supply.created_at,
      }
    );

    if (score < MATCH_THRESHOLD) continue;

    // Check for duplicate match (either direction)
    const existingMatch = await query(
      `SELECT id FROM matches
       WHERE (signal_a_id = $1 AND signal_b_id = $2)
          OR (signal_a_id = $2 AND signal_b_id = $1)`,
      [demand.id, supply.id]
    );

    if (existingMatch.rows.length > 0) continue;

    // Store the match
    const matchResult = await query(
      `INSERT INTO matches (signal_a_id, signal_b_id, match_score, match_reasons)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [demand.id, supply.id, score, reasons]
    );

    matchesFound++;

    // Generate alerts for agents whose coverage areas overlap
    const matchId = matchResult.rows[0].id;

    // Get sender names from messages to find relevant agents
    const demandSender = await query(
      "SELECT sender_name FROM messages WHERE id = $1",
      [demand.message_id]
    );
    const supplySender = await query(
      "SELECT sender_name FROM messages WHERE id = $1",
      [supply.message_id]
    );

    // Find agents whose coverage areas overlap with the match locations
    const allLocations = [
      ...new Set([...demand.location, ...supply.location]),
    ];

    if (allLocations.length > 0) {
      const agentsResult = await query(
        `SELECT id, name FROM agents
         WHERE is_active = true
           AND coverage_areas && $1`,
        [allLocations]
      );

      for (const agent of agentsResult.rows) {
        const demandName = demandSender.rows[0]?.sender_name ?? "Unknown";
        const supplyName = supplySender.rows[0]?.sender_name ?? "Unknown";

        const summary = isDemand
          ? `${demandName}'s ${demand.type} matches ${supplyName}'s ${supply.type} in ${allLocations.join(", ")} (score: ${score})`
          : `${supplyName}'s ${supply.type} matches ${demandName}'s ${demand.type} in ${allLocations.join(", ")} (score: ${score})`;

        await query(
          `INSERT INTO alerts (agent_id, signal_id, match_id, type, priority, summary)
           VALUES ($1, $2, $3, 'match_found', $4, $5)`,
          [
            agent.id,
            signal.id,
            matchId,
            score >= 0.8 ? "high" : score >= 0.6 ? "medium" : "low",
            summary,
          ]
        );

        alertsCreated++;
      }
    }
  }

  return { matchesFound, alertsCreated };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test
```

---

## Task 3: Matching Worker & Pipeline Integration

**Files:**
- Create: `server/modules/matching/worker.ts`
- Modify: `server/modules/classification/worker.ts` — queue match job after classification
- Modify: `server/index.ts` — start matching worker

- [ ] **Step 1: Create matching worker**

Create `server/modules/matching/worker.ts`:

```typescript
import { PgBoss } from "pg-boss";
import { findAndStoreMatches } from "./service.js";

export async function startMatchingWorker(boss: PgBoss) {
  await boss.createQueue("match-signals");

  await boss.work(
    "match-signals",
    { localConcurrency: 3 },
    async (jobs) => {
      for (const job of jobs) {
        const { signalId } = job.data as { signalId: string };

        console.log(`Matching signal ${signalId}...`);

        const result = await findAndStoreMatches(signalId);

        if (result.matchesFound > 0) {
          console.log(
            `  → ${result.matchesFound} match(es) found, ${result.alertsCreated} alert(s) created`
          );
        } else {
          console.log(`  → no matches`);
        }
      }
    }
  );

  console.log("Matching worker started (listening for match-signals jobs)");
}
```

- [ ] **Step 2: Queue match job after classification**

In `server/modules/classification/worker.ts`, after the classification succeeds and a signal is produced, queue a matching job. Read the file first.

After the `if (result)` block that logs the classification, add:

```typescript
        // Queue matching if signal is matchable
        if (
          result &&
          result.actionable &&
          ["Buyer Search", "Tenant Search", "Property for Sale", "Property for Rent"].includes(result.type)
        ) {
          await boss.send("match-signals", { signalId: result.signalId });
        }
```

Note: `boss` is the PgBoss instance passed to the worker function — it's already in scope.

- [ ] **Step 3: Start matching worker in server/index.ts**

Read `server/index.ts`. After the classification worker starts, add:

```typescript
  const { startMatchingWorker } = await import(
    "./modules/matching/worker.js"
  );
  await startMatchingWorker(await getBoss());
```

- [ ] **Step 4: Verify**

```bash
pnpm check
pnpm test
```

---

## Task 4: Alerts Service & Routes

**Files:**
- Create: `server/modules/alerts/service.ts`
- Create: `server/modules/alerts/routes.ts`
- Create: `server/__tests__/alerts-service.test.ts`
- Modify: `shared/schemas.ts` — add alert filter schema
- Modify: `server/app.ts` — register alerts routes

- [ ] **Step 1: Add alert schema to shared/schemas.ts**

Append to the end:

```typescript
// ============================================================
// Alert schemas (Phase 3)
// ============================================================

export const alertFilterSchema = z.object({
  read: z.coerce.boolean().optional(),
  type: z.enum(["new_signal", "match_found", "review_needed"]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateAlertSchema = z.object({
  read: z.boolean(),
});

export const updateMatchSchema = z.object({
  status: z.enum(["confirmed", "dismissed"]),
});
```

- [ ] **Step 2: Write failing tests**

Create `server/__tests__/alerts-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAlerts, markAlertRead, getUnreadCount } from "../modules/alerts/service.js";

vi.mock("../db/connection.js", () => ({
  query: vi.fn(),
}));

import { query } from "../db/connection.js";
const mockQuery = vi.mocked(query);

describe("alerts service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listAlerts", () => {
    it("returns paginated alerts for agent", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: "5" }] } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              id: "alert-1",
              agent_id: "agent-1",
              signal_id: "sig-1",
              match_id: "match-1",
              type: "match_found",
              priority: "high",
              summary: "Match found",
              read: false,
              read_at: null,
              delivered_via: ["in_app"],
              created_at: "2026-04-06",
              updated_at: "2026-04-06",
            },
          ],
        } as any);

      const result = await listAlerts("agent-1", { page: 1, limit: 20 });
      expect(result.total).toBe(5);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe("match_found");
    });
  });

  describe("getUnreadCount", () => {
    it("returns unread count for agent", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: "3" }],
      } as any);

      const count = await getUnreadCount("agent-1");
      expect(count).toBe(3);
    });
  });

  describe("markAlertRead", () => {
    it("marks alert as read", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "alert-1",
            agent_id: "agent-1",
            signal_id: "sig-1",
            match_id: null,
            type: "match_found",
            priority: "high",
            summary: "Match",
            read: true,
            read_at: "2026-04-06T12:00:00Z",
            delivered_via: ["in_app"],
            created_at: "2026-04-06",
            updated_at: "2026-04-06",
          },
        ],
      } as any);

      const result = await markAlertRead("alert-1", "agent-1");
      expect(result).not.toBeNull();
      expect(result!.read).toBe(true);
    });
  });
});
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
pnpm test
```

- [ ] **Step 4: Implement alerts service**

Create `server/modules/alerts/service.ts`:

```typescript
import { query } from "../../db/connection.js";

interface AlertRow {
  id: string;
  agent_id: string;
  signal_id: string;
  match_id: string | null;
  type: string;
  priority: string;
  summary: string;
  read: boolean;
  read_at: string | null;
  delivered_via: string[];
  created_at: string;
  updated_at: string;
}

function toAlert(row: AlertRow) {
  return {
    id: row.id,
    agentId: row.agent_id,
    signalId: row.signal_id,
    matchId: row.match_id,
    type: row.type,
    priority: row.priority,
    summary: row.summary,
    read: row.read,
    readAt: row.read_at,
    deliveredVia: row.delivered_via,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAlerts(
  agentId: string,
  opts: {
    page: number;
    limit: number;
    read?: boolean;
    type?: string;
    priority?: string;
  }
) {
  const conditions: string[] = ["agent_id = $1"];
  const values: unknown[] = [agentId];
  let paramIndex = 2;

  if (opts.read !== undefined) {
    conditions.push(`read = $${paramIndex++}`);
    values.push(opts.read);
  }
  if (opts.type) {
    conditions.push(`type = $${paramIndex++}`);
    values.push(opts.type);
  }
  if (opts.priority) {
    conditions.push(`priority = $${paramIndex++}`);
    values.push(opts.priority);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const countResult = await query(
    `SELECT count(*) FROM alerts ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (opts.page - 1) * opts.limit;
  const result = await query<AlertRow>(
    `SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, opts.limit, offset]
  );

  return { alerts: result.rows.map(toAlert), total };
}

export async function getUnreadCount(agentId: string): Promise<number> {
  const result = await query(
    "SELECT count(*) FROM alerts WHERE agent_id = $1 AND read = false",
    [agentId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function markAlertRead(alertId: string, agentId: string) {
  const result = await query<AlertRow>(
    `UPDATE alerts SET read = true, read_at = now(), updated_at = now()
     WHERE id = $1 AND agent_id = $2
     RETURNING *`,
    [alertId, agentId]
  );
  return result.rows[0] ? toAlert(result.rows[0]) : null;
}

export async function markAllRead(agentId: string): Promise<number> {
  const result = await query(
    `UPDATE alerts SET read = true, read_at = now(), updated_at = now()
     WHERE agent_id = $1 AND read = false`,
    [agentId]
  );
  return result.rowCount ?? 0;
}

export async function updateMatchStatus(
  matchId: string,
  agentId: string,
  status: "confirmed" | "dismissed"
) {
  const result = await query(
    `UPDATE matches SET status = $1, confirmed_by = $2, updated_at = now()
     WHERE id = $3 RETURNING id, status`,
    [status, agentId, matchId]
  );
  return result.rows[0] ?? null;
}
```

- [ ] **Step 5: Create alerts routes**

Create `server/modules/alerts/routes.ts`:

```typescript
import { Router } from "express";
import {
  alertFilterSchema,
  updateAlertSchema,
  updateMatchSchema,
} from "@shared/schemas.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";
import { createError } from "../../middleware/error.js";
import {
  listAlerts,
  getUnreadCount,
  markAlertRead,
  markAllRead,
  updateMatchStatus,
} from "./service.js";

export function alertsRoutes(): Router {
  const router = Router();

  router.use(requireAuth);

  // GET /api/alerts — list alerts for current agent
  router.get("/", async (req: AuthenticatedRequest, res, next) => {
    try {
      const filters = alertFilterSchema.parse(req.query);
      const result = await listAlerts(req.agent!.id, filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/alerts/unread-count
  router.get(
    "/unread-count",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const count = await getUnreadCount(req.agent!.id);
        res.json({ count });
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/alerts/mark-all-read
  router.post(
    "/mark-all-read",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const updated = await markAllRead(req.agent!.id);
        res.json({ updated });
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /api/alerts/:id — mark single alert read
  router.patch(
    "/:id",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = updateAlertSchema.safeParse(req.body);
        if (!parsed.success) throw createError(400, "Invalid data");

        const alert = await markAlertRead(req.params.id, req.agent!.id);
        if (!alert) throw createError(404, "Alert not found");
        res.json(alert);
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /api/alerts/matches/:id — confirm/dismiss a match
  router.patch(
    "/matches/:id",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = updateMatchSchema.safeParse(req.body);
        if (!parsed.success) throw createError(400, "Invalid data");

        const match = await updateMatchStatus(
          req.params.id,
          req.agent!.id,
          parsed.data.status
        );
        if (!match) throw createError(404, "Match not found");
        res.json(match);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
```

- [ ] **Step 6: Register alerts routes in server/app.ts**

Add import:
```typescript
import { alertsRoutes } from "./modules/alerts/routes.js";
```

Add route after existing registrations:
```typescript
  app.use("/api/alerts", alertsRoutes());
```

- [ ] **Step 7: Run tests — verify they pass**

```bash
pnpm test
pnpm check
```

---

## Task 5: Frontend Alerts API & Hook

**Files:**
- Create: `client/src/api/alerts.ts`
- Create: `client/src/hooks/queries/useAlerts.ts`

- [ ] **Step 1: Create alerts API**

Create `client/src/api/alerts.ts`:

```typescript
import api from "./client";

export interface AlertFilters {
  read?: boolean;
  type?: string;
  priority?: string;
  page?: number;
  limit?: number;
}

export async function getAlerts(filters: AlertFilters = {}) {
  const { data } = await api.get("/alerts", { params: filters });
  return data as { alerts: any[]; total: number };
}

export async function getUnreadCount() {
  const { data } = await api.get("/alerts/unread-count");
  return data as { count: number };
}

export async function markAlertRead(id: string) {
  const { data } = await api.patch(`/alerts/${id}`, { read: true });
  return data;
}

export async function markAllAlertsRead() {
  const { data } = await api.post("/alerts/mark-all-read");
  return data;
}

export async function updateMatchStatus(
  matchId: string,
  status: "confirmed" | "dismissed"
) {
  const { data } = await api.patch(`/alerts/matches/${matchId}`, { status });
  return data;
}
```

- [ ] **Step 2: Create alerts query hook**

Create `client/src/hooks/queries/useAlerts.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAlerts,
  getUnreadCount,
  markAlertRead,
  markAllAlertsRead,
  updateMatchStatus,
  type AlertFilters,
} from "@/api/alerts";

export function useAlerts(filters: AlertFilters = {}) {
  return useQuery({
    queryKey: ["alerts", filters],
    queryFn: () => getAlerts(filters),
  });
}

export function useUnreadAlertCount() {
  return useQuery({
    queryKey: ["alerts", "unread-count"],
    queryFn: getUnreadCount,
    refetchInterval: 15 * 1000, // Poll every 15s
  });
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markAlertRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllAlertsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useUpdateMatchStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      matchId,
      status,
    }: {
      matchId: string;
      status: "confirmed" | "dismissed";
    }) => updateMatchStatus(matchId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
```

---

## Task 6: Connect Dashboard Alerts & Sidebar Badge

**Files:**
- Modify: `client/src/pages/Dashboard.tsx` — replace alert placeholder
- Modify: `client/src/components/DashboardLayout.tsx` — add unread badge

- [ ] **Step 1: Update Dashboard alerts section**

In `client/src/pages/Dashboard.tsx`, find the "Alert history coming soon" placeholder. Replace with real alerts data.

Add import:
```typescript
import { useAlerts } from "@/hooks/queries/useAlerts";
```

Inside the component, add:
```typescript
const { data: alertsData } = useAlerts({ limit: 10 });
const alerts = alertsData?.alerts ?? [];
```

Replace the placeholder rows in the Alert Activity table with a map over `alerts`:

```tsx
{alerts.length === 0 ? (
  <tr>
    <td colSpan={4} className="text-center py-6 text-[#6b7280] text-sm">
      No alerts yet — ingest messages to generate matches
    </td>
  </tr>
) : (
  alerts.map((alert: any) => (
    <tr key={alert.id} className="border-b border-[#2a2f35]">
      <td className="py-2 px-3 text-xs text-[#9ca3af]">
        {new Date(alert.createdAt).toLocaleString()}
      </td>
      <td className="py-2 px-3">
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
          alert.priority === "high" ? "bg-red-500/20 text-red-400" :
          alert.priority === "medium" ? "bg-yellow-500/20 text-yellow-400" :
          "bg-green-500/20 text-green-400"
        }`}>{alert.priority}</span>
      </td>
      <td className="py-2 px-3 text-xs text-[#f1f2f7]">{alert.summary}</td>
      <td className="py-2 px-3 text-xs text-[#6b7280]">{alert.type}</td>
    </tr>
  ))
)}
```

- [ ] **Step 2: Add unread alert badge to sidebar**

In `client/src/components/DashboardLayout.tsx`, add import:
```typescript
import { useUnreadAlertCount } from "@/hooks/queries/useAlerts";
```

Inside the component, add:
```typescript
const { data: unreadData } = useUnreadAlertCount();
const unreadCount = unreadData?.count ?? 0;
```

Find the Alerts nav item (the one with `path: "/alerts"` and `icon: Bell`). Add a badge after the Bell icon:

```tsx
{item.path === "/alerts" && unreadCount > 0 && (
  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center">
    {unreadCount > 9 ? "9+" : unreadCount}
  </span>
)}
```

- [ ] **Step 3: Verify**

```bash
pnpm check
pnpm dev
```

Navigate to Dashboard — alerts section should show real data (or "No alerts yet").
Sidebar should show unread badge when alerts exist.

---

## Task 7: Final Verification

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: All tests pass (63 existing + new scorer/matching/alerts tests).

- [ ] **Step 2: TypeScript check**

```bash
pnpm check
```

- [ ] **Step 3: End-to-end test**

With both servers running, ingest two complementary messages:

```bash
# Buyer search
curl -X POST http://localhost:3001/api/messages/ingest \
  -H "Content-Type: application/json" \
  -H "Cookie: ddre_session=YOUR_SESSION_ID" \
  -d '{"sourceGroup":"DDRE Agents","senderName":"Scott Bennett","rawText":"New buyer looking for 3 bed house in Hampstead, budget £3m, needs garden"}'

# Matching listing
curl -X POST http://localhost:3001/api/messages/ingest \
  -H "Content-Type: application/json" \
  -H "Cookie: ddre_session=YOUR_SESSION_ID" \
  -d '{"sourceGroup":"DDRE Agents","senderName":"Jonathan Singer","rawText":"Just listed: 3 bed house in Hampstead, £2.8m, garden, 1400 sqft"}'
```

Backend terminal should show:
```
Classifying message ...
  → Buyer Search (rules, confidence: 0.92)
Matching signal ...
  → 0 matches (no listings yet)

Classifying message ...
  → Property for Sale (rules, confidence: 0.93)
Matching signal ...
  → 1 match(es) found, N alert(s) created
```

Dashboard should show the alert in the Alert Activity section.
