import api from "./client";

export async function requestMagicLink(email: string) {
  const { data } = await api.post("/auth/login", { email });
  return data;
}

export async function verifyMagicLink(token: string) {
  const { data } = await api.get("/auth/verify", { params: { token } });
  return data;
}

export async function logout() {
  const { data } = await api.post("/auth/logout");
  return data;
}

export async function getCurrentUser() {
  const { data } = await api.get("/auth/me");
  return data.agent;
}
