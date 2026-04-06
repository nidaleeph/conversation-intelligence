# Phase 5: Frontend Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect all frontend pages to the real backend API, replacing hardcoded mock data with TanStack Query hooks — so the app displays real signals, messages, and agents from PostgreSQL.

**Architecture:** Add TanStack Query for data fetching/caching. Create API functions and query hooks as a layer between pages and the backend. Add missing backend endpoints (messages list, analytics). Modify each page to swap mock imports for query hooks while preserving all existing UI.

**Tech Stack:** TanStack Query (React Query), Axios (already installed), existing Express/PostgreSQL backend

**Note:** Do NOT auto-commit. The user reviews and pushes all changes manually.

**Depends on:** Phase 1 (auth, agents) + Phase 2 (ingestion, classification, signals) — both complete.

---

## Gap Analysis: Backend Endpoints Needed

The frontend needs data the current backend doesn't serve:

| Page | Needs | Backend Has | Gap |
|------|-------|------------|-----|
| Dashboard | KPIs, area stats, budget/bedroom/property distributions | GET /api/signals (list) | Need analytics endpoints |
| Parser | Raw messages list, review queue | POST /api/signals/:id/review | Need GET /api/messages |
| Agents | Agent list with signal counts | GET /api/agents (basic) | Need agent stats |
| AgentProfile | Agent's signals, alerts, messages | GET /api/agents/:id | Need per-agent queries |
| LiveFeed | Manual ingest | POST /api/messages/ingest | Already exists |

**New backend endpoints needed:**
- `GET /api/messages` — list raw messages with search/filter
- `GET /api/analytics/kpis` — dashboard KPI counts
- `GET /api/analytics/distributions` — area, budget, bedroom, property type stats
- `GET /api/agents/:id/signals` — signals for a specific agent (by sender name)

---

## File Map

### New files — Backend
- `server/modules/messages/routes.ts` — GET /api/messages (list with search/filter)
- `server/modules/messages/service.ts` — messages query logic
- `server/modules/analytics/routes.ts` — GET /api/analytics/kpis, GET /api/analytics/distributions
- `server/modules/analytics/service.ts` — analytics queries

### New files — Frontend
- `client/src/api/signals.ts` — signals API functions
- `client/src/api/messages.ts` — messages API functions
- `client/src/api/analytics.ts` — analytics API functions
- `client/src/hooks/queries/useSignals.ts` — TanStack Query hook for signals
- `client/src/hooks/queries/useMessages.ts` — TanStack Query hook for messages
- `client/src/hooks/queries/useAgents.ts` — TanStack Query hook for agents
- `client/src/hooks/queries/useAnalytics.ts` — TanStack Query hook for analytics

### Modified files — Frontend
- `client/src/App.tsx` — wrap with QueryClientProvider
- `client/src/pages/Dashboard.tsx` — swap mock data for useAnalytics + useSignals
- `client/src/pages/Parser.tsx` — swap mock data for useMessages + useSignals
- `client/src/pages/Agents.tsx` — swap mock data for useAgents + useSignals
- `client/src/pages/AgentProfile.tsx` — swap mock data for agent query hooks
- `client/src/pages/LiveFeed.tsx` — add real manual ingestion via API

### Modified files — Backend
- `server/app.ts` — register messages + analytics routes
- `server/modules/agents/routes.ts` — add GET /api/agents/:id/signals

---

## Task 1: TanStack Query Setup

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create QueryClient and wrap the app**

In `client/src/App.tsx`, add these imports at the top:

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      retry: 1,
    },
  },
});
```

Wrap the `AuthProvider` with `QueryClientProvider`:

```tsx
function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <QueryClientProvider client={queryClient}>
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
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 2: Verify dev server starts**

```bash
pnpm dev
```

Expected: No errors, app loads.

---

## Task 2: Backend — Messages & Analytics Endpoints

**Files:**
- Create: `server/modules/messages/service.ts`
- Create: `server/modules/messages/routes.ts`
- Create: `server/modules/analytics/service.ts`
- Create: `server/modules/analytics/routes.ts`
- Modify: `server/app.ts` — register new routes
- Modify: `server/modules/agents/routes.ts` — add agent signals endpoint
- Modify: `shared/schemas.ts` — add message filter schema

- [ ] **Step 1: Add message filter schema to `shared/schemas.ts`**

Append to the end:

```typescript
// ============================================================
// Message filter schemas (Phase 5)
// ============================================================

export const messageFilterSchema = z.object({
  classification: signalTypeSchema.optional(),
  search: z.string().optional(),
  classified: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
```

- [ ] **Step 2: Create messages service**

Create `server/modules/messages/service.ts`:

```typescript
import { query } from "../../db/connection.js";

interface MessageRow {
  id: string;
  source_group: string;
  sender_name: string;
  sender_phone: string;
  raw_text: string;
  platform: string;
  received_at: string;
  fingerprint: string;
  classified: boolean;
  created_at: string;
}

function toMessage(row: MessageRow) {
  return {
    id: row.id,
    sourceGroup: row.source_group,
    senderName: row.sender_name,
    senderPhone: row.sender_phone,
    rawText: row.raw_text,
    platform: row.platform,
    receivedAt: row.received_at,
    fingerprint: row.fingerprint,
    classified: row.classified,
    createdAt: row.created_at,
  };
}

export async function listMessages(opts: {
  page: number;
  limit: number;
  search?: string;
  classified?: boolean;
}) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (opts.search) {
    conditions.push(
      `(raw_text ILIKE $${paramIndex} OR sender_name ILIKE $${paramIndex})`
    );
    values.push(`%${opts.search}%`);
    paramIndex++;
  }
  if (opts.classified !== undefined) {
    conditions.push(`classified = $${paramIndex++}`);
    values.push(opts.classified);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query(
    `SELECT count(*) FROM messages ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (opts.page - 1) * opts.limit;
  const result = await query<MessageRow>(
    `SELECT * FROM messages ${where} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, opts.limit, offset]
  );

  return { messages: result.rows.map(toMessage), total };
}

export async function getMessageWithSignal(messageId: string) {
  const msgResult = await query<MessageRow>(
    "SELECT * FROM messages WHERE id = $1",
    [messageId]
  );
  if (!msgResult.rows[0]) return null;

  const sigResult = await query(
    "SELECT * FROM signals WHERE message_id = $1",
    [messageId]
  );

  return {
    message: toMessage(msgResult.rows[0]),
    signal: sigResult.rows[0] || null,
  };
}
```

- [ ] **Step 3: Create messages routes**

Create `server/modules/messages/routes.ts`:

```typescript
import { Router } from "express";
import { messageFilterSchema } from "@shared/schemas.js";
import { requireAuth } from "../../middleware/auth.js";
import { listMessages } from "./service.js";

export function messagesRoutes(): Router {
  const router = Router();

  router.use(requireAuth);

  // GET /api/messages
  router.get("/", async (req, res, next) => {
    try {
      const filters = messageFilterSchema.parse(req.query);
      const result = await listMessages(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 4: Create analytics service**

Create `server/modules/analytics/service.ts`:

```typescript
import { query } from "../../db/connection.js";

export async function getKPIs() {
  const [
    totalMessages,
    totalSignals,
    actionableSignals,
    buyerSearches,
    tenantSearches,
    propertiesForSale,
    propertiesForRent,
    pendingReview,
    totalAgents,
  ] = await Promise.all([
    query("SELECT count(*) FROM messages"),
    query("SELECT count(*) FROM signals"),
    query("SELECT count(*) FROM signals WHERE actionable = true"),
    query("SELECT count(*) FROM signals WHERE type = 'Buyer Search'"),
    query("SELECT count(*) FROM signals WHERE type = 'Tenant Search'"),
    query("SELECT count(*) FROM signals WHERE type = 'Property for Sale'"),
    query("SELECT count(*) FROM signals WHERE type = 'Property for Rent'"),
    query("SELECT count(*) FROM signals WHERE confidence < 0.85 AND status = 'new'"),
    query("SELECT count(*) FROM agents WHERE is_active = true"),
  ]);

  return {
    totalMessages: parseInt(totalMessages.rows[0].count, 10),
    totalSignals: parseInt(totalSignals.rows[0].count, 10),
    actionableSignals: parseInt(actionableSignals.rows[0].count, 10),
    buyerSearches: parseInt(buyerSearches.rows[0].count, 10),
    tenantSearches: parseInt(tenantSearches.rows[0].count, 10),
    propertiesForSale: parseInt(propertiesForSale.rows[0].count, 10),
    propertiesForRent: parseInt(propertiesForRent.rows[0].count, 10),
    pendingReview: parseInt(pendingReview.rows[0].count, 10),
    totalAgents: parseInt(totalAgents.rows[0].count, 10),
  };
}

export async function getDistributions() {
  const [areaStats, budgetDist, bedroomDist, typeDist] = await Promise.all([
    query(`
      SELECT unnest(location) as area, count(*) as count
      FROM signals
      WHERE actionable = true
      GROUP BY area
      ORDER BY count DESC
      LIMIT 20
    `),
    query(`
      SELECT
        CASE
          WHEN budget_max IS NULL THEN 'Unknown'
          WHEN budget_max < 1000000 THEN 'Under £1m'
          WHEN budget_max < 2000000 THEN '£1m–£2m'
          WHEN budget_max < 3000000 THEN '£2m–£3m'
          WHEN budget_max < 5000000 THEN '£3m–£5m'
          WHEN budget_max < 10000000 THEN '£5m–£10m'
          ELSE '£10m+'
        END as range,
        count(*) as count
      FROM signals
      WHERE actionable = true AND type IN ('Buyer Search', 'Property for Sale')
      GROUP BY range
      ORDER BY count DESC
    `),
    query(`
      SELECT bedrooms, count(*) as count
      FROM signals
      WHERE bedrooms IS NOT NULL AND actionable = true
      GROUP BY bedrooms
      ORDER BY bedrooms
    `),
    query(`
      SELECT type, count(*) as count
      FROM signals
      GROUP BY type
      ORDER BY count DESC
    `),
  ]);

  return {
    areaStats: areaStats.rows.map((r: any) => ({
      area: r.area,
      count: parseInt(r.count, 10),
    })),
    budgetDistribution: budgetDist.rows.map((r: any) => ({
      range: r.range,
      count: parseInt(r.count, 10),
    })),
    bedroomDistribution: bedroomDist.rows.map((r: any) => ({
      bedrooms: r.bedrooms,
      count: parseInt(r.count, 10),
    })),
    typeDistribution: typeDist.rows.map((r: any) => ({
      type: r.type,
      count: parseInt(r.count, 10),
    })),
  };
}
```

- [ ] **Step 5: Create analytics routes**

Create `server/modules/analytics/routes.ts`:

```typescript
import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { getKPIs, getDistributions } from "./service.js";

export function analyticsRoutes(): Router {
  const router = Router();

  router.use(requireAuth);

  // GET /api/analytics/kpis
  router.get("/kpis", async (_req, res, next) => {
    try {
      const kpis = await getKPIs();
      res.json(kpis);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/analytics/distributions
  router.get("/distributions", async (_req, res, next) => {
    try {
      const distributions = await getDistributions();
      res.json(distributions);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 6: Add agent signals endpoint to existing agents routes**

In `server/modules/agents/routes.ts`, add this route BEFORE the `/:id` GET route (to prevent route conflicts):

```typescript
  // GET /api/agents/:id/signals
  router.get("/:id/signals", async (req, res, next) => {
    try {
      const { query: dbQuery } = await import("../../db/connection.js");
      const agent = await getAgentById(req.params.id);
      if (!agent) throw createError(404, "Agent not found");

      const result = await dbQuery(
        `SELECT s.* FROM signals s
         JOIN messages m ON m.id = s.message_id
         WHERE m.sender_name = $1
         ORDER BY s.created_at DESC
         LIMIT 100`,
        [agent.name]
      );

      res.json({ signals: result.rows, agentName: agent.name });
    } catch (err) {
      next(err);
    }
  });
```

- [ ] **Step 7: Register new routes in `server/app.ts`**

Add imports:
```typescript
import { messagesRoutes } from "./modules/messages/routes.js";
import { analyticsRoutes } from "./modules/analytics/routes.js";
```

Add routes after existing ones (but note: ingestion routes are already on `/api/messages`). The messages list route needs to go on the same router or a different path. Since `ingestionRoutes` is mounted at `/api/messages` and handles `/ingest` and `/ingest/batch`, add the messages list route there.

Actually, cleaner approach — merge the list endpoint into ingestion routes. In `server/modules/ingestion/routes.ts`, add at the top of the router (before the /ingest routes):

```typescript
  // GET /api/messages — list messages
  router.get("/", requireAuth, async (req, res, next) => {
    try {
      const { messageFilterSchema } = await import("@shared/schemas.js");
      const { listMessages } = await import("../messages/service.js");
      const filters = messageFilterSchema.parse(req.query);
      const result = await listMessages(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });
```

Then register analytics routes in `server/app.ts`:
```typescript
  app.use("/api/analytics", analyticsRoutes());
```

- [ ] **Step 8: Verify backend**

```bash
pnpm check
pnpm test
```

Expected: TypeScript clean, all tests pass.

---

## Task 3: Frontend API Functions

**Files:**
- Create: `client/src/api/signals.ts`
- Create: `client/src/api/messages.ts`
- Create: `client/src/api/analytics.ts`

- [ ] **Step 1: Create signals API**

Create `client/src/api/signals.ts`:

```typescript
import api from "./client";

export interface SignalFilters {
  type?: string;
  status?: string;
  needsReview?: boolean;
  page?: number;
  limit?: number;
}

export async function getSignals(filters: SignalFilters = {}) {
  const { data } = await api.get("/signals", { params: filters });
  return data as { signals: any[]; total: number };
}

export async function getSignalById(id: string) {
  const { data } = await api.get(`/signals/${id}`);
  return data;
}

export async function reviewSignal(
  id: string,
  review: { approved: boolean; reviewedType?: string }
) {
  const { data } = await api.post(`/signals/${id}/review`, review);
  return data;
}
```

- [ ] **Step 2: Create messages API**

Create `client/src/api/messages.ts`:

```typescript
import api from "./client";

export interface MessageFilters {
  search?: string;
  classified?: boolean;
  page?: number;
  limit?: number;
}

export async function getMessages(filters: MessageFilters = {}) {
  const { data } = await api.get("/messages", { params: filters });
  return data as { messages: any[]; total: number };
}

export async function ingestMessage(message: {
  sourceGroup: string;
  senderName: string;
  rawText: string;
  platform?: string;
}) {
  const { data } = await api.post("/messages/ingest", message);
  return data as { messageId: string; duplicate: boolean };
}

export async function ingestBatch(
  messages: Array<{
    sourceGroup: string;
    senderName: string;
    rawText: string;
    platform?: string;
  }>
) {
  const { data } = await api.post("/messages/ingest/batch", { messages });
  return data;
}
```

- [ ] **Step 3: Create analytics API**

Create `client/src/api/analytics.ts`:

```typescript
import api from "./client";

export async function getKPIs() {
  const { data } = await api.get("/analytics/kpis");
  return data;
}

export async function getDistributions() {
  const { data } = await api.get("/analytics/distributions");
  return data;
}
```

---

## Task 4: TanStack Query Hooks

**Files:**
- Create: `client/src/hooks/queries/useSignals.ts`
- Create: `client/src/hooks/queries/useMessages.ts`
- Create: `client/src/hooks/queries/useAgents.ts`
- Create: `client/src/hooks/queries/useAnalytics.ts`

- [ ] **Step 1: Create signals query hook**

Create `client/src/hooks/queries/useSignals.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSignals, reviewSignal, type SignalFilters } from "@/api/signals";

export function useSignals(filters: SignalFilters = {}) {
  return useQuery({
    queryKey: ["signals", filters],
    queryFn: () => getSignals(filters),
  });
}

export function useReviewSignal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      review,
    }: {
      id: string;
      review: { approved: boolean; reviewedType?: string };
    }) => reviewSignal(id, review),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
```

- [ ] **Step 2: Create messages query hook**

Create `client/src/hooks/queries/useMessages.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { getMessages, type MessageFilters } from "@/api/messages";

export function useMessages(filters: MessageFilters = {}) {
  return useQuery({
    queryKey: ["messages", filters],
    queryFn: () => getMessages(filters),
  });
}
```

- [ ] **Step 3: Create agents query hook**

Create `client/src/hooks/queries/useAgents.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { getAgents, getAgentById } from "@/api/agents";

export function useAgents(page = 1, limit = 100) {
  return useQuery({
    queryKey: ["agents", page, limit],
    queryFn: () => getAgents(page, limit),
  });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ["agents", id],
    queryFn: () => getAgentById(id),
    enabled: !!id,
  });
}
```

- [ ] **Step 4: Create analytics query hook**

Create `client/src/hooks/queries/useAnalytics.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { getKPIs, getDistributions } from "@/api/analytics";

export function useKPIs() {
  return useQuery({
    queryKey: ["analytics", "kpis"],
    queryFn: getKPIs,
    refetchInterval: 30 * 1000, // Auto-refresh every 30s
  });
}

export function useDistributions() {
  return useQuery({
    queryKey: ["analytics", "distributions"],
    queryFn: getDistributions,
    refetchInterval: 60 * 1000, // Auto-refresh every 60s
  });
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
pnpm check
```

---

## Task 5: Connect Dashboard Page

**Files:**
- Modify: `client/src/pages/Dashboard.tsx`

This is the largest page (690 lines). The strategy is surgical: replace the mock data imports and computed stats with query hooks, while keeping all existing UI code intact.

- [ ] **Step 1: Read the current Dashboard.tsx to understand its structure**

Read `client/src/pages/Dashboard.tsx` fully before making changes.

- [ ] **Step 2: Replace data imports with query hooks**

At the top of Dashboard.tsx, **remove** these imports:
```typescript
import {
  getKPIs, getAreaStats, getBudgetDistribution, getBedroomDistribution,
  getPropertyTypeDistribution, signals, alerts, watchlists,
  type Signal, type SignalStatus,
} from "@/lib/data";
```

**Add** these imports instead:
```typescript
import { useKPIs, useDistributions } from "@/hooks/queries/useAnalytics";
import { useSignals } from "@/hooks/queries/useSignals";
```

- [ ] **Step 3: Replace the data fetching inside the component**

Find where the component uses `getKPIs()`, `getAreaStats()`, etc. (typically in useMemo calls) and replace with:

```typescript
const { data: kpiData } = useKPIs();
const { data: distData } = useDistributions();
const { data: signalsData } = useSignals({ limit: 100 });

// Provide defaults when loading
const kpis = kpiData ?? {
  totalMessages: 0, totalSignals: 0, actionableSignals: 0,
  buyerSearches: 0, tenantSearches: 0, propertiesForSale: 0,
  propertiesForRent: 0, pendingReview: 0, totalAgents: 0,
};

const areaStats = distData?.areaStats ?? [];
const budgetDistribution = distData?.budgetDistribution ?? [];
const bedroomDistribution = distData?.bedroomDistribution ?? [];
const typeDistribution = distData?.typeDistribution ?? [];
const signalsList = signalsData?.signals ?? [];
```

Remove the old `useMemo` calls that computed KPIs from mock data. The rest of the UI can reference the new variables. Where the Dashboard references `signals` directly (the mock array), replace with `signalsList`.

**Key mapping for the existing UI:**
- `getKPIs()` → `kpis` (same field names: totalMessages, actionableSignals, etc.)
- `getAreaStats()` → `areaStats` (array of `{ area, count }`)
- `getBudgetDistribution()` → `budgetDistribution` (array of `{ range, count }`)
- `getBedroomDistribution()` → `bedroomDistribution` (array of `{ bedrooms, count }`)
- `getPropertyTypeDistribution()` → `typeDistribution` (array of `{ type, count }`)
- `signals` (mock array) → `signalsList` (from useSignals)

For the `alerts` and `watchlists` imports — these don't have backend endpoints yet (Phase 3). Replace with empty arrays for now:
```typescript
const alerts: any[] = [];
const watchlists: any[] = [];
```

- [ ] **Step 4: Verify the page renders**

Start both dev servers and navigate to `http://localhost:3000/`. The dashboard should load with real data (zeros if no messages have been ingested yet) without errors.

---

## Task 6: Connect Parser Page

**Files:**
- Modify: `client/src/pages/Parser.tsx`

- [ ] **Step 1: Read current Parser.tsx**

Read the full file to understand the structure.

- [ ] **Step 2: Replace data imports with query hooks**

**Remove:**
```typescript
import { rawMessages, signals, reviewQueue, type RawMessage, type SignalType } from "@/lib/data";
```

**Add:**
```typescript
import { useMessages } from "@/hooks/queries/useMessages";
import { useSignals, useReviewSignal } from "@/hooks/queries/useSignals";
import type { SignalType } from "@shared/types";
```

- [ ] **Step 3: Replace data usage in the component**

Add query hooks at the top of the component function:

```typescript
const [searchQuery, setSearchQuery] = useState("");
const [classFilter, setClassFilter] = useState<string>("");

const { data: messagesData, isLoading: messagesLoading } = useMessages({
  search: searchQuery || undefined,
  page: 1,
  limit: 100,
});
const { data: signalsData } = useSignals({ limit: 200 });
const { data: reviewData } = useSignals({ needsReview: true, limit: 50 });
const reviewMutation = useReviewSignal();

const rawMessages = messagesData?.messages ?? [];
const allSignals = signalsData?.signals ?? [];
const reviewQueue = reviewData?.signals ?? [];
```

For the `filteredMessages` useMemo, it previously filtered the mock `rawMessages` array. Now it should filter `rawMessages` from the query. The messages from the API don't have a `classification` field directly — the classification is on the signal. You'll need to join them:

```typescript
const messagesWithClassification = useMemo(() => {
  return rawMessages.map((msg: any) => {
    const signal = allSignals.find((s: any) => s.messageId === msg.id);
    return {
      ...msg,
      classification: signal?.type ?? "Unclassified",
      confidence: signal?.confidence ?? 0,
      actionable: signal?.actionable ?? false,
    };
  });
}, [rawMessages, allSignals]);
```

Replace references to `rawMessages` in the JSX with `messagesWithClassification`.

For the review approve/reject actions, replace the local state mutation with the mutation hook:

```typescript
// Old: setReviewItems(prev => prev.filter(r => r.id !== id))
// New:
reviewMutation.mutate(
  { id: signalId, review: { approved: true } },
  { onSuccess: () => toast.success("Signal approved") }
);
```

- [ ] **Step 4: Add loading state**

Add a simple loading indicator when `messagesLoading` is true — render a spinner or skeleton instead of the message list.

- [ ] **Step 5: Verify Parser page works**

Navigate to `/parser`. It should show real messages (empty if none ingested yet).

---

## Task 7: Connect Agents & AgentProfile Pages

**Files:**
- Modify: `client/src/pages/Agents.tsx`
- Modify: `client/src/pages/AgentProfile.tsx`

- [ ] **Step 1: Read current Agents.tsx and AgentProfile.tsx**

Read both files.

- [ ] **Step 2: Update Agents.tsx**

**Remove:**
```typescript
import { signals, alerts, agentProfiles } from "@/lib/data";
```

**Add:**
```typescript
import { useAgents } from "@/hooks/queries/useAgents";
import { useSignals } from "@/hooks/queries/useSignals";
```

Replace the data:
```typescript
const { data: agentsData, isLoading } = useAgents();
const { data: signalsData } = useSignals({ limit: 500 });

const agents = agentsData?.agents ?? [];
const allSignals = signalsData?.signals ?? [];
```

The existing `agentSummaries` useMemo derives stats from the agents + signals arrays. Update it to work with the new data shape. The agents from the API have `coverageAreas` (camelCase), and signals have `type`, `messageId`, etc. The existing code groups by `agent` name in signals — in the new API, signals don't have an `agent` field directly. Instead, you'll need to match via the message sender.

For the MVP, simplify the agent summary: show agents from the API with their `coverageAreas`, and signal counts as 0 (until we add the per-agent stats endpoint). Or compute basic counts from the signals list:

```typescript
const agentSummaries = useMemo(() => {
  return agents.map((agent: any) => ({
    name: agent.name,
    areas: agent.coverageAreas,
    totalSignals: 0, // Will be computed when per-agent endpoint is wired
    alertCount: 0,
    isActive: agent.isActive,
  }));
}, [agents]);
```

- [ ] **Step 3: Update AgentProfile.tsx**

**Remove** mock data imports. **Add** query hooks:

```typescript
import { useAgents } from "@/hooks/queries/useAgents";
import { useSignals } from "@/hooks/queries/useSignals";
```

The page uses a URL param (`:name`) to find the agent. The current code does `agentProfiles.find(a => a.name === decodedName)`. With the API, agents are fetched by ID, not name. For now, use the agents list and find by name:

```typescript
const { data: agentsData } = useAgents();
const agents = agentsData?.agents ?? [];
const agent = agents.find(
  (a: any) => a.name.toLowerCase() === decodedName.toLowerCase()
);
```

Replace `signals.filter(s => s.agent === name)` with `[]` for now (signals don't have an agent field — this will be connected in Phase 3 when the matching engine links signals to agents).

The page should still render the UI structure with the agent's info (name, areas) from the real API, even if signal counts are empty.

- [ ] **Step 4: Verify both pages**

Navigate to `/agents` — should show the real agents from the database. Click an agent — profile page should show their info.

---

## Task 8: Update LiveFeed Page

**Files:**
- Modify: `client/src/pages/LiveFeed.tsx`

- [ ] **Step 1: Read current LiveFeed.tsx**

Read the file to understand the `useIngestionEngine` hook integration.

- [ ] **Step 2: Add real ingestion to the manual compose feature**

The LiveFeed already has a manual compose form. Currently it feeds into the simulation engine. Add real API ingestion alongside it.

Import the ingest function:
```typescript
import { ingestMessage } from "@/api/messages";
```

In the manual compose submit handler (the one that calls `ingestMessage` from the engine), add a real API call:

```typescript
// After the existing simulation ingest call, also send to real backend:
try {
  await ingestMessage({
    sourceGroup: "Manual Input",
    senderName: manualSender || "Manual Test",
    rawText: manualInput,
  });
} catch (err) {
  console.error("Failed to ingest to backend:", err);
}
```

This way, messages typed into the LiveFeed compose box are both:
1. Shown in the simulation UI (existing behavior)
2. Sent to the real backend for classification

- [ ] **Step 3: Verify LiveFeed**

Navigate to `/live`. The simulation should still work. Type a message in the compose box — it should also appear in the database (check via `/parser`).

---

## Task 9: Final Verification & Cleanup

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

All existing 63 tests should still pass (frontend changes don't affect server tests).

- [ ] **Step 2: TypeScript check**

```bash
pnpm check
```

Expected: Clean.

- [ ] **Step 3: End-to-end smoke test**

With both servers running:

1. Go to `http://localhost:3000/` — Dashboard loads with real KPIs (zeros if empty)
2. Go to `/parser` — shows real messages (empty if none ingested)
3. Go to `/agents` — shows real agents from database
4. Go to `/live` — compose and send a test message: "New buyer looking for 3 bed house in Hampstead, budget £3m"
5. Go to `/parser` — the message should appear
6. Go to `/` (Dashboard) — KPIs should update (1 signal, 1 buyer search)

- [ ] **Step 4: Ingest sample data for a real demo**

Create a quick script to ingest the existing mock messages. From the browser console or via curl:

```bash
curl -X POST http://localhost:3001/api/messages/ingest/batch \
  -H "Content-Type: application/json" \
  -H "Cookie: ddre_session=YOUR_SESSION_ID" \
  -d '{"messages":[
    {"sourceGroup":"DDRE Agents","senderName":"Scott Bennett","rawText":"I have a new buyer looking for:\nMinimum 3 beds\nNeeds a garden\nHouse or garden flat\nBudget up to £3.3m\nHampstead or Belsize park\nNeed a fee please"},
    {"sourceGroup":"DDRE Agents","senderName":"Natalie Malka","rawText":"Does anyone have a rental in Marylebone 2 bed 2 bath ideally with parking £9k a month. Needed from Feb"},
    {"sourceGroup":"DDRE Agents","senderName":"Jonathan Singer","rawText":"Redington Road, NW3, £1,550,000, 3 Bed, 2 Bath, 1,375 SQFT, Share of Freehold. Fees Available."},
    {"sourceGroup":"DDRE Agents","senderName":"Daisy Spanbok","rawText":"Does anyone know any architects who are familiar with the suburbs and are reasonably priced?"},
    {"sourceGroup":"DDRE Agents","senderName":"Lauren Christy","rawText":"Happy new year! Have a great buyer looking for a 2 bed + turnkey apartment in Hampstead, budget up to £2.5m. Needs garden."}
  ]}'
```

After ingestion, the Dashboard should show real KPIs and charts.
