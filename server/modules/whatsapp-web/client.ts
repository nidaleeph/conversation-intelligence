import pkg from "whatsapp-web.js";
// @ts-expect-error — qrcode-terminal has no types
import qrcode from "qrcode-terminal";
import path from "node:path";
import fs from "node:fs/promises";
import { ingestMessage } from "../ingestion/service.js";
import {
  upsertAccountOnConnect,
  markAccountDisconnected,
  getEnabledGroupsForAccount,
  recordGroupMessage,
} from "./service.js";

const { Client, LocalAuth } = pkg;
type WAClient = InstanceType<typeof Client>;

const HEARTBEAT_INTERVAL_MS = 60_000; // 60s

interface ClientStatus {
  state: "initializing" | "qr" | "ready" | "disconnected" | "error";
  lastQr: string | null;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  lastError: string | null;
  reconnectAttempts: number;
  // Heartbeat
  lastHeartbeatAt: Date | null;
  lastHeartbeatOk: boolean | null;
  lastHeartbeatState: string | null;
  // Message stats
  messagesReceived: number;
  messagesIngested: number;
  messagesFilteredByAllowlist: number;
  lastMessageAt: Date | null;
  // Client info (populated after ready)
  clientInfo: {
    phone: string | null;
    pushname: string | null;
    platform: string | null;
    wwebVersion: string | null;
  };
}

const status: ClientStatus = {
  state: "initializing",
  lastQr: null,
  connectedAt: null,
  disconnectedAt: null,
  lastError: null,
  reconnectAttempts: 0,
  lastHeartbeatAt: null,
  lastHeartbeatOk: null,
  lastHeartbeatState: null,
  messagesReceived: 0,
  messagesIngested: 0,
  messagesFilteredByAllowlist: 0,
  lastMessageAt: null,
  clientInfo: {
    phone: null,
    pushname: null,
    platform: null,
    wwebVersion: null,
  },
};

let client: WAClient | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let activeAccountId: string | null = null;
let enabledGroupChatIds: Set<string> | null = null; // null = permissive (monitor all)
let lastPhone: string | null = null;

// Broadcast a state change over WebSocket so connected UIs update instantly.
function broadcastStateChange(reason: string): void {
  console.log(`[wwebjs] broadcasting state change: ${status.state} (${reason})`);
  // Lazy import to avoid circular deps at module load time.
  import("../notifications/websocket.js")
    .then(({ broadcast }) => {
      broadcast({
        type: "whatsapp:status",
        data: {
          state: status.state,
          reason,
          hasQr: status.lastQr !== null,
          phone: status.clientInfo.phone,
          pushname: status.clientInfo.pushname,
        },
      });
    })
    .catch((err) => {
      console.error("[wwebjs] broadcast failed:", err);
    });
}

/**
 * Ensure the current live session is upserted into the DB and activeAccountId is populated.
 * Self-healing fallback for when the in-memory state lost sync with reality
 * (e.g. server restarted via --watch after the ready event already fired).
 */
export async function ensureAccountFromCurrentSession(): Promise<string | null> {
  if (activeAccountId) return activeAccountId;
  if (!status.clientInfo.phone) return null;

  try {
    const account = await upsertAccountOnConnect({
      phone: status.clientInfo.phone,
      pushname: status.clientInfo.pushname,
      platform: status.clientInfo.platform,
      wwebVersion: status.clientInfo.wwebVersion,
    });
    activeAccountId = account.id;
    lastPhone = account.phone;
    await refreshAllowlistFromDb();
    return activeAccountId;
  } catch (err) {
    console.error("[wwebjs] ensureAccountFromCurrentSession failed:", err);
    return null;
  }
}

export async function refreshAllowlistFromDb(): Promise<void> {
  if (!activeAccountId) {
    enabledGroupChatIds = null;
    return;
  }
  const enabled = await getEnabledGroupsForAccount(activeAccountId);
  enabledGroupChatIds = enabled === null ? null : new Set(enabled.map((g) => g.groupChatId));
  console.log(
    `[wwebjs] allowlist refreshed: ${
      enabledGroupChatIds === null
        ? "permissive (all groups)"
        : `${enabledGroupChatIds.size} enabled group(s)`
    }`
  );
}

export function getActiveAccountId(): string | null {
  return activeAccountId;
}

export async function listLiveGroups(): Promise<Array<{ id: string; name: string }>> {
  if (!client || status.state !== "ready") return [];
  try {
    const chats = await (client as any).getChats();
    return chats
      .filter((c: any) => c.isGroup)
      .map((c: any) => ({
        id: c.id?._serialized || c.id,
        name: c.name || "Unnamed group",
      }));
  } catch (err) {
    console.error("[wwebjs] failed to list live groups:", err);
    return [];
  }
}

export interface StatusSnapshot extends ClientStatus {
  config: {
    enabled: boolean;
    sessionPath: string;
    allowlist: string[];
    terminalQr: boolean;
    heartbeatIntervalMs: number;
  };
  uptimeMs: number | null;
}

export function getWhatsAppStatus(): StatusSnapshot {
  const uptimeMs = status.connectedAt
    ? Date.now() - status.connectedAt.getTime()
    : null;

  return {
    ...status,
    config: {
      enabled: process.env.WHATSAPP_WEB_ENABLED === "true",
      sessionPath:
        process.env.WHATSAPP_WEB_SESSION_PATH ||
        path.resolve(process.cwd(), "whatsapp-session"),
      allowlist: parseAllowlist(),
      terminalQr: process.env.WHATSAPP_WEB_TERMINAL_QR === "true",
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    },
    uptimeMs,
  };
}

function parseAllowlist(): string[] {
  const raw = process.env.WHATSAPP_WEB_GROUP_ALLOWLIST;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function startWhatsAppClient(): Promise<void> {
  if (process.env.WHATSAPP_WEB_ENABLED !== "true") {
    console.log("[wwebjs] disabled (set WHATSAPP_WEB_ENABLED=true to enable)");
    return;
  }

  const sessionPath =
    process.env.WHATSAPP_WEB_SESSION_PATH ||
    path.resolve(process.cwd(), "whatsapp-session");
  const allowlist = parseAllowlist();

  console.log("[wwebjs] starting client");
  console.log(`[wwebjs] session path: ${sessionPath}`);
  if (allowlist.length > 0) {
    console.log(`[wwebjs] group allowlist: ${allowlist.join(", ")}`);
  } else {
    console.log("[wwebjs] group allowlist: all groups");
  }

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    },
  });

  client.on("qr", (qr: string) => {
    status.state = "qr";
    status.lastQr = qr;
    console.log("[wwebjs] QR code ready — open the Live Feed page to scan");
    if (process.env.WHATSAPP_WEB_TERMINAL_QR === "true") {
      qrcode.generate(qr, { small: true });
    }
    broadcastStateChange("qr");
  });

  client.on("authenticated", () => {
    console.log("[wwebjs] authenticated");
    status.lastQr = null;
  });

  client.on("auth_failure", (msg: string) => {
    status.state = "error";
    status.lastError = `auth_failure: ${msg}`;
    console.error("[wwebjs] auth failed:", msg);
    broadcastStateChange("auth_failure");
  });

  client.on("ready", async () => {
    status.state = "ready";
    status.connectedAt = new Date();
    status.disconnectedAt = null;
    status.lastError = null;
    status.reconnectAttempts = 0;
    console.log("[wwebjs] ready — monitoring groups");

    // Capture client info
    try {
      const info = (client as any)?.info;
      if (info) {
        status.clientInfo = {
          phone: info.wid?.user || null,
          pushname: info.pushname || null,
          platform: info.platform || null,
          wwebVersion: info.phone?.wa_version || null,
        };
      }
    } catch {}

    // Upsert account in DB and load allowlist
    if (status.clientInfo.phone) {
      try {
        const account = await upsertAccountOnConnect({
          phone: status.clientInfo.phone,
          pushname: status.clientInfo.pushname,
          platform: status.clientInfo.platform,
          wwebVersion: status.clientInfo.wwebVersion,
        });
        activeAccountId = account.id;
        lastPhone = account.phone;
        await refreshAllowlistFromDb();
      } catch (err) {
        console.error("[wwebjs] failed to upsert account / load allowlist:", err);
      }
    }

    startHeartbeat();
    broadcastStateChange("ready");
  });

  client.on("message", async (msg: any) => {
    try {
      const chat = await msg.getChat();
      if (!chat.isGroup) return;

      status.messagesReceived += 1;
      status.lastMessageAt = new Date();

      const chatId: string = chat.id?._serialized || chat.id || "";

      // Apply DB-backed allowlist (null = permissive: monitor all)
      if (enabledGroupChatIds !== null && !enabledGroupChatIds.has(chatId)) {
        status.messagesFilteredByAllowlist += 1;
        return;
      }

      // Legacy env-based allowlist (kept as secondary filter if set)
      if (allowlist.length > 0 && !allowlist.includes(chat.name)) {
        status.messagesFilteredByAllowlist += 1;
        return;
      }

      const senderName =
        msg._data?.notifyName ||
        (await msg.getContact().then((c: any) => c.pushname || c.name).catch(() => null)) ||
        "Unknown";

      await ingestMessage({
        sourceGroup: chat.name,
        senderName,
        senderPhone: msg.from,
        rawText: msg.body || "",
        platform: "whatsapp-web",
      });

      status.messagesIngested += 1;

      // Record stats on the monitored_groups row if it exists (no-op if permissive)
      if (activeAccountId) {
        recordGroupMessage({
          accountId: activeAccountId,
          groupChatId: chatId,
        }).catch(() => {});
      }
    } catch (err) {
      console.error("[wwebjs] error processing message:", err);
    }
  });

  client.on("disconnected", (reason: string) => {
    status.state = "disconnected";
    status.disconnectedAt = new Date();
    status.lastError = `disconnected: ${reason}`;
    console.warn("[wwebjs] disconnected:", reason);

    stopHeartbeat();

    if (lastPhone) {
      markAccountDisconnected(lastPhone).catch(() => {});
    }

    broadcastStateChange(`disconnected:${reason}`);

    if (reason === "LOGOUT" || reason === "UNPAIRED") {
      console.error(
        "[wwebjs] session lost — a human must re-scan the QR code on the phone"
      );
      return;
    }

    scheduleReconnect();
  });

  await client.initialize().catch((err: Error) => {
    status.state = "error";
    status.lastError = `initialize failed: ${err.message}`;
    console.error("[wwebjs] initialize failed:", err);
    broadcastStateChange("initialize_failed");
    scheduleReconnect();
  });
}

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    runHeartbeatCheck().catch(() => {});
  }, HEARTBEAT_INTERVAL_MS);
  // Run one immediately so status populates fast
  runHeartbeatCheck().catch(() => {});
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function runHeartbeatCheck(): Promise<void> {
  if (!client) return;
  try {
    const state = await (client as any).getState?.();
    status.lastHeartbeatAt = new Date();
    status.lastHeartbeatState = state || null;
    status.lastHeartbeatOk = state === "CONNECTED";

    if (state !== "CONNECTED" && status.state === "ready") {
      console.warn(`[wwebjs] heartbeat state=${state} — marking disconnected`);
      status.state = "disconnected";
      status.disconnectedAt = new Date();
      status.lastError = `heartbeat state: ${state}`;
      scheduleReconnect();
    }
  } catch (err: any) {
    status.lastHeartbeatAt = new Date();
    status.lastHeartbeatOk = false;
    status.lastHeartbeatState = `error: ${err?.message || "unknown"}`;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  status.reconnectAttempts += 1;
  const delay = Math.min(3000 * 2 ** Math.min(status.reconnectAttempts - 1, 5), 60000);
  console.log(`[wwebjs] reconnecting in ${delay}ms (attempt ${status.reconnectAttempts})`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;

    // Fully destroy the old client (releases the browser lock on session dir)
    // before starting a fresh client. Re-using client.initialize() on the same
    // instance fails with "browser already running" because Puppeteer holds
    // a lock on the userDataDir until destroy() releases it.
    if (client) {
      try {
        await client.destroy();
      } catch (err) {
        console.warn("[wwebjs] destroy during reconnect failed:", err);
      }
      client = null;
    }

    try {
      await startWhatsAppClient();
    } catch (err) {
      console.error("[wwebjs] reconnect failed:", err);
      scheduleReconnect();
    }
  }, delay);
}

export async function stopWhatsAppClient(): Promise<void> {
  stopHeartbeat();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (client) {
    try {
      await client.destroy();
    } catch {}
    client = null;
  }
  status.state = "disconnected";
}

/**
 * Log out the current session, wipe the stored credentials, and start fresh.
 * Forces a new QR scan — used for switching to a different WhatsApp account.
 */
export async function logoutWhatsAppClient(): Promise<void> {
  console.log("[wwebjs] logout requested — wiping session");
  stopHeartbeat();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (client) {
    try {
      await client.logout();
    } catch (err) {
      console.warn("[wwebjs] logout call failed (session may already be gone):", err);
    }
    try {
      await client.destroy();
    } catch {}
    client = null;
  }

  // Wipe session files so the next start requires a fresh QR scan
  const sessionPath =
    process.env.WHATSAPP_WEB_SESSION_PATH ||
    path.resolve(process.cwd(), "whatsapp-session");

  try {
    await fs.rm(sessionPath, { recursive: true, force: true });
    console.log(`[wwebjs] session files wiped at ${sessionPath}`);
  } catch (err) {
    console.warn("[wwebjs] failed to wipe session files:", err);
  }

  resetStatus();
  status.state = "initializing";

  // Auto-start a fresh client so the UI gets a QR to scan
  startWhatsAppClient().catch((err) => {
    console.error("[wwebjs] restart after logout failed:", err);
  });
}

/**
 * Reconnect by destroying the current browser session and re-initializing.
 * Keeps the stored credentials — does NOT require a new QR scan.
 */
export async function reconnectWhatsAppClient(): Promise<void> {
  console.log("[wwebjs] reconnect requested");
  stopHeartbeat();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (client) {
    try {
      await client.destroy();
    } catch {}
    client = null;
  }

  resetStatus();
  status.state = "initializing";

  await startWhatsAppClient();
}

function resetStatus(): void {
  status.lastQr = null;
  status.connectedAt = null;
  status.disconnectedAt = null;
  status.lastError = null;
  status.reconnectAttempts = 0;
  status.lastHeartbeatAt = null;
  status.lastHeartbeatOk = null;
  status.lastHeartbeatState = null;
  status.messagesReceived = 0;
  status.messagesIngested = 0;
  status.messagesFilteredByAllowlist = 0;
  status.lastMessageAt = null;
  status.clientInfo = {
    phone: null,
    pushname: null,
    platform: null,
    wwebVersion: null,
  };
  activeAccountId = null;
  enabledGroupChatIds = null;
  lastPhone = null;
}
