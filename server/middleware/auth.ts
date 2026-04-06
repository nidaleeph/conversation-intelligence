import type { Request, Response, NextFunction } from "express";
import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const.js";
import { query } from "../db/connection.js";

export interface AuthenticatedRequest extends Request {
  agent?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const sessionId = req.cookies?.[COOKIE_NAME];

  if (!sessionId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  query(
    `SELECT s.id, s.agent_id, s.expires_at, a.name, a.email, a.role, a.is_active
     FROM sessions s
     JOIN agents a ON a.id = s.agent_id
     WHERE s.id = $1 AND s.verified = true`,
    [sessionId]
  )
    .then((result) => {
      const session = result.rows[0];
      if (!session) {
        res.status(401).json({ error: "Invalid session" });
        return;
      }

      if (new Date(session.expires_at) < new Date()) {
        res.status(401).json({ error: "Session expired" });
        return;
      }

      if (!session.is_active) {
        res.status(403).json({ error: "Account deactivated" });
        return;
      }

      req.agent = {
        id: session.agent_id,
        name: session.name,
        email: session.email,
        role: session.role,
      };

      // Refresh session expiry on activity (fire-and-forget)
      const newExpiry = new Date(Date.now() + SESSION_MAX_AGE_MS);
      query("UPDATE sessions SET expires_at = $1 WHERE id = $2", [
        newExpiry,
        sessionId,
      ]).catch(() => {});

      next();
    })
    .catch(next);
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (req.agent?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
