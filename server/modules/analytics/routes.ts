import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { getKPIs, getDistributions, getClassificationHealth, getAgentActivity, getSignalVolume } from "./service.js";

export function analyticsRoutes(): Router {
  const router = Router();

  router.use(requireAuth);

  router.get("/kpis", async (_req, res, next) => {
    try {
      const kpis = await getKPIs();
      res.json(kpis);
    } catch (err) {
      next(err);
    }
  });

  router.get("/distributions", async (_req, res, next) => {
    try {
      const distributions = await getDistributions();
      res.json(distributions);
    } catch (err) {
      next(err);
    }
  });

  router.get("/classification-health", async (_req, res, next) => {
    try { res.json(await getClassificationHealth()); } catch (err) { next(err); }
  });

  router.get("/agent-activity", async (_req, res, next) => {
    try { res.json(await getAgentActivity()); } catch (err) { next(err); }
  });

  router.get("/signal-volume", async (_req, res, next) => {
    try { res.json(await getSignalVolume()); } catch (err) { next(err); }
  });

  return router;
}
