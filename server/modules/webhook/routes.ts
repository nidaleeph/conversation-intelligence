import { Router, type Request, type Response } from "express";
import {
  validateSignature,
  extractMessages,
  processWhatsAppMessages,
  type WhatsAppWebhookPayload,
} from "./service.js";

export function webhookRoutes(): Router {
  const router = Router();

  // GET /api/webhooks/whatsapp — Webhook verification (Meta challenge)
  router.get("/whatsapp", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === "subscribe" && token === verifyToken) {
      console.log("[webhook] WhatsApp verification successful");
      res.status(200).send(challenge);
    } else {
      console.warn("[webhook] WhatsApp verification failed — token mismatch");
      res.status(403).send("Forbidden");
    }
  });

  // POST /api/webhooks/whatsapp — Receive messages from Meta
  router.post("/whatsapp", async (req: Request, res: Response) => {
    // Respond immediately — Meta requires 200 within 5 seconds
    res.status(200).send("OK");

    // Validate signature if app secret is configured
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      const signature = req.headers["x-hub-signature-256"] as string;
      const rawBody = (req as any).rawBody as Buffer | undefined;

      if (rawBody && !validateSignature(rawBody, signature, appSecret)) {
        console.warn("[webhook] Invalid signature — ignoring payload");
        return;
      }
    }

    try {
      const payload = req.body as WhatsAppWebhookPayload;

      // Ignore non-WhatsApp events
      if (payload.object !== "whatsapp_business_account") return;

      const messages = extractMessages(payload);
      if (messages.length === 0) return;

      // Use the phone number metadata as group identifier, or fallback
      const sourceGroup =
        payload.entry?.[0]?.changes?.[0]?.value?.metadata
          ?.display_phone_number || "WhatsApp Business API";

      const result = await processWhatsAppMessages(messages, sourceGroup);
      console.log(
        `[webhook] Processed ${result.total} messages (${result.new} new, ${result.duplicates} duplicates)`
      );
    } catch (err) {
      console.error("[webhook] Error processing WhatsApp payload:", err);
    }
  });

  return router;
}
