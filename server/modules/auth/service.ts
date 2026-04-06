import crypto from "node:crypto";
import { query, getClient } from "../../db/connection.js";
import { MAGIC_LINK_EXPIRY_MS, SESSION_MAX_AGE_MS } from "@shared/const.js";

export async function createMagicLinkToken(
  email: string
): Promise<string | null> {
  const agentResult = await query(
    "SELECT id, is_active FROM agents WHERE email = $1",
    [email]
  );

  const agent = agentResult.rows[0];
  if (!agent || !agent.is_active) return null;

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS);

  const sessionResult = await query(
    `INSERT INTO sessions (agent_id, token, expires_at)
     VALUES ($1, $2, $3)
     RETURNING token`,
    [agent.id, token, expiresAt]
  );

  return sessionResult.rows[0].token;
}

export async function verifyMagicLinkToken(
  token: string
): Promise<{ sessionId: string; agentId: string } | null> {
  const result = await query(
    `SELECT id, agent_id, expires_at, verified
     FROM sessions WHERE token = $1`,
    [token]
  );

  const session = result.rows[0];
  if (!session) return null;
  if (session.verified) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  const client = await getClient();
  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE sessions SET verified = true WHERE id = $1",
      [session.id]
    );

    const newExpiry = new Date(Date.now() + SESSION_MAX_AGE_MS);
    const newToken = crypto.randomUUID();
    const newSession = await client.query(
      `INSERT INTO sessions (agent_id, token, expires_at, verified)
       VALUES ($1, $2, $3, true)
       RETURNING id, agent_id`,
      [session.agent_id, newToken, newExpiry]
    );

    await client.query("COMMIT");
    return {
      sessionId: newSession.rows[0].id,
      agentId: newSession.rows[0].agent_id,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function refreshSession(sessionId: string): Promise<void> {
  const newExpiry = new Date(Date.now() + SESSION_MAX_AGE_MS);
  await query("UPDATE sessions SET expires_at = $1 WHERE id = $2", [
    newExpiry,
    sessionId,
  ]);
}

export async function destroySession(sessionId: string): Promise<void> {
  await query("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

export async function destroyAllAgentSessions(
  agentId: string
): Promise<void> {
  await query("DELETE FROM sessions WHERE agent_id = $1", [agentId]);
}
