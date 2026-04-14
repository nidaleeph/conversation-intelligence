import crypto from "node:crypto";
import { ingestMessage } from "../ingestion/service.js";

// Meta's webhook payload types
interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface WhatsAppChange {
  value: {
    messaging_product: string;
    metadata: {
      display_phone_number: string;
      phone_number_id: string;
    };
    contacts?: WhatsAppContact[];
    messages?: WhatsAppMessage[];
    statuses?: unknown[];
  };
  field: string;
}

interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppEntry[];
}

interface ExtractedMessage {
  senderName: string;
  senderPhone: string;
  rawText: string;
  externalId: string;
  timestamp: string;
}

/**
 * Validate that the request came from Meta using HMAC-SHA256 signature.
 */
export function validateSignature(
  rawBody: Buffer,
  signature: string | undefined,
  appSecret: string
): boolean {
  if (!signature) return false;

  const expectedSig =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSig)
  );
}

/**
 * Extract text messages from Meta's nested webhook payload.
 * Ignores status updates, reactions, images, etc. — only text messages.
 */
export function extractMessages(
  payload: WhatsAppWebhookPayload
): ExtractedMessage[] {
  const messages: ExtractedMessage[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;

      const value = change.value;
      if (!value.messages) continue;

      // Build a lookup of wa_id -> profile name
      const contactMap = new Map<string, string>();
      if (value.contacts) {
        for (const contact of value.contacts) {
          contactMap.set(contact.wa_id, contact.profile.name);
        }
      }

      for (const msg of value.messages) {
        // Only process text messages for now
        if (msg.type !== "text" || !msg.text?.body) continue;

        messages.push({
          senderName: contactMap.get(msg.from) || msg.from,
          senderPhone: msg.from,
          rawText: msg.text.body,
          externalId: msg.id,
          timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
        });
      }
    }
  }

  return messages;
}

/**
 * Process extracted WhatsApp messages through the existing ingestion pipeline.
 */
export async function processWhatsAppMessages(
  messages: ExtractedMessage[],
  sourceGroup: string
): Promise<{ total: number; new: number; duplicates: number }> {
  let newCount = 0;
  let dupCount = 0;

  for (const msg of messages) {
    const result = await ingestMessage({
      sourceGroup,
      senderName: msg.senderName,
      senderPhone: msg.senderPhone,
      rawText: msg.rawText,
      platform: "whatsapp-business-api",
    });

    if (result.duplicate) {
      dupCount++;
    } else {
      newCount++;
    }
  }

  return { total: messages.length, new: newCount, duplicates: dupCount };
}
