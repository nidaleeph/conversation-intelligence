import { Router } from "express";
import { z } from "zod";
import {
  requireAuth,
  requireAdmin,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";
import { createError } from "../../middleware/error.js";
import {
  getWhatsAppStatus,
  logoutWhatsAppClient,
  reconnectWhatsAppClient,
  refreshAllowlistFromDb,
  getActiveAccountId,
  listLiveGroups,
  ensureAccountFromCurrentSession,
} from "./client.js";
import {
  getActiveAccount,
  listAccounts,
  listMonitoredGroups,
  addMonitoredGroup,
  updateMonitoredGroup,
  deleteMonitoredGroup,
} from "./service.js";

const addGroupSchema = z.object({
  groupChatId: z.string().min(1),
  groupName: z.string().min(1),
  enabled: z.boolean().optional(),
});

const updateGroupSchema = z.object({
  enabled: z.boolean().optional(),
  groupName: z.string().min(1).optional(),
});

export function whatsappWebRoutes(): Router {
  const router = Router();

  // --- Status ---------------------------------------------------------------

  router.get("/status", requireAuth, (_req: AuthenticatedRequest, res) => {
    const snapshot = getWhatsAppStatus();
    res.json({
      enabled: snapshot.config.enabled,
      state: snapshot.state,
      hasQr: snapshot.lastQr !== null,
      qr: snapshot.lastQr,
      connectedAt: snapshot.connectedAt,
      disconnectedAt: snapshot.disconnectedAt,
      lastError: snapshot.lastError,
      reconnectAttempts: snapshot.reconnectAttempts,
      uptimeMs: snapshot.uptimeMs,
      heartbeat: {
        lastCheckAt: snapshot.lastHeartbeatAt,
        ok: snapshot.lastHeartbeatOk,
        state: snapshot.lastHeartbeatState,
        intervalMs: snapshot.config.heartbeatIntervalMs,
      },
      stats: {
        received: snapshot.messagesReceived,
        ingested: snapshot.messagesIngested,
        filteredByAllowlist: snapshot.messagesFilteredByAllowlist,
        lastMessageAt: snapshot.lastMessageAt,
      },
      account: snapshot.clientInfo,
      config: {
        sessionPath: snapshot.config.sessionPath,
        allowlist: snapshot.config.allowlist,
        terminalQr: snapshot.config.terminalQr,
      },
    });
  });

  // --- Actions (admin) ------------------------------------------------------

  router.post(
    "/logout",
    requireAuth,
    requireAdmin,
    async (_req: AuthenticatedRequest, res, next) => {
      try {
        logoutWhatsAppClient().catch((err) =>
          console.error("[wwebjs] logout error:", err)
        );
        res.json({ ok: true, action: "logout" });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    "/reconnect",
    requireAuth,
    requireAdmin,
    async (_req: AuthenticatedRequest, res, next) => {
      try {
        reconnectWhatsAppClient().catch((err) =>
          console.error("[wwebjs] reconnect error:", err)
        );
        res.json({ ok: true, action: "reconnect" });
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Accounts -------------------------------------------------------------

  router.get(
    "/accounts",
    requireAuth,
    async (_req: AuthenticatedRequest, res, next) => {
      try {
        const accounts = await listAccounts();
        res.json({ accounts });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    "/accounts/current",
    requireAuth,
    async (_req: AuthenticatedRequest, res, next) => {
      try {
        const account = await getActiveAccount();
        res.json({ account });
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Live groups (from WhatsApp session) ----------------------------------

  router.get(
    "/live-groups",
    requireAuth,
    async (_req: AuthenticatedRequest, res, next) => {
      try {
        const groups = await listLiveGroups();
        res.json({ groups });
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Monitored groups CRUD (per active account) ---------------------------

  router.get(
    "/groups",
    requireAuth,
    async (_req: AuthenticatedRequest, res, next) => {
      try {
        const accountId =
          getActiveAccountId() || (await ensureAccountFromCurrentSession());
        if (!accountId) {
          return res.json({ accountId: null, groups: [] });
        }
        const groups = await listMonitoredGroups(accountId);
        res.json({ accountId, groups });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    "/groups",
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const accountId =
          getActiveAccountId() || (await ensureAccountFromCurrentSession());
        if (!accountId) throw createError(400, "No active WhatsApp account");

        const parsed = addGroupSchema.safeParse(req.body);
        if (!parsed.success) throw createError(400, "Invalid group data");

        const group = await addMonitoredGroup({
          accountId,
          groupChatId: parsed.data.groupChatId,
          groupName: parsed.data.groupName,
          enabled: parsed.data.enabled,
        });

        await refreshAllowlistFromDb();
        res.status(201).json({ group });
      } catch (err) {
        next(err);
      }
    }
  );

  router.patch(
    "/groups/:id",
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = updateGroupSchema.safeParse(req.body);
        if (!parsed.success) throw createError(400, "Invalid update data");

        const group = await updateMonitoredGroup({
          id: req.params.id,
          enabled: parsed.data.enabled,
          groupName: parsed.data.groupName,
        });

        if (!group) throw createError(404, "Group not found");

        await refreshAllowlistFromDb();
        res.json({ group });
      } catch (err) {
        next(err);
      }
    }
  );

  router.delete(
    "/groups/:id",
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const ok = await deleteMonitoredGroup(req.params.id);
        if (!ok) throw createError(404, "Group not found");

        await refreshAllowlistFromDb();
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
