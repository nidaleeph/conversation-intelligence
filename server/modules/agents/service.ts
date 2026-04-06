import { query } from "../../db/connection.js";

interface AgentRow {
  id: string;
  name: string;
  email: string;
  role: string;
  coverage_areas: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function toAgent(row: AgentRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    coverageAreas: row.coverage_areas,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAgents(opts: { page: number; limit: number }) {
  const offset = (opts.page - 1) * opts.limit;

  const countResult = await query("SELECT count(*) FROM agents");
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query<AgentRow>(
    `SELECT * FROM agents ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [opts.limit, offset]
  );

  return { agents: result.rows.map(toAgent), total };
}

export async function getAgentById(id: string) {
  const result = await query<AgentRow>(
    "SELECT * FROM agents WHERE id = $1",
    [id]
  );
  return result.rows[0] ? toAgent(result.rows[0]) : null;
}

export async function getAgentByEmail(email: string) {
  const result = await query<AgentRow>(
    "SELECT * FROM agents WHERE email = $1",
    [email]
  );
  return result.rows[0] ? toAgent(result.rows[0]) : null;
}

export async function createAgent(data: {
  name: string;
  email: string;
  role: string;
  coverageAreas: string[];
}) {
  const result = await query<AgentRow>(
    `INSERT INTO agents (name, email, role, coverage_areas)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.name, data.email, data.role, data.coverageAreas]
  );
  return toAgent(result.rows[0]);
}

export async function updateAgent(
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: string;
    coverageAreas?: string[];
    isActive?: boolean;
  }
) {
  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    sets.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.email !== undefined) {
    sets.push(`email = $${paramIndex++}`);
    values.push(data.email);
  }
  if (data.role !== undefined) {
    sets.push(`role = $${paramIndex++}`);
    values.push(data.role);
  }
  if (data.coverageAreas !== undefined) {
    sets.push(`coverage_areas = $${paramIndex++}`);
    values.push(data.coverageAreas);
  }
  if (data.isActive !== undefined) {
    sets.push(`is_active = $${paramIndex++}`);
    values.push(data.isActive);
  }

  if (sets.length === 0) {
    return getAgentById(id);
  }

  sets.push(`updated_at = now()`);
  values.push(id);

  const result = await query<AgentRow>(
    `UPDATE agents SET ${sets.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result.rows[0] ? toAgent(result.rows[0]) : null;
}

export async function deleteAgent(id: string): Promise<boolean> {
  const result = await query("DELETE FROM agents WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
