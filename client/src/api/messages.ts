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
