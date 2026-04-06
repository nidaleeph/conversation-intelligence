# Phase 6: Analytics, Audit & Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add audit trail logging to all system actions, enhance analytics with classification health metrics and agent activity, and improve mobile responsiveness — completing the production feature set.

**Architecture:** Create a reusable `logAudit()` function that inserts into the existing `audit_log` table. Sprinkle calls into existing services/routes (fire-and-forget, never blocks the main operation). Add new analytics endpoints for classification health and agent activity. Add an audit log viewer API. Improve CSS for mobile breakpoints.

**Tech Stack:** PostgreSQL (audit_log table already exists), Express, TanStack Query, Tailwind CSS (responsive)

**Note:** Do NOT auto-commit. The user reviews and pushes all changes manually.

**Depends on:** All previous phases complete (79 tests passing).

---

## File Map

### New files — Server
- `server/modules/audit/service.ts` — `logAudit()` helper + `listAuditLog()` query
- `server/modules/audit/routes.ts` — GET /api/audit (admin only)

### New files — Frontend
- `client/src/api/audit.ts` — audit log API functions
- `client/src/hooks/queries/useAudit.ts` — audit log query hook

### Modified files — Server (audit calls)
- `server/modules/ingestion/service.ts` — log `message_received`
- `server/modules/classification/pipeline.ts` — log `signal_classified`
- `server/modules/signals/routes.ts` — log `signal_reviewed`
- `server/modules/matching/service.ts` — log `match_found`
- `server/modules/alerts/service.ts` — log `alert_read`
- `server/modules/alerts/routes.ts` — log `match_confirmed`, `match_dismissed`
- `server/modules/agents/routes.ts` — log `agent_invited`, `agent_deactivated`
- `server/modules/auth/routes.ts` — log `login`

### Modified files — Server (analytics)
- `server/modules/analytics/service.ts` — add `getClassificationHealth()`, `getAgentActivity()`, `getSignalVolume()`
- `server/modules/analytics/routes.ts` — register new endpoints

### Modified files — Frontend (analytics)
- `client/src/api/analytics.ts` — add new API functions
- `client/src/hooks/queries/useAnalytics.ts` — add new hooks
- `server/app.ts` — register audit routes

### Modified files — Frontend (mobile)
- `client/src/components/DashboardLayout.tsx` — mobile sidebar toggle
- `client/src/pages/Dashboard.tsx` — responsive grid improvements

---

## Task 1: Audit Service

**Files:**
- Create: `server/modules/audit/service.ts`
- Create: `server/__tests__/audit.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/__tests__/audit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAudit, listAuditLog } from "../modules/audit/service.js";

vi.mock("../db/connection.js", () => ({
  query: vi.fn(),
}));

import { query } from "../db/connection.js";
const mockQuery = vi.mocked(query);

describe("audit service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logAudit", () => {
    it("inserts an audit log entry", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "audit-1" }] } as any);

      await logAudit({
        agentId: "agent-1",
        action: "signal_reviewed",
        entityType: "signal",
        entityId: "signal-1",
        metadata: { approved: true },
      });

      expect(mockQuery).toHaveBeenCalledOnce();
      expect(mockQuery.mock.calls[0][0]).toContain("INSERT INTO audit_log");
    });

    it("handles null agentId for system actions", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "audit-2" }] } as any);

      await logAudit({
        agentId: null,
        action: "message_received",
        entityType: "message",
        entityId: "msg-1",
      });

      expect(mockQuery).toHaveBeenCalledOnce();
    });
  });

  describe("listAuditLog", () => {
    it("returns paginated audit entries", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: "25" }] } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              id: "audit-1",
              agent_id: "agent-1",
              action: "signal_reviewed",
              entity_type: "signal",
              entity_id: "signal-1",
              metadata: { approved: true },
              created_at: "2026-04-06T12:00:00Z",
            },
          ],
        } as any);

      const result = await listAuditLog({ page: 1, limit: 20 });
      expect(result.total).toBe(25);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].action).toBe("signal_reviewed");
    });

    it("filters by entity type", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: "5" }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await listAuditLog({ page: 1, limit: 20, entityType: "signal" });

      expect(mockQuery.mock.calls[0][0]).toContain("entity_type = $");
    });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test
```

- [ ] **Step 3: Implement audit service**

Create `server/modules/audit/service.ts`:

```typescript
import { query } from "../../db/connection.js";

interface AuditInput {
  agentId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (agent_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.agentId,
        input.action,
        input.entityType,
        input.entityId,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
  } catch (err) {
    // Audit logging should never break the main operation
    console.error("Audit log failed:", err);
  }
}

interface AuditRow {
  id: string;
  agent_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function toAuditEntry(row: AuditRow) {
  return {
    id: row.id,
    agentId: row.agent_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export async function listAuditLog(opts: {
  page: number;
  limit: number;
  entityType?: string;
  action?: string;
  agentId?: string;
}) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (opts.entityType) {
    conditions.push(`entity_type = $${paramIndex++}`);
    values.push(opts.entityType);
  }
  if (opts.action) {
    conditions.push(`action = $${paramIndex++}`);
    values.push(opts.action);
  }
  if (opts.agentId) {
    conditions.push(`agent_id = $${paramIndex++}`);
    values.push(opts.agentId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query(
    `SELECT count(*) FROM audit_log ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (opts.page - 1) * opts.limit;
  const result = await query<AuditRow>(
    `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, opts.limit, offset]
  );

  return { entries: result.rows.map(toAuditEntry), total };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test
```

---

## Task 2: Audit Routes & API

**Files:**
- Create: `server/modules/audit/routes.ts`
- Modify: `server/app.ts` — register audit routes
- Modify: `shared/schemas.ts` — add audit filter schema

- [ ] **Step 1: Add audit schema to `shared/schemas.ts`**

Append:

```typescript
// ============================================================
// Audit schemas (Phase 6)
// ============================================================

export const auditFilterSchema = z.object({
  entityType: z.string().optional(),
  action: z.string().optional(),
  agentId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
```

- [ ] **Step 2: Create audit routes**

Create `server/modules/audit/routes.ts`:

```typescript
import { Router } from "express";
import { auditFilterSchema } from "@shared/schemas.js";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../../middleware/auth.js";
import { listAuditLog } from "./service.js";

export function auditRoutes(): Router {
  const router = Router();

  router.use(requireAuth);
  router.use(requireAdmin);

  // GET /api/audit — admin only
  router.get("/", async (req, res, next) => {
    try {
      const filters = auditFilterSchema.parse(req.query);
      const result = await listAuditLog(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 3: Register in server/app.ts**

Add import:
```typescript
import { auditRoutes } from "./modules/audit/routes.js";
```

Add route:
```typescript
  app.use("/api/audit", auditRoutes());
```

- [ ] **Step 4: Verify**

```bash
pnpm check
pnpm test
```

---

## Task 3: Sprinkle Audit Calls Into Existing Code

**Files to modify:** 8 existing files — add `logAudit()` calls, all fire-and-forget (don't await, don't block).

- [ ] **Step 1: `server/modules/ingestion/service.ts` — log `message_received`**

After the message INSERT (where `const messageId = result.rows[0].id;`), add:

```typescript
  // Audit: message_received
  import("../audit/service.js").then(({ logAudit }) =>
    logAudit({ agentId: null, action: "message_received", entityType: "message", entityId: messageId })
  ).catch(() => {});
```

- [ ] **Step 2: `server/modules/classification/pipeline.ts` — log `signal_classified`**

Before the return at the end of `classifyMessage`, add:

```typescript
  // Audit: signal_classified
  import("../audit/service.js").then(({ logAudit }) =>
    logAudit({
      agentId: null,
      action: "signal_classified",
      entityType: "signal",
      entityId: result.rows[0].id,
      metadata: { type, method, confidence },
    })
  ).catch(() => {});
```

- [ ] **Step 3: `server/modules/signals/routes.ts` — log `signal_reviewed`**

In the POST `/:id/review` handler, after `reviewSignal` succeeds, add:

```typescript
        // Audit: signal_reviewed
        import("../audit/service.js").then(({ logAudit }) =>
          logAudit({
            agentId: req.agent!.id,
            action: "signal_reviewed",
            entityType: "signal",
            entityId: req.params.id,
            metadata: parsed.data,
          })
        ).catch(() => {});
```

- [ ] **Step 4: `server/modules/matching/service.ts` — log `match_found`**

After each match INSERT (after `matchesFound++;`), add:

```typescript
      // Audit: match_found
      import("../audit/service.js").then(({ logAudit }) =>
        logAudit({
          agentId: null,
          action: "match_found",
          entityType: "match",
          entityId: matchId,
          metadata: { score, reasons, demandId: demand.id, supplyId: supply.id },
        })
      ).catch(() => {});
```

- [ ] **Step 5: `server/modules/alerts/service.ts` — log `alert_read`**

In `markAlertRead`, after the UPDATE succeeds, add:

```typescript
  // Audit: alert_read
  if (result.rows[0]) {
    import("../audit/service.js").then(({ logAudit }) =>
      logAudit({
        agentId: agentId,
        action: "alert_read",
        entityType: "alert",
        entityId: alertId,
      })
    ).catch(() => {});
  }
```

- [ ] **Step 6: `server/modules/alerts/routes.ts` — log `match_confirmed` / `match_dismissed`**

In the PATCH `/matches/:id` handler, after `updateMatchStatus` succeeds, add:

```typescript
        // Audit: match_confirmed or match_dismissed
        import("../audit/service.js").then(({ logAudit }) =>
          logAudit({
            agentId: req.agent!.id,
            action: parsed.data.status === "confirmed" ? "match_confirmed" : "match_dismissed",
            entityType: "match",
            entityId: req.params.id,
          })
        ).catch(() => {});
```

- [ ] **Step 7: `server/modules/agents/routes.ts` — log `agent_invited` and `agent_deactivated`**

In POST `/` (create agent), after success, add:

```typescript
        // Audit: agent_invited
        import("../audit/service.js").then(({ logAudit }) =>
          logAudit({
            agentId: req.agent!.id,
            action: "agent_invited",
            entityType: "agent",
            entityId: agent.id,
            metadata: { name: agent.name, email: agent.email },
          })
        ).catch(() => {});
```

In PATCH `/:id` (update agent), when `isActive === false`, add:

```typescript
          // Audit: agent_deactivated
          import("../audit/service.js").then(({ logAudit }) =>
            logAudit({
              agentId: req.agent!.id,
              action: "agent_deactivated",
              entityType: "agent",
              entityId: req.params.id,
            })
          ).catch(() => {});
```

- [ ] **Step 8: `server/modules/auth/routes.ts` — log `login`**

In POST `/login`, after `createMagicLinkToken` returns a token (inside the `if (token)` block), add:

```typescript
          // Audit: login
          import("../audit/service.js").then(({ logAudit }) =>
            logAudit({
              agentId: null,
              action: "login",
              entityType: "agent",
              entityId: "unknown",
              metadata: { email: parsed.data.email },
            })
          ).catch(() => {});
```

- [ ] **Step 9: Verify all tests still pass**

```bash
pnpm check
pnpm test
```

All 79+ tests should pass (audit calls are fire-and-forget dynamic imports, won't affect mocked tests).

---

## Task 4: Enhanced Analytics — Classification Health & Agent Activity

**Files:**
- Modify: `server/modules/analytics/service.ts` — add 3 new functions
- Modify: `server/modules/analytics/routes.ts` — add 3 new endpoints
- Modify: `client/src/api/analytics.ts` — add new API functions
- Modify: `client/src/hooks/queries/useAnalytics.ts` — add new hooks

- [ ] **Step 1: Add classification health and agent activity queries**

Append to `server/modules/analytics/service.ts`:

```typescript
export async function getClassificationHealth() {
  const [reviewQueue, avgConfidence, methodSplit, recentTrend] = await Promise.all([
    // Review queue depth
    query("SELECT count(*) FROM signals WHERE confidence < 0.85 AND status = 'new'"),

    // Average confidence by method
    query(`
      SELECT classification_method as method, 
             round(avg(confidence)::numeric, 3) as avg_confidence,
             count(*) as count
      FROM signals
      GROUP BY classification_method
    `),

    // Rules vs LLM split
    query(`
      SELECT classification_method as method, count(*) as count
      FROM signals
      GROUP BY classification_method
    `),

    // Confidence trend over last 7 days
    query(`
      SELECT date_trunc('day', created_at)::date as day,
             round(avg(confidence)::numeric, 3) as avg_confidence,
             count(*) as count
      FROM signals
      WHERE created_at > now() - interval '7 days'
      GROUP BY day
      ORDER BY day
    `),
  ]);

  const totalSignals = methodSplit.rows.reduce((sum: number, r: any) => sum + parseInt(r.count, 10), 0);

  return {
    reviewQueueDepth: parseInt(reviewQueue.rows[0].count, 10),
    confidenceByMethod: avgConfidence.rows.map((r: any) => ({
      method: r.method,
      avgConfidence: parseFloat(r.avg_confidence),
      count: parseInt(r.count, 10),
    })),
    methodSplit: methodSplit.rows.map((r: any) => ({
      method: r.method,
      count: parseInt(r.count, 10),
      percentage: totalSignals > 0 ? Math.round((parseInt(r.count, 10) / totalSignals) * 100) : 0,
    })),
    confidenceTrend: recentTrend.rows.map((r: any) => ({
      day: r.day,
      avgConfidence: parseFloat(r.avg_confidence),
      count: parseInt(r.count, 10),
    })),
  };
}

export async function getAgentActivity() {
  const result = await query(`
    SELECT a.id, a.name, a.email,
           coalesce(reviews.count, 0) as reviews,
           coalesce(alert_reads.count, 0) as alerts_read,
           coalesce(match_actions.count, 0) as match_actions
    FROM agents a
    LEFT JOIN (
      SELECT reviewed_by as agent_id, count(*) FROM signals WHERE reviewed_by IS NOT NULL GROUP BY reviewed_by
    ) reviews ON reviews.agent_id = a.id
    LEFT JOIN (
      SELECT agent_id, count(*) FROM alerts WHERE read = true GROUP BY agent_id
    ) alert_reads ON alert_reads.agent_id = a.id
    LEFT JOIN (
      SELECT confirmed_by as agent_id, count(*) FROM matches WHERE confirmed_by IS NOT NULL GROUP BY confirmed_by
    ) match_actions ON match_actions.agent_id = a.id
    WHERE a.is_active = true
    ORDER BY reviews DESC
  `);

  return result.rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    reviews: parseInt(r.reviews, 10),
    alertsRead: parseInt(r.alerts_read, 10),
    matchActions: parseInt(r.match_actions, 10),
  }));
}

export async function getSignalVolume() {
  const result = await query(`
    SELECT date_trunc('day', created_at)::date as day,
           count(*) as total,
           count(*) FILTER (WHERE actionable = true) as actionable
    FROM signals
    WHERE created_at > now() - interval '30 days'
    GROUP BY day
    ORDER BY day
  `);

  return result.rows.map((r: any) => ({
    day: r.day,
    total: parseInt(r.total, 10),
    actionable: parseInt(r.actionable, 10),
  }));
}
```

- [ ] **Step 2: Add new routes**

In `server/modules/analytics/routes.ts`, add imports and routes:

```typescript
import { getKPIs, getDistributions, getClassificationHealth, getAgentActivity, getSignalVolume } from "./service.js";
```

Add these routes:

```typescript
  router.get("/classification-health", async (_req, res, next) => {
    try {
      const health = await getClassificationHealth();
      res.json(health);
    } catch (err) {
      next(err);
    }
  });

  router.get("/agent-activity", async (_req, res, next) => {
    try {
      const activity = await getAgentActivity();
      res.json(activity);
    } catch (err) {
      next(err);
    }
  });

  router.get("/signal-volume", async (_req, res, next) => {
    try {
      const volume = await getSignalVolume();
      res.json(volume);
    } catch (err) {
      next(err);
    }
  });
```

- [ ] **Step 3: Add frontend API functions**

Append to `client/src/api/analytics.ts`:

```typescript
export async function getClassificationHealth() {
  const { data } = await api.get("/analytics/classification-health");
  return data;
}

export async function getAgentActivity() {
  const { data } = await api.get("/analytics/agent-activity");
  return data;
}

export async function getSignalVolume() {
  const { data } = await api.get("/analytics/signal-volume");
  return data;
}
```

- [ ] **Step 4: Add frontend hooks**

Append to `client/src/hooks/queries/useAnalytics.ts`:

```typescript
import { getKPIs, getDistributions, getClassificationHealth, getAgentActivity, getSignalVolume } from "@/api/analytics";
```

(Replace the existing import line that only imports `getKPIs, getDistributions`.)

```typescript
export function useClassificationHealth() {
  return useQuery({
    queryKey: ["analytics", "classification-health"],
    queryFn: getClassificationHealth,
    refetchInterval: 60 * 1000,
  });
}

export function useAgentActivity() {
  return useQuery({
    queryKey: ["analytics", "agent-activity"],
    queryFn: getAgentActivity,
  });
}

export function useSignalVolume() {
  return useQuery({
    queryKey: ["analytics", "signal-volume"],
    queryFn: getSignalVolume,
    refetchInterval: 60 * 1000,
  });
}
```

- [ ] **Step 5: Verify**

```bash
pnpm check
pnpm test
```

---

## Task 5: Mobile Responsive Improvements

**Files:**
- Modify: `client/src/components/DashboardLayout.tsx` — mobile sidebar toggle
- Modify: `client/src/index.css` — add mobile utility if needed

- [ ] **Step 1: Add mobile sidebar toggle to DashboardLayout**

Read `client/src/components/DashboardLayout.tsx`. The sidebar is a fixed 60px icon rail. On mobile, it takes too much space and there's no way to dismiss it.

Add a mobile menu button and overlay. Add `useState` import (check if already imported), and `Menu` from lucide-react.

At the top of the component:

```typescript
const [sidebarOpen, setSidebarOpen] = useState(false);
```

Wrap the `<aside>` with responsive visibility:

Change the `<aside>` className from:
```
className="w-[60px] flex flex-col items-center py-4 bg-[#16191e] border-r border-[#2a2f35] shrink-0"
```
To:
```
className={`w-[60px] flex flex-col items-center py-4 bg-[#16191e] border-r border-[#2a2f35] shrink-0 
  fixed md:relative z-50 h-full transition-transform duration-200
  ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
```

Add a mobile menu button before the `<aside>`:

```tsx
{/* Mobile menu button */}
<button
  onClick={() => setSidebarOpen(!sidebarOpen)}
  className="md:hidden fixed top-3 left-3 z-50 w-8 h-8 flex items-center justify-center rounded-lg bg-[#22272d] text-[#6b7280]"
>
  <Menu className="w-4 h-4" />
</button>
```

Add a backdrop overlay when sidebar is open on mobile:

```tsx
{sidebarOpen && (
  <div
    className="md:hidden fixed inset-0 bg-black/50 z-40"
    onClick={() => setSidebarOpen(false)}
  />
)}
```

Close sidebar on nav click (mobile only) — in each nav Link's onClick:

```tsx
onClick={() => setSidebarOpen(false)}
```

- [ ] **Step 2: Add padding for mobile menu button**

In the main content area, add left padding on mobile to avoid overlap with the menu button:

Change the content wrapper from:
```
className="flex-1 overflow-auto"
```
To:
```
className="flex-1 overflow-auto pl-0 md:pl-0"
```

(The actual padding comes from individual page components already having `p-6`.)

- [ ] **Step 3: Verify on mobile**

Open the app and use browser DevTools (F12 → toggle device toolbar → select a mobile device). The sidebar should be hidden by default with a hamburger button to open it.

```bash
pnpm check
```

---

## Task 6: Frontend Audit Log Viewer

**Files:**
- Create: `client/src/api/audit.ts`
- Create: `client/src/hooks/queries/useAudit.ts`
- Create: `client/src/pages/Admin.tsx`
- Modify: `client/src/App.tsx` — add /admin route

- [ ] **Step 1: Create audit API**

Create `client/src/api/audit.ts`:

```typescript
import api from "./client";

export interface AuditFilters {
  entityType?: string;
  action?: string;
  agentId?: string;
  page?: number;
  limit?: number;
}

export async function getAuditLog(filters: AuditFilters = {}) {
  const { data } = await api.get("/audit", { params: filters });
  return data as { entries: any[]; total: number };
}
```

- [ ] **Step 2: Create audit hook**

Create `client/src/hooks/queries/useAudit.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { getAuditLog, type AuditFilters } from "@/api/audit";

export function useAuditLog(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: ["audit", filters],
    queryFn: () => getAuditLog(filters),
  });
}
```

- [ ] **Step 3: Create Admin page with audit log viewer**

Create `client/src/pages/Admin.tsx`:

```tsx
import { useState } from "react";
import { Shield, Clock, User, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuditLog } from "@/hooks/queries/useAudit";
import { useAuth } from "@/hooks/useAuth";

const actionColors: Record<string, string> = {
  message_received: "bg-blue-500/20 text-blue-400",
  signal_classified: "bg-purple-500/20 text-purple-400",
  signal_reviewed: "bg-green-500/20 text-green-400",
  alert_created: "bg-yellow-500/20 text-yellow-400",
  alert_read: "bg-gray-500/20 text-gray-400",
  match_found: "bg-teal-500/20 text-teal-400",
  match_confirmed: "bg-emerald-500/20 text-emerald-400",
  match_dismissed: "bg-red-500/20 text-red-400",
  agent_invited: "bg-indigo-500/20 text-indigo-400",
  agent_deactivated: "bg-red-500/20 text-red-400",
  login: "bg-sky-500/20 text-sky-400",
};

export default function Admin() {
  const { agent } = useAuth();
  const [actionFilter, setActionFilter] = useState<string>("");
  const { data, isLoading } = useAuditLog({
    action: actionFilter || undefined,
    limit: 100,
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;

  if (agent?.role !== "admin") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-[#6b7280]">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Admin access required</p>
        </div>
      </div>
    );
  }

  const actions = [
    "message_received", "signal_classified", "signal_reviewed",
    "alert_created", "alert_read", "match_found", "match_confirmed",
    "match_dismissed", "agent_invited", "login",
  ];

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
      <div>
        <h1 className="text-lg font-semibold text-[#f1f2f7]">Admin — Audit Log</h1>
        <p className="text-xs text-[#6b7280] mt-0.5">{total} total entries</p>
      </div>

      {/* Action filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActionFilter("")}
          className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full transition-all ${
            !actionFilter ? "bg-[#77d5c0]/20 text-[#77d5c0]" : "bg-[#22272d] text-[#6b7280]"
          }`}
        >
          All
        </button>
        {actions.map((a) => (
          <button
            key={a}
            onClick={() => setActionFilter(a === actionFilter ? "" : a)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all ${
              actionFilter === a ? "bg-[#77d5c0]/20 text-[#77d5c0]" : "bg-[#22272d] text-[#6b7280]"
            }`}
          >
            {a.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Audit entries */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#77d5c0] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#6b7280]">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No audit entries yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry: any) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-3 bg-[#22272d] rounded-lg border border-[#2a2f35]"
              >
                <Clock className="w-3.5 h-3.5 text-[#6b7280] shrink-0" />
                <span className="text-[10px] text-[#6b7280] w-36 shrink-0">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
                <Badge className={`text-[9px] px-1.5 py-0 h-4 border-0 font-bold shrink-0 ${actionColors[entry.action] || "bg-gray-500/20 text-gray-400"}`}>
                  {entry.action.replace("_", " ")}
                </Badge>
                <span className="text-xs text-[#9ca3af] truncate flex-1">
                  {entry.entityType}:{entry.entityId?.slice(0, 8)}
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <span className="text-[#6b7280]"> — {JSON.stringify(entry.metadata).slice(0, 60)}</span>
                  )}
                </span>
                {entry.agentId && (
                  <User className="w-3 h-3 text-[#6b7280] shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 4: Add /admin route to App.tsx**

Add import:
```typescript
import Admin from "./pages/Admin";
```

Add route in ProtectedRouter (after settings):
```tsx
          <Route path="/admin" component={Admin} />
```

- [ ] **Step 5: Verify**

```bash
pnpm check
pnpm test
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: All tests pass (79 existing + new audit tests).

- [ ] **Step 2: TypeScript check**

```bash
pnpm check
```

- [ ] **Step 3: End-to-end verification**

Restart both servers. Run `npm run db:refresh` then `npm run db:seed-messages`.

Check:
1. Dashboard — KPIs, charts, alerts all show real data
2. Parser — messages with classifications
3. Signals — signal cards with type filters
4. Alerts — alert list with read/unread
5. Areas — demand bars
6. Settings — profile + notification prefs
7. Live Feed — compose a message, see it classified in real time
8. Admin (`/admin`) — audit log entries appearing (message_received, signal_classified, match_found, etc.)
9. Mobile — resize browser to phone width, sidebar hides, hamburger menu works

This completes the DDRE War Room production architecture.
