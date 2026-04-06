import api from "./client";
import type { Agent } from "@shared/types";

export async function getAgents(page = 1, limit = 20) {
  const { data } = await api.get("/agents", { params: { page, limit } });
  return data as { agents: Agent[]; total: number };
}

export async function getAgentById(id: string) {
  const { data } = await api.get(`/agents/${id}`);
  return data as Agent;
}

export async function createAgent(agent: {
  name: string;
  email: string;
  role?: string;
  coverageAreas: string[];
}) {
  const { data } = await api.post("/agents", agent);
  return data as Agent;
}

export async function updateAgent(
  id: string,
  updates: {
    name?: string;
    email?: string;
    role?: string;
    coverageAreas?: string[];
    isActive?: boolean;
  }
) {
  const { data } = await api.patch(`/agents/${id}`, updates);
  return data as Agent;
}

export async function deleteAgent(id: string) {
  await api.delete(`/agents/${id}`);
}
