import { Router } from "express";
import { auditFilterSchema } from "@shared/schemas.js";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../../middleware/auth.js";
import { listAuditLog } from "./service.js";

export function auditRoutes(): Router {
  const router = Router();
  router.use(requireAuth);
  router.use(requireAdmin);

  router.get("/", async (req, res, next) => {
    try {
      const filters = auditFilterSchema.parse(req.query);
      const result = await listAuditLog(filters);
      res.json(result);
    } catch (err) { next(err); }
  });

  return router;
}
