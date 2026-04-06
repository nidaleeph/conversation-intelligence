import { Router } from "express";
import { alertFilterSchema, updateAlertSchema, updateMatchSchema } from "@shared/schemas.js";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js";
import { createError } from "../../middleware/error.js";
import { listAlerts, getUnreadCount, markAlertRead, markAllRead, updateMatchStatus } from "./service.js";

export function alertsRoutes(): Router {
  const router = Router();
  router.use(requireAuth);

  // GET /api/alerts
  router.get("/", async (req: AuthenticatedRequest, res, next) => {
    try {
      const filters = alertFilterSchema.parse(req.query);
      const result = await listAlerts(req.agent!.id, filters);
      res.json(result);
    } catch (err) { next(err); }
  });

  // GET /api/alerts/unread-count
  router.get("/unread-count", async (req: AuthenticatedRequest, res, next) => {
    try {
      const count = await getUnreadCount(req.agent!.id);
      res.json({ count });
    } catch (err) { next(err); }
  });

  // POST /api/alerts/mark-all-read
  router.post("/mark-all-read", async (req: AuthenticatedRequest, res, next) => {
    try {
      const updated = await markAllRead(req.agent!.id);
      res.json({ updated });
    } catch (err) { next(err); }
  });

  // PATCH /api/alerts/:id
  router.patch("/:id", async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = updateAlertSchema.safeParse(req.body);
      if (!parsed.success) throw createError(400, "Invalid data");
      const alert = await markAlertRead(req.params.id, req.agent!.id);
      if (!alert) throw createError(404, "Alert not found");
      res.json(alert);
    } catch (err) { next(err); }
  });

  // PATCH /api/alerts/matches/:id
  router.patch("/matches/:id", async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = updateMatchSchema.safeParse(req.body);
      if (!parsed.success) throw createError(400, "Invalid data");
      const match = await updateMatchStatus(req.params.id, req.agent!.id, parsed.data.status);
      if (!match) throw createError(404, "Match not found");

      import("../audit/service.js").then(({ logAudit }) =>
        logAudit({
          agentId: req.agent!.id,
          action: parsed.data.status === "confirmed" ? "match_confirmed" : "match_dismissed",
          entityType: "match",
          entityId: req.params.id,
        })
      ).catch(() => {});

      res.json(match);
    } catch (err) { next(err); }
  });

  return router;
}
