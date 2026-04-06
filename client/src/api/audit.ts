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
