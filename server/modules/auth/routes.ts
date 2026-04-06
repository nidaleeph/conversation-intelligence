import { Router } from "express";
import { loginSchema, verifyTokenSchema } from "@shared/schemas.js";
import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js";
import { createError } from "../../middleware/error.js";
import {
  createMagicLinkToken,
  verifyMagicLinkToken,
  destroySession,
} from "./service.js";
import { sendMagicLinkEmail } from "./email.js";

export function authRoutes(): Router {
  const router = Router();

  // POST /api/auth/login
  router.post(
    "/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      keyFn: (req) => req.body?.email || req.ip || "unknown",
    }),
    async (req, res, next) => {
      try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
          throw createError(400, "Invalid email address");
        }

        const token = await createMagicLinkToken(parsed.data.email);

        if (token) {
          await sendMagicLinkEmail(parsed.data.email, token);

          import("../audit/service.js").then(({ logAudit }) =>
            logAudit({
              agentId: null,
              action: "login",
              entityType: "auth",
              entityId: null as any,
              metadata: { email: parsed.data.email },
            })
          ).catch(() => {});
        }

        res.json({ message: "If an account exists, a login link has been sent." });
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/auth/verify?token=xxx
  router.get("/verify", async (req, res, next) => {
    try {
      const parsed = verifyTokenSchema.safeParse({ token: req.query.token });
      if (!parsed.success) {
        throw createError(400, "Invalid token");
      }

      const result = await verifyMagicLinkToken(parsed.data.token);
      if (!result) {
        throw createError(401, "Invalid or expired link");
      }

      res.cookie(COOKIE_NAME, result.sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: SESSION_MAX_AGE_MS,
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/logout
  router.post("/logout", requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const sessionId = req.cookies?.[COOKIE_NAME];
      if (sessionId) {
        await destroySession(sessionId);
      }
      res.clearCookie(COOKIE_NAME);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/auth/me
  router.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ agent: req.agent });
  });

  return router;
}
