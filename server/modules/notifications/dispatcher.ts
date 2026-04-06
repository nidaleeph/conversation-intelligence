import { query } from "../../db/connection.js";
import { getBoss } from "../../db/boss.js";

interface DispatchInput {
  alertId: string;
  agentId: string;
  summary: string;
  priority: string;
  alertType: string;
}

export async function dispatchNotifications(input: DispatchInput) {
  const prefsResult = await query(
    `SELECT np.*, a.email, a.name
     FROM notification_preferences np
     JOIN agents a ON a.id = np.agent_id
     WHERE np.agent_id = $1`,
    [input.agentId]
  );

  const prefs = prefsResult.rows[0];
  if (!prefs) return;

  const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const alertPriority = priorityOrder[input.priority] || 1;
  const minPriority = priorityOrder[prefs.min_priority] || 1;

  if (alertPriority < minPriority) return;

  const boss = await getBoss();
  const deliveredVia: string[] = ["in_app"];

  if (prefs.email && !prefs.daily_digest) {
    await boss.send("send-email-alert", {
      to: prefs.email,
      agentName: prefs.name,
      alertSummary: input.summary,
      alertPriority: input.priority,
      alertType: input.alertType,
    });
    deliveredVia.push("email");
  }

  await query("UPDATE alerts SET delivered_via = $1 WHERE id = $2", [deliveredVia, input.alertId]);
}
