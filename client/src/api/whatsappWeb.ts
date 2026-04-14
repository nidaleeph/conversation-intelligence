import api from "./client";

export interface WhatsAppWebStatus {
  enabled: boolean;
  state: "initializing" | "qr" | "ready" | "disconnected" | "error";
  hasQr: boolean;
  qr: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastError: string | null;
  reconnectAttempts: number;
  uptimeMs: number | null;
  heartbeat: {
    lastCheckAt: string | null;
    ok: boolean | null;
    state: string | null;
    intervalMs: number;
  };
  stats: {
    received: number;
    ingested: number;
    filteredByAllowlist: number;
    lastMessageAt: string | null;
  };
  account: {
    phone: string | null;
    pushname: string | null;
    platform: string | null;
    wwebVersion: string | null;
  };
  config: {
    sessionPath: string;
    allowlist: string[];
    terminalQr: boolean;
  };
}

export async function getWhatsAppWebStatus() {
  const { data } = await api.get("/whatsapp-web/status");
  return data as WhatsAppWebStatus;
}

export async function logoutWhatsAppWeb() {
  const { data } = await api.post("/whatsapp-web/logout");
  return data as { ok: boolean; action: "logout" };
}

export async function reconnectWhatsAppWeb() {
  const { data } = await api.post("/whatsapp-web/reconnect");
  return data as { ok: boolean; action: "reconnect" };
}

// Accounts & groups

export interface WhatsAppAccountRow {
  id: string;
  phone: string;
  pushname: string | null;
  platform: string | null;
  wwebVersion: string | null;
  firstConnectedAt: string;
  lastConnectedAt: string;
  lastDisconnectedAt: string | null;
  isActive: boolean;
}

export interface MonitoredGroupRow {
  id: string;
  accountId: string;
  groupChatId: string;
  groupName: string;
  enabled: boolean;
  messageCount: number;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LiveGroup {
  id: string;
  name: string;
}

export async function getCurrentAccount() {
  const { data } = await api.get("/whatsapp-web/accounts/current");
  return data as { account: WhatsAppAccountRow | null };
}

export async function getMonitoredGroups() {
  const { data } = await api.get("/whatsapp-web/groups");
  return data as { accountId: string | null; groups: MonitoredGroupRow[] };
}

export async function getLiveGroups() {
  const { data } = await api.get("/whatsapp-web/live-groups");
  return data as { groups: LiveGroup[] };
}

export async function addMonitoredGroup(input: {
  groupChatId: string;
  groupName: string;
  enabled?: boolean;
}) {
  const { data } = await api.post("/whatsapp-web/groups", input);
  return data as { group: MonitoredGroupRow };
}

export async function updateMonitoredGroup(
  id: string,
  input: { enabled?: boolean; groupName?: string }
) {
  const { data } = await api.patch(`/whatsapp-web/groups/${id}`, input);
  return data as { group: MonitoredGroupRow };
}

export async function deleteMonitoredGroup(id: string) {
  const { data } = await api.delete(`/whatsapp-web/groups/${id}`);
  return data as { ok: boolean };
}
