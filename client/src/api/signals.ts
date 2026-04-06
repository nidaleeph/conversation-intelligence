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
