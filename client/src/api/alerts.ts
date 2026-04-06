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

export async function updateMatchStatus(matchId: string, status: "confirmed" | "dismissed") {
  const { data } = await api.patch(`/alerts/matches/${matchId}`, { status });
  return data;
}
