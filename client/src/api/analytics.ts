import api from "./client";

export async function getKPIs() {
  const { data } = await api.get("/analytics/kpis");
  return data;
}

export async function getDistributions() {
  const { data } = await api.get("/analytics/distributions");
  return data;
}

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
