import { query } from "../../db/connection.js";
import { getBoss } from "../../db/boss.js";
import { generateFingerprint } from "./fingerprint.js";

interface IngestInput {
  sourceGroup: string;
  senderName: string;
  senderPhone: string;
  rawText: string;
  platform: string;
}

interface IngestResult {
  messageId: string;
  duplicate: boolean;
}

export async function ingestMessage(
  input: IngestInput
): Promise<IngestResult> {
  const fingerprint = generateFingerprint(
    input.rawText,
    input.senderName,
    input.sourceGroup
  );

  // Check for duplicate
  const existing = await query(
    "SELECT id FROM messages WHERE fingerprint = $1",
    [fingerprint]
  );

  if (existing.rows.length > 0) {
    return { messageId: existing.rows[0].id, duplicate: true };
  }

  // Insert message
  const result = await query(
    `INSERT INTO messages (source_group, sender_name, sender_phone, raw_text, platform, fingerprint)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.sourceGroup,
      input.senderName,
      input.senderPhone,
      input.rawText,
      input.platform,
      fingerprint,
    ]
  );

  const messageId = result.rows[0].id;

  // Broadcast to all connected clients
  try {
    const { broadcast } = await import("../notifications/websocket.js");
    broadcast({
      type: "livefeed:message",
      data: {
        messageId,
        senderName: input.senderName,
        sourceGroup: input.sourceGroup,
        rawText: input.rawText,
        platform: input.platform,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {}

  // Fire-and-forget audit log
  import("../audit/service.js").then(({ logAudit }) =>
    logAudit({ agentId: null, action: "message_received", entityType: "message", entityId: messageId })
  ).catch(() => {});

  // Queue classification job
  const boss = await getBoss();
  await boss.send("classify-message", {
    messageId,
    rawText: input.rawText,
    senderName: input.senderName,
    sourceGroup: input.sourceGroup,
  });

  return { messageId, duplicate: false };
}
