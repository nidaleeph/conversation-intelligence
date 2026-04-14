import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { errorHandler } from "./middleware/error.js";
import { authRoutes } from "./modules/auth/routes.js";
import { agentsRoutes } from "./modules/agents/routes.js";
import { ingestionRoutes } from "./modules/ingestion/routes.js";
import { signalsRoutes } from "./modules/signals/routes.js";
import { analyticsRoutes } from "./modules/analytics/routes.js";
import { alertsRoutes } from "./modules/alerts/routes.js";
import { auditRoutes } from "./modules/audit/routes.js";
import { webhookRoutes } from "./modules/webhook/routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // Body parsing — capture raw body on webhook routes for signature validation
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        if (req.originalUrl?.startsWith("/api/webhooks/")) {
          req.rawBody = buf;
        }
      },
    })
  );
  app.use(cookieParser());

  // CORS — restrict to app domain in production
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      credentials: true,
    })
  );

  // Webhook routes (no auth — Meta validates via signature)
  app.use("/api/webhooks", webhookRoutes());

  // API routes
  app.use("/api/auth", authRoutes());
  app.use("/api/agents", agentsRoutes());
  app.use("/api/messages", ingestionRoutes());
  app.use("/api/signals", signalsRoutes());
  app.use("/api/analytics", analyticsRoutes());
  app.use("/api/alerts", alertsRoutes());
  app.use("/api/audit", auditRoutes());

  // Static files (frontend)
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // SPA fallback — serve index.html for non-API routes
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(staticPath, "index.html"));
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
