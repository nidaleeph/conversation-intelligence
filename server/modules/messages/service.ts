import { query } from "../../db/connection.js";

interface MessageRow {
  id: string;
  source_group: string;
  sender_name: string;
  sender_phone: string;
  raw_text: string;
  platform: string;
  received_at: string;
  fingerprint: string;
  classified: boolean;
  created_at: string;
}

function toMessage(row: MessageRow) {
  return {
    id: row.id,
    sourceGroup: row.source_group,
    senderName: row.sender_name,
    senderPhone: row.sender_phone,
    rawText: row.raw_text,
    platform: row.platform,
    receivedAt: row.received_at,
    fingerprint: row.fingerprint,
    classified: row.classified,
    createdAt: row.created_at,
  };
}

export async function listMessages(opts: {
  page: number;
  limit: number;
  search?: string;
  classified?: boolean;
}) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (opts.search) {
    conditions.push(
      `(raw_text ILIKE $${paramIndex} OR sender_name ILIKE $${paramIndex})`
    );
    values.push(`%${opts.search}%`);
    paramIndex++;
  }
  if (opts.classified !== undefined) {
    conditions.push(`classified = $${paramIndex++}`);
    values.push(opts.classified);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query(
    `SELECT count(*) FROM messages ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (opts.page - 1) * opts.limit;
  const result = await query<MessageRow>(
    `SELECT * FROM messages ${where} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, opts.limit, offset]
  );

  return { messages: result.rows.map(toMessage), total };
}
