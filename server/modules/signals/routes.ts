import { Router } from "express";
import {
  signalFilterSchema,
  reviewSignalSchema,
} from "@shared/schemas.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";
import { createError } from "../../middleware/error.js";
import { listSignals, getSignalById, reviewSignal } from "./service.js";

export function signalsRoutes(): Router {
  const router = Router();

  router.use(requireAuth);

  // GET /api/signals
  router.get("/", async (req, res, next) => {
    try {
      const filters = signalFilterSchema.parse(req.query);
      const result = await listSignals(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/signals/:id
  router.get("/:id", async (req, res, next) => {
    try {
      const signal = await getSignalById(req.params.id);
      if (!signal) throw createError(404, "Signal not found");
      res.json(signal);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/signals/:id/review
  router.post(
    "/:id/review",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = reviewSignalSchema.safeParse(req.body);
        if (!parsed.success) {
          throw createError(400, "Invalid review data");
        }

        const signal = await reviewSignal(
          req.params.id,
          req.agent!.id,
          parsed.data
        );
        if (!signal) throw createError(404, "Signal not found");

        import("../audit/service.js").then(({ logAudit }) =>
          logAudit({
            agentId: req.agent!.id,
            action: "signal_reviewed",
            entityType: "signal",
            entityId: req.params.id,
            metadata: parsed.data,
          })
        ).catch(() => {});

        res.json(signal);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
