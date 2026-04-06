# Phase 4: Notifications & Real-time — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add WebSocket real-time events so alerts and signals appear instantly without page refresh, plus email notifications for alerts and a notification delivery pipeline via pg-boss.

**Architecture:** Attach a `ws` WebSocket server to the existing HTTP server. Maintain an `agentId → Set<WebSocket>` connection map. When alerts/signals are created, broadcast events to connected agents. For email, queue pg-boss jobs that send via Resend. The notification dispatcher reads agent preferences and fans out to enabled channels.

**Tech Stack:** ws (WebSocket), Resend (email), pg-boss (job queue), React context (frontend WebSocket)

**Note:** Do NOT auto-commit. The user reviews and pushes all changes manually.

**Depends on:** Phases 1-3 (foundation, classification, matching/alerts), Phase 5 (frontend restructure)

---

## File Map

### New files — Server
- `server/modules/notifications/websocket.ts` — WebSocket server, connection map, broadcast helpers
- `server/modules/notifications/dispatcher.ts` — reads agent preferences, queues notification jobs per channel
- `server/modules/notifications/email-alerts.ts` — sends alert/match emails via Resend
- `server/modules/notifications/worker.ts` — pg-boss workers for send-email, send-push jobs

### New files — Frontend
- `client/src/contexts/WebSocketContext.tsx` — WebSocket provider, auto-reconnect, event dispatch
- `client/src/hooks/useWebSocket.ts` — hook to subscribe to WebSocket events

### Modified files — Server
- `server/index.ts` — attach WebSocket server to HTTP server, start notification workers
- `server/modules/matching/service.ts` — broadcast match/alert events after creation
- `server/modules/classification/pipeline.ts` — broadcast signal events after classification
- `server/modules/ingestion/service.ts` — broadcast livefeed events after ingestion

### Modified files — Frontend
- `client/src/App.tsx` — wrap with WebSocketProvider
- `client/src/pages/LiveFeed.tsx` — subscribe to livefeed WebSocket events for real-time stream
- `client/src/components/DashboardLayout.tsx` — show toast on alert:new event

---

## Task 1: WebSocket Server

**Files:**
- Create: `server/modules/notifications/websocket.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create WebSocket server module**

Create `server/modules/notifications/websocket.ts`:

```typescript
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import { COOKIE_NAME } from "@shared/const.js";
import { query } from "../../db/connection.js";

// agentId → Set of connected WebSockets
const connections = new Map<string, Set<WebSocket>>();

// All connected sockets (for broadcast-to-all like livefeed)
const allSockets = new Set<WebSocket>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    // Extract session cookie from upgrade request
    const cookieHeader = req.headers.cookie || "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [key, ...rest] = c.trim().split("=");
        return [key, rest.join("=")];
      })
    );

    const sessionId = cookies[COOKIE_NAME];
    if (!sessionId) {
      ws.close(4001, "Not authenticated");
      return;
    }

    // Validate session
    try {
      const result = await query(
        `SELECT s.agent_id, a.name FROM sessions s
         JOIN agents a ON a.id = s.agent_id
         WHERE s.id = $1 AND s.verified = true AND s.expires_at > now()`,
        [sessionId]
      );

      if (result.rows.length === 0) {
        ws.close(4001, "Invalid session");
        return;
      }

      const agentId = result.rows[0].agent_id;
      const agentName = result.rows[0].name;

      // Register connection
      if (!connections.has(agentId)) {
        connections.set(agentId, new Set());
      }
      connections.get(agentId)!.add(ws);
      allSockets.add(ws);

      console.log(`WebSocket connected: ${agentName} (${agentId})`);

      // Send welcome
      ws.send(JSON.stringify({ type: "connected", agentId, agentName }));

      ws.on("close", () => {
        connections.get(agentId)?.delete(ws);
        if (connections.get(agentId)?.size === 0) {
          connections.delete(agentId);
        }
        allSockets.delete(ws);
        console.log(`WebSocket disconnected: ${agentName}`);
      });

      ws.on("error", () => {
        connections.get(agentId)?.delete(ws);
        allSockets.delete(ws);
      });
    } catch (err) {
      ws.close(4002, "Auth error");
    }
  });

  console.log("WebSocket server started on /ws");
  return wss;
}

// Send event to a specific agent
export function sendToAgent(agentId: string, event: { type: string; data: unknown }) {
  const sockets = connections.get(agentId);
  if (!sockets) return;
  const message = JSON.stringify(event);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

// Send event to all connected clients (e.g., livefeed)
export function broadcast(event: { type: string; data: unknown }) {
  const message = JSON.stringify(event);
  for (const ws of allSockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

// Get number of connected agents
export function getConnectionCount(): number {
  return connections.size;
}
```

- [ ] **Step 2: Attach WebSocket to HTTP server in `server/index.ts`**

Read `server/index.ts`. After `const server = createServer(app);`, add:

```typescript
  // Setup WebSocket
  const { setupWebSocket } = await import(
    "./modules/notifications/websocket.js"
  );
  setupWebSocket(server);
```

- [ ] **Step 3: Verify**

```bash
pnpm check
```

Restart dev:server — should see "WebSocket server started on /ws" in the terminal.

---

## Task 2: Broadcast Events from Pipeline

**Files:**
- Modify: `server/modules/ingestion/service.ts` — broadcast `livefeed:message`
- Modify: `server/modules/classification/pipeline.ts` — broadcast `livefeed:classified` and `signal:new`
- Modify: `server/modules/matching/service.ts` — broadcast `alert:new` and `match:new`

- [ ] **Step 1: Add livefeed:message broadcast to ingestion**

Read `server/modules/ingestion/service.ts`. After the message is inserted (after `const messageId = result.rows[0].id;`), add:

```typescript
  // Broadcast to all connected clients
  try {
    const { broadcast } = await import("../notifications/websocket.js");
    broadcast({
      type: "livefeed:message",
      data: {
        messageId,
        senderName: input.senderName,
        sourceGroup: input.sourceGroup,
        rawText: input.rawText,
        platform: input.platform,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {}
```

- [ ] **Step 2: Add livefeed:classified and signal:new broadcasts to classification pipeline**

Read `server/modules/classification/pipeline.ts`. At the end of `classifyMessage`, after the signal is inserted and the result object is built (before the `return`), add:

```typescript
  // Broadcast classification events
  try {
    const { broadcast, sendToAgent } = await import(
      "../notifications/websocket.js"
    );

    // Everyone sees the livefeed classification
    broadcast({
      type: "livefeed:classified",
      data: {
        messageId: input.messageId,
        signalId: result.rows[0].id,
        type,
        method,
        confidence,
        actionable,
        summary,
      },
    });

    // Notify agents whose coverage areas overlap with signal locations
    if (actionable && location.length > 0) {
      const { query: dbQuery } = await import("../../db/connection.js");
      const agentsResult = await dbQuery(
        `SELECT id FROM agents WHERE is_active = true AND coverage_areas && $1`,
        [location]
      );
      for (const agent of agentsResult.rows) {
        sendToAgent(agent.id, {
          type: "signal:new",
          data: { signalId: result.rows[0].id, type, location, summary },
        });
      }
    }
  } catch {}
```

Note: The variable `result` here refers to the query result from the INSERT INTO signals. Read the file to verify the exact variable name — it may already be named `result`. Use the correct one.

- [ ] **Step 3: Add alert:new and match:new broadcasts to matching service**

Read `server/modules/matching/service.ts`. Inside the loop where alerts are created (after the INSERT INTO alerts query), add:

```typescript
        // Broadcast real-time alert
        try {
          const { sendToAgent } = await import(
            "../notifications/websocket.js"
          );
          sendToAgent(agent.id, {
            type: "alert:new",
            data: {
              alertId: "new",
              matchId,
              priority: score >= 0.8 ? "high" : score >= 0.6 ? "medium" : "low",
              summary,
            },
          });
        } catch {}
```

Also, after the match is stored (after `matchesFound++`), add:

```typescript
      // Broadcast match event
      try {
        const { broadcast: wsBroadcast } = await import(
          "../notifications/websocket.js"
        );
        wsBroadcast({
          type: "match:new",
          data: { matchId, score, reasons, demandId: demand.id, supplyId: supply.id },
        });
      } catch {}
```

- [ ] **Step 4: Verify**

```bash
pnpm check
pnpm test
```

All 79 tests should still pass (broadcasts are wrapped in try/catch and dynamic imports won't affect mocked tests).

---

## Task 3: Email Notification Dispatcher

**Files:**
- Create: `server/modules/notifications/email-alerts.ts`
- Create: `server/modules/notifications/dispatcher.ts`
- Create: `server/modules/notifications/worker.ts`
- Modify: `server/index.ts` — start notification workers

- [ ] **Step 1: Create email alerts sender**

Create `server/modules/notifications/email-alerts.ts`:

```typescript
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface AlertEmailData {
  to: string;
  agentName: string;
  alertSummary: string;
  alertPriority: string;
  alertType: string;
}

export async function sendAlertEmail(data: AlertEmailData): Promise<boolean> {
  if (!resend) {
    console.log(
      `  [email-stub] Alert for ${data.agentName} (${data.to}): ${data.alertSummary}`
    );
    return true;
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "DDRE War Room <noreply@ddre.com>",
      to: data.to,
      subject: `[${data.alertPriority.toUpperCase()}] ${data.alertType === "match_found" ? "New Match" : "New Alert"} — DDRE War Room`,
      html: `
        <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1a1e23;">New Alert</h2>
          <div style="background: #f8f9fa; border-left: 4px solid ${
            data.alertPriority === "high" ? "#ef4444" :
            data.alertPriority === "medium" ? "#f59e0b" : "#22c55e"
          }; padding: 16px; border-radius: 4px; margin: 16px 0;">
            <p style="margin: 0; font-weight: 600;">${data.alertSummary}</p>
          </div>
          <a href="${process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000"}/alerts"
             style="display: inline-block; padding: 12px 32px; background: #77d5c0; color: #1a1e23; text-decoration: none; border-radius: 8px; font-weight: 600;">
            View in War Room
          </a>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("Failed to send alert email:", err);
    return false;
  }
}

interface DigestEmailData {
  to: string;
  agentName: string;
  alerts: Array<{ summary: string; priority: string; createdAt: string }>;
}

export async function sendDigestEmail(data: DigestEmailData): Promise<boolean> {
  if (!resend) {
    console.log(
      `  [email-stub] Daily digest for ${data.agentName}: ${data.alerts.length} alerts`
    );
    return true;
  }

  const alertRows = data.alerts
    .map(
      (a) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            <span style="color: ${
              a.priority === "high" ? "#ef4444" :
              a.priority === "medium" ? "#f59e0b" : "#22c55e"
            }; font-weight: bold; text-transform: uppercase; font-size: 11px;">${a.priority}</span>
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${a.summary}</td>
        </tr>`
    )
    .join("");

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "DDRE War Room <noreply@ddre.com>",
      to: data.to,
      subject: `Daily Digest: ${data.alerts.length} alert(s) — DDRE War Room`,
      html: `
        <div style="font-family: 'DM Sans', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1e23;">Daily Digest</h2>
          <p>Hi ${data.agentName}, here's your summary from the last 24 hours:</p>
          <table style="width: 100%; border-collapse: collapse;">
            ${alertRows}
          </table>
          <a href="${process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000"}/alerts"
             style="display: inline-block; margin-top: 16px; padding: 12px 32px; background: #77d5c0; color: #1a1e23; text-decoration: none; border-radius: 8px; font-weight: 600;">
            View All Alerts
          </a>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("Failed to send digest email:", err);
    return false;
  }
}
```

- [ ] **Step 2: Create notification dispatcher**

Create `server/modules/notifications/dispatcher.ts`:

```typescript
import { query } from "../../db/connection.js";
import { getBoss } from "../../db/boss.js";

interface DispatchInput {
  alertId: string;
  agentId: string;
  summary: string;
  priority: string;
  alertType: string;
}

export async function dispatchNotifications(input: DispatchInput) {
  // Load agent's notification preferences
  const prefsResult = await query(
    `SELECT np.*, a.email, a.name
     FROM notification_preferences np
     JOIN agents a ON a.id = np.agent_id
     WHERE np.agent_id = $1`,
    [input.agentId]
  );

  const prefs = prefsResult.rows[0];
  if (!prefs) return;

  // Check priority threshold
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  const alertPriority = priorityOrder[input.priority as keyof typeof priorityOrder] || 1;
  const minPriority = priorityOrder[prefs.min_priority as keyof typeof priorityOrder] || 1;

  if (alertPriority < minPriority) return;

  const boss = await getBoss();
  const deliveredVia: string[] = ["in_app"]; // WebSocket already handled

  // Queue email if enabled and not using daily digest
  if (prefs.email && !prefs.daily_digest) {
    await boss.send("send-email-alert", {
      to: prefs.email,
      agentName: prefs.name,
      alertSummary: input.summary,
      alertPriority: input.priority,
      alertType: input.alertType,
    });
    deliveredVia.push("email");
  }

  // Update alert with delivery channels
  await query(
    "UPDATE alerts SET delivered_via = $1 WHERE id = $2",
    [deliveredVia, input.alertId]
  );
}
```

- [ ] **Step 3: Create notification workers**

Create `server/modules/notifications/worker.ts`:

```typescript
import { PgBoss } from "pg-boss";
import { sendAlertEmail, sendDigestEmail } from "./email-alerts.js";
import { query } from "../../db/connection.js";

export async function startNotificationWorkers(boss: PgBoss) {
  // Email alert worker
  await boss.createQueue("send-email-alert");

  await boss.work(
    "send-email-alert",
    { localConcurrency: 3 },
    async (jobs) => {
      for (const job of jobs) {
        const data = job.data as {
          to: string;
          agentName: string;
          alertSummary: string;
          alertPriority: string;
          alertType: string;
        };

        console.log(`Sending alert email to ${data.to}...`);
        await sendAlertEmail(data);
      }
    }
  );

  // Daily digest cron — runs at 7:00 AM London time
  await boss.createQueue("send-daily-digest");

  // Schedule the cron (pg-boss v12 schedule API)
  await boss.schedule("send-daily-digest", "0 7 * * *", {}, {
    tz: "Europe/London",
  });

  await boss.work(
    "send-daily-digest",
    { localConcurrency: 1 },
    async () => {
      console.log("Running daily digest...");

      // Find agents with daily_digest enabled
      const agents = await query(
        `SELECT a.id, a.name, a.email
         FROM agents a
         JOIN notification_preferences np ON np.agent_id = a.id
         WHERE np.daily_digest = true AND a.is_active = true`
      );

      for (const agent of agents.rows) {
        // Get alerts from last 24 hours
        const alerts = await query(
          `SELECT summary, priority, created_at
           FROM alerts
           WHERE agent_id = $1 AND created_at > now() - interval '24 hours'
           ORDER BY created_at DESC`,
          [agent.id]
        );

        if (alerts.rows.length === 0) continue;

        await sendDigestEmail({
          to: agent.email,
          agentName: agent.name,
          alerts: alerts.rows.map((a: any) => ({
            summary: a.summary,
            priority: a.priority,
            createdAt: a.created_at,
          })),
        });
      }

      console.log(`Daily digest complete — processed ${agents.rows.length} agent(s)`);
    }
  );

  console.log("Notification workers started (email alerts + daily digest)");
}
```

- [ ] **Step 4: Wire dispatcher into matching service**

Read `server/modules/matching/service.ts`. After each alert is inserted (the INSERT INTO alerts query), add a dispatcher call:

```typescript
        // Dispatch notifications (email, etc.)
        try {
          const { dispatchNotifications } = await import(
            "../notifications/dispatcher.js"
          );
          await dispatchNotifications({
            alertId: "new", // The insert doesn't return id currently
            agentId: agent.id,
            summary,
            priority: score >= 0.8 ? "high" : score >= 0.6 ? "medium" : "low",
            alertType: "match_found",
          });
        } catch {}
```

Actually, we need the alert ID. Read the current INSERT query — it doesn't have RETURNING id. Modify the INSERT to add RETURNING id:

Change:
```sql
INSERT INTO alerts (agent_id, signal_id, match_id, type, priority, summary)
VALUES ($1, $2, $3, 'match_found', $4, $5)
```
To:
```sql
INSERT INTO alerts (agent_id, signal_id, match_id, type, priority, summary)
VALUES ($1, $2, $3, 'match_found', $4, $5)
RETURNING id
```

Then use the returned alert ID in the dispatcher call.

- [ ] **Step 5: Start notification workers in `server/index.ts`**

After the matching worker start, add:

```typescript
  const { startNotificationWorkers } = await import(
    "./modules/notifications/worker.js"
  );
  await startNotificationWorkers(await getBoss());
```

- [ ] **Step 6: Verify**

```bash
pnpm check
pnpm test
```

---

## Task 4: Frontend WebSocket Provider

**Files:**
- Create: `client/src/contexts/WebSocketContext.tsx`
- Create: `client/src/hooks/useWebSocket.ts`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Create WebSocket context**

Create `client/src/contexts/WebSocketContext.tsx`:

```tsx
import {
  createContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from "react";

type EventHandler = (data: unknown) => void;

interface WebSocketState {
  connected: boolean;
  subscribe: (eventType: string, handler: EventHandler) => () => void;
}

export const WebSocketContext = createContext<WebSocketState>({
  connected: false,
  subscribe: () => () => {},
});

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // In dev, WebSocket goes directly to the backend port (proxied via Vite config won't work for WS)
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws`);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        const handlers = listenersRef.current.get(parsed.type);
        if (handlers) {
          for (const handler of handlers) {
            handler(parsed.data);
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected, reconnecting in 3s...");
      setConnected(false);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback(
    (eventType: string, handler: EventHandler): (() => void) => {
      if (!listenersRef.current.has(eventType)) {
        listenersRef.current.set(eventType, new Set());
      }
      listenersRef.current.get(eventType)!.add(handler);

      return () => {
        listenersRef.current.get(eventType)?.delete(handler);
      };
    },
    []
  );

  return (
    <WebSocketContext.Provider value={{ connected, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}
```

- [ ] **Step 2: Create useWebSocket hook**

Create `client/src/hooks/useWebSocket.ts`:

```typescript
import { useContext, useEffect } from "react";
import { WebSocketContext } from "@/contexts/WebSocketContext";

export function useWebSocket() {
  return useContext(WebSocketContext);
}

export function useWebSocketEvent(
  eventType: string,
  handler: (data: any) => void
) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(eventType, handler);
    return unsubscribe;
  }, [eventType, handler, subscribe]);
}
```

- [ ] **Step 3: Wrap App with WebSocketProvider**

Read `client/src/App.tsx`. Add import:

```typescript
import { WebSocketProvider } from "./contexts/WebSocketContext";
```

Wrap inside the `AuthProvider` (WebSocket needs auth to be ready first):

```tsx
<AuthProvider>
  <WebSocketProvider>
    <TooltipProvider>
      ...
    </TooltipProvider>
  </WebSocketProvider>
</AuthProvider>
```

- [ ] **Step 4: Verify**

```bash
pnpm check
```

---

## Task 5: Connect LiveFeed to WebSocket

**Files:**
- Modify: `client/src/pages/LiveFeed.tsx`

- [ ] **Step 1: Add WebSocket event subscriptions to LiveFeed**

Read `client/src/pages/LiveFeed.tsx`. Add import:

```typescript
import { useWebSocketEvent } from "@/hooks/useWebSocket";
```

Inside the LiveFeed component, add state for real-time messages and subscribe to events:

```typescript
const [realTimeMessages, setRealTimeMessages] = useState<any[]>([]);

useWebSocketEvent("livefeed:message", useCallback((data: any) => {
  setRealTimeMessages((prev) => [
    {
      id: data.messageId,
      senderName: data.senderName,
      rawText: data.rawText,
      sourceGroup: data.sourceGroup,
      timestamp: data.timestamp,
      phase: "receiving",
      classification: null,
    },
    ...prev,
  ].slice(0, 50)); // Keep last 50
}, []));

useWebSocketEvent("livefeed:classified", useCallback((data: any) => {
  setRealTimeMessages((prev) =>
    prev.map((msg) =>
      msg.id === data.messageId
        ? {
            ...msg,
            phase: "complete",
            classification: data.type,
            confidence: data.confidence,
            actionable: data.actionable,
          }
        : msg
    )
  );
}, []));
```

Then render a "Real-time Feed" section alongside or above the simulation engine, showing `realTimeMessages`. Use a simple card list:

```tsx
{realTimeMessages.length > 0 && (
  <div className="mb-4">
    <h3 className="text-xs uppercase tracking-wider text-[#77d5c0] mb-2 font-semibold">
      Live from Backend ({realTimeMessages.length})
    </h3>
    <div className="space-y-2">
      {realTimeMessages.slice(0, 10).map((msg) => (
        <div key={msg.id} className="bg-[#22272d] rounded-lg p-3 border border-[#2a2f35]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-white">{msg.senderName}</span>
            {msg.classification && (
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#77d5c0]/20 text-[#77d5c0]">
                {msg.classification}
              </span>
            )}
          </div>
          <p className="text-xs text-[#9ca3af] line-clamp-2">{msg.rawText}</p>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify**

```bash
pnpm check
```

---

## Task 6: Toast Notifications for Alerts

**Files:**
- Modify: `client/src/components/DashboardLayout.tsx`

- [ ] **Step 1: Add alert toast on WebSocket event**

Read `client/src/components/DashboardLayout.tsx`. Add imports:

```typescript
import { useWebSocketEvent } from "@/hooks/useWebSocket";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCallback } from "react";
```

Inside the component, add:

```typescript
const queryClient = useQueryClient();

useWebSocketEvent("alert:new", useCallback((data: any) => {
  // Show toast notification
  toast(data.summary, {
    description: `Priority: ${data.priority}`,
    duration: 8000,
  });

  // Invalidate alerts queries so badge and lists update
  queryClient.invalidateQueries({ queryKey: ["alerts"] });
  queryClient.invalidateQueries({ queryKey: ["analytics"] });
}, [queryClient]));
```

- [ ] **Step 2: Verify**

```bash
pnpm check
pnpm test
```

All 79 tests should still pass.

---

## Task 7: Vite WebSocket Proxy & Final Verification

**Files:**
- Modify: `vite.config.ts` — add WebSocket proxy

- [ ] **Step 1: Add WebSocket proxy to Vite config**

Read `vite.config.ts`. The proxy config currently has:
```
"/api": { target: "http://localhost:3001", changeOrigin: true }
```

Add a WebSocket proxy alongside it:

```typescript
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
```

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

Expected: All 79 tests pass.

- [ ] **Step 3: TypeScript check**

```bash
pnpm check
```

- [ ] **Step 4: End-to-end test**

Restart both servers. Open the app in browser.

1. Open DevTools Console — should see "WebSocket connected"
2. Go to LiveFeed page
3. Type a message in compose box: "New buyer looking for 3 bed in Hampstead, £4m"
4. You should see:
   - The message appear in the "Live from Backend" section on LiveFeed
   - It transitions from "receiving" to showing a classification badge
   - If it matches an existing listing, a toast pops up with the alert
   - The alert badge on the Bell icon updates
5. Check the dev:server terminal — should show email stub logs if notifications dispatched
