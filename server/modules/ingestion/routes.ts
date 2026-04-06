import { Router } from "express";
import {
  ingestMessageSchema,
  ingestBatchSchema,
} from "@shared/schemas.js";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js";
import { createError } from "../../middleware/error.js";
import { ingestMessage } from "./service.js";

export function ingestionRoutes(): Router {
  const router = Router();

  // GET /api/messages — list messages (served alongside ingest routes)
  router.get(
    "/",
    requireAuth,
    async (req, res, next) => {
      try {
        const { messageFilterSchema } = await import("@shared/schemas.js");
        const { listMessages } = await import("../messages/service.js");
        const filters = messageFilterSchema.parse(req.query);
        const result = await listMessages(filters);
        res.json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/messages/ingest — single message
  router.post(
    "/ingest",
    requireAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = ingestMessageSchema.safeParse(req.body);
        if (!parsed.success) {
          throw createError(400, "Invalid message data");
        }

        const result = await ingestMessage(parsed.data);
        res.status(result.duplicate ? 200 : 201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/messages/ingest/batch — multiple messages
  router.post(
    "/ingest/batch",
    requireAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = ingestBatchSchema.safeParse(req.body);
        if (!parsed.success) {
          throw createError(400, "Invalid batch data");
        }

        const results = [];
        for (const msg of parsed.data.messages) {
          const result = await ingestMessage(msg);
          results.push(result);
        }

        const newCount = results.filter((r) => !r.duplicate).length;
        const dupCount = results.filter((r) => r.duplicate).length;

        res.status(201).json({
          total: results.length,
          new: newCount,
          duplicates: dupCount,
          results,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
