import { PgBoss } from "pg-boss";
import { sendAlertEmail, sendDigestEmail } from "./email-alerts.js";
import { query } from "../../db/connection.js";

export async function startNotificationWorkers(boss: PgBoss) {
  await boss.createQueue("send-email-alert");

  await boss.work("send-email-alert", { localConcurrency: 3 }, async (jobs) => {
    for (const job of jobs) {
      const data = job.data as {
        to: string; agentName: string; alertSummary: string;
        alertPriority: string; alertType: string;
      };
      console.log(`Sending alert email to ${data.to}...`);
      await sendAlertEmail(data);
    }
  });

  await boss.createQueue("send-daily-digest");

  await boss.schedule("send-daily-digest", "0 7 * * *", {}, { tz: "Europe/London" });

  await boss.work("send-daily-digest", { localConcurrency: 1 }, async () => {
    console.log("Running daily digest...");
    const agents = await query(
      `SELECT a.id, a.name, a.email FROM agents a
       JOIN notification_preferences np ON np.agent_id = a.id
       WHERE np.daily_digest = true AND a.is_active = true`
    );

    for (const agent of agents.rows) {
      const alerts = await query(
        `SELECT summary, priority, created_at FROM alerts
         WHERE agent_id = $1 AND created_at > now() - interval '24 hours'
         ORDER BY created_at DESC`,
        [agent.id]
      );

      if (alerts.rows.length === 0) continue;

      await sendDigestEmail({
        to: agent.email,
        agentName: agent.name,
        alerts: alerts.rows.map((a: any) => ({
          summary: a.summary, priority: a.priority, createdAt: a.created_at,
        })),
      });
    }
    console.log(`Daily digest complete — processed ${agents.rows.length} agent(s)`);
  });

  console.log("Notification workers started (email alerts + daily digest)");
}
