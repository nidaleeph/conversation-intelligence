import { query } from "../../db/connection.js";

interface AuditInput {
  agentId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (agent_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.agentId, input.action, input.entityType, input.entityId, JSON.stringify(input.metadata ?? {})]
    );
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}

interface AuditRow {
  id: string; agent_id: string | null; action: string;
  entity_type: string; entity_id: string;
  metadata: Record<string, unknown>; created_at: string;
}

function toAuditEntry(row: AuditRow) {
  return {
    id: row.id, agentId: row.agent_id, action: row.action,
    entityType: row.entity_type, entityId: row.entity_id,
    metadata: row.metadata, createdAt: row.created_at,
  };
}

export async function listAuditLog(opts: {
  page: number; limit: number;
  entityType?: string; action?: string; agentId?: string;
}) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (opts.entityType) { conditions.push(`entity_type = $${paramIndex++}`); values.push(opts.entityType); }
  if (opts.action) { conditions.push(`action = $${paramIndex++}`); values.push(opts.action); }
  if (opts.agentId) { conditions.push(`agent_id = $${paramIndex++}`); values.push(opts.agentId); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query(`SELECT count(*) FROM audit_log ${where}`, values);
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (opts.page - 1) * opts.limit;
  const result = await query<AuditRow>(
    `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, opts.limit, offset]
  );

  return { entries: result.rows.map(toAuditEntry), total };
}
