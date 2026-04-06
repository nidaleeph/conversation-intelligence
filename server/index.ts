import { createServer } from "node:http";
import { createApp } from "./app.js";
import { getBoss, stopBoss } from "./db/boss.js";
import pool from "./db/connection.js";

async function startServer() {
  // Verify database connection
  try {
    await pool.query("SELECT 1");
    console.log("PostgreSQL connected");
  } catch (err) {
    console.error("Failed to connect to PostgreSQL:", err);
    process.exit(1);
  }

  // Start pg-boss
  await getBoss();

  // Start classification worker
  const { startClassificationWorker } = await import(
    "./modules/classification/worker.js"
  );
  await startClassificationWorker(await getBoss());

  const { startMatchingWorker } = await import("./modules/matching/worker.js");
  await startMatchingWorker(await getBoss());

  const { startNotificationWorkers } = await import("./modules/notifications/worker.js");
  await startNotificationWorkers(await getBoss());

  // Create Express app
  const app = createApp();
  const server = createServer(app);

  const { setupWebSocket } = await import("./modules/notifications/websocket.js");
  setupWebSocket(server);

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Graceful shutdown
  async function shutdown() {
    console.log("Shutting down...");
    server.close();
    await stopBoss();
    await pool.end();
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
