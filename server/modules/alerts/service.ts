import { query } from "../../db/connection.js";

interface AlertRow {
  id: string;
  agent_id: string;
  signal_id: string;
  match_id: string | null;
  type: string;
  priority: string;
  summary: string;
  read: boolean;
  read_at: string | null;
  delivered_via: string[];
  created_at: string;
  updated_at: string;
}

function toAlert(row: AlertRow) {
  return {
    id: row.id,
    agentId: row.agent_id,
    signalId: row.signal_id,
    matchId: row.match_id,
    type: row.type,
    priority: row.priority,
    summary: row.summary,
    read: row.read,
    readAt: row.read_at,
    deliveredVia: row.delivered_via,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAlerts(
  agentId: string,
  opts: { page: number; limit: number; read?: boolean; type?: string; priority?: string; }
) {
  const conditions: string[] = ["agent_id = $1"];
  const values: unknown[] = [agentId];
  let paramIndex = 2;

  if (opts.read !== undefined) {
    conditions.push(`read = $${paramIndex++}`);
    values.push(opts.read);
  }
  if (opts.type) {
    conditions.push(`type = $${paramIndex++}`);
    values.push(opts.type);
  }
  if (opts.priority) {
    conditions.push(`priority = $${paramIndex++}`);
    values.push(opts.priority);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const countResult = await query(`SELECT count(*) FROM alerts ${where}`, values);
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (opts.page - 1) * opts.limit;
  const result = await query<AlertRow>(
    `SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, opts.limit, offset]
  );

  return { alerts: result.rows.map(toAlert), total };
}

export async function getUnreadCount(agentId: string): Promise<number> {
  const result = await query(
    "SELECT count(*) FROM alerts WHERE agent_id = $1 AND read = false",
    [agentId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function markAlertRead(alertId: string, agentId: string) {
  const result = await query<AlertRow>(
    `UPDATE alerts SET read = true, read_at = now(), updated_at = now()
     WHERE id = $1 AND agent_id = $2 RETURNING *`,
    [alertId, agentId]
  );
  if (result.rows[0]) {
    import("../audit/service.js").then(({ logAudit }) =>
      logAudit({ agentId, action: "alert_read", entityType: "alert", entityId: alertId })
    ).catch(() => {});
  }
  return result.rows[0] ? toAlert(result.rows[0]) : null;
}

export async function markAllRead(agentId: string): Promise<number> {
  const result = await query(
    `UPDATE alerts SET read = true, read_at = now(), updated_at = now()
     WHERE agent_id = $1 AND read = false`,
    [agentId]
  );
  return result.rowCount ?? 0;
}

export async function updateMatchStatus(
  matchId: string,
  agentId: string,
  status: "confirmed" | "dismissed"
) {
  const result = await query(
    `UPDATE matches SET status = $1, confirmed_by = $2, updated_at = now()
     WHERE id = $3 RETURNING id, status`,
    [status, agentId, matchId]
  );
  return result.rows[0] ?? null;
}
