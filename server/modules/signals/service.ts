import { query } from "../../db/connection.js";
import type { SignalType } from "@shared/types.js";

interface SignalRow {
  id: string;
  message_id: string;
  type: string;
  classification_method: string;
  confidence: number;
  location: string[];
  postcodes: string[];
  budget_min: number | null;
  budget_max: number | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  outside_space: boolean | null;
  parking: boolean | null;
  condition: string | null;
  summary: string;
  status: string;
  reviewed_by: string | null;
  actionable: boolean;
  created_at: string;
  updated_at: string;
}

function toSignal(row: SignalRow) {
  return {
    id: row.id,
    messageId: row.message_id,
    type: row.type as SignalType,
    classificationMethod: row.classification_method,
    confidence: parseFloat(String(row.confidence)),
    location: row.location,
    postcodes: row.postcodes,
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
    propertyType: row.property_type,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    sqft: row.sqft,
    outsideSpace: row.outside_space,
    parking: row.parking,
    condition: row.condition,
    summary: row.summary,
    status: row.status,
    reviewedBy: row.reviewed_by,
    actionable: row.actionable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSignals(opts: {
  page: number;
  limit: number;
  type?: string;
  status?: string;
  needsReview?: boolean;
}) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (opts.type) {
    conditions.push(`type = $${paramIndex++}`);
    values.push(opts.type);
  }
  if (opts.status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(opts.status);
  }
  if (opts.needsReview) {
    conditions.push(`confidence < 0.85 AND status = 'new'`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query(
    `SELECT count(*) FROM signals ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (opts.page - 1) * opts.limit;
  const result = await query<SignalRow>(
    `SELECT * FROM signals ${where} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, opts.limit, offset]
  );

  return { signals: result.rows.map(toSignal), total };
}

export async function getSignalById(id: string) {
  const result = await query<SignalRow>(
    "SELECT * FROM signals WHERE id = $1",
    [id]
  );
  return result.rows[0] ? toSignal(result.rows[0]) : null;
}

export async function reviewSignal(
  id: string,
  agentId: string,
  data: { approved: boolean; reviewedType?: SignalType }
) {
  const updates: string[] = [
    "status = 'reviewed'",
    `reviewed_by = $1`,
    `updated_at = now()`,
  ];
  const values: unknown[] = [agentId];
  let paramIndex = 2;

  if (data.reviewedType) {
    updates.push(`type = $${paramIndex++}`);
    values.push(data.reviewedType);
  }

  if (!data.approved) {
    updates.push(`actionable = false`);
  }

  values.push(id);

  const result = await query<SignalRow>(
    `UPDATE signals SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result.rows[0] ? toSignal(result.rows[0]) : null;
}
