import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import { COOKIE_NAME } from "@shared/const.js";
import { query } from "../../db/connection.js";

const connections = new Map<string, Set<WebSocket>>();
const allSockets = new Set<WebSocket>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws, req) => {
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

      if (!connections.has(agentId)) {
        connections.set(agentId, new Set());
      }
      connections.get(agentId)!.add(ws);
      allSockets.add(ws);

      console.log(`WebSocket connected: ${agentName} (${agentId})`);
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

export function sendToAgent(agentId: string, event: { type: string; data: unknown }) {
  const sockets = connections.get(agentId);
  if (!sockets) return;
  const message = JSON.stringify(event);
  Array.from(sockets).forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

export function broadcast(event: { type: string; data: unknown }) {
  const message = JSON.stringify(event);
  Array.from(allSockets).forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}
