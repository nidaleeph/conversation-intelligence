import { Router } from "express";
import {
  createAgentSchema,
  updateAgentSchema,
  paginationSchema,
} from "@shared/schemas.js";
import {
  requireAuth,
  requireAdmin,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";
import { createError } from "../../middleware/error.js";
import {
  listAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
} from "./service.js";

export function agentsRoutes(): Router {
  const router = Router();

  router.use(requireAuth);

  // GET /api/agents
  router.get("/", async (req, res, next) => {
    try {
      const pagination = paginationSchema.parse(req.query);
      const result = await listAgents(pagination);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/agents/:id
  router.get("/:id", async (req, res, next) => {
    try {
      const agent = await getAgentById(req.params.id);
      if (!agent) throw createError(404, "Agent not found");
      res.json(agent);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/agents (admin only)
  router.post(
    "/",
    requireAdmin,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = createAgentSchema.safeParse(req.body);
        if (!parsed.success) {
          throw createError(400, "Invalid agent data");
        }
        const agent = await createAgent(parsed.data);

        // Create default notification preferences
        const { query: dbQuery } = await import("../../db/connection.js");
        await dbQuery(
          "INSERT INTO notification_preferences (agent_id) VALUES ($1)",
          [agent.id]
        );

        import("../audit/service.js").then(({ logAudit }) =>
          logAudit({
            agentId: req.agent!.id,
            action: "agent_invited",
            entityType: "agent",
            entityId: agent.id,
            metadata: { name: agent.name, email: agent.email, role: agent.role },
          })
        ).catch(() => {});

        res.status(201).json(agent);
      } catch (err: any) {
        if (err.code === "23505") {
          next(createError(409, "An agent with this email already exists"));
        } else {
          next(err);
        }
      }
    }
  );

  // PATCH /api/agents/:id (admin only)
  router.patch(
    "/:id",
    requireAdmin,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = updateAgentSchema.safeParse(req.body);
        if (!parsed.success) {
          throw createError(400, "Invalid update data");
        }
        const agent = await updateAgent(req.params.id, parsed.data);
        if (!agent) throw createError(404, "Agent not found");

        // If agent was deactivated, kill all their sessions
        if (parsed.data.isActive === false) {
          const { destroyAllAgentSessions } = await import(
            "../auth/service.js"
          );
          await destroyAllAgentSessions(req.params.id);

          import("../audit/service.js").then(({ logAudit }) =>
            logAudit({
              agentId: req.agent!.id,
              action: "agent_deactivated",
              entityType: "agent",
              entityId: req.params.id,
            })
          ).catch(() => {});
        }

        res.json(agent);
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /api/agents/:id (admin only)
  router.delete(
    "/:id",
    requireAdmin,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const deleted = await deleteAgent(req.params.id);
        if (!deleted) throw createError(404, "Agent not found");
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
