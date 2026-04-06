import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface AlertEmailData {
  to: string;
  agentName: string;
  alertSummary: string;
  alertPriority: string;
  alertType: string;
}

export async function sendAlertEmail(data: AlertEmailData): Promise<boolean> {
  if (!resend) {
    console.log(`  [email-stub] Alert for ${data.agentName} (${data.to}): ${data.alertSummary}`);
    return true;
  }

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "DDRE War Room <noreply@ddre.com>",
      to: data.to,
      subject: `[${data.alertPriority.toUpperCase()}] ${data.alertType === "match_found" ? "New Match" : "New Alert"} — DDRE War Room`,
      html: `
        <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #1a1e23;">New Alert</h2>
          <div style="background: #f8f9fa; border-left: 4px solid ${
            data.alertPriority === "high" ? "#ef4444" :
            data.alertPriority === "medium" ? "#f59e0b" : "#22c55e"
          }; padding: 16px; border-radius: 4px; margin: 16px 0;">
            <p style="margin: 0; font-weight: 600;">${data.alertSummary}</p>
          </div>
          <a href="${process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000"}/alerts"
             style="display: inline-block; padding: 12px 32px; background: #77d5c0; color: #1a1e23; text-decoration: none; border-radius: 8px; font-weight: 600;">
            View in War Room
          </a>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("Failed to send alert email:", err);
    return false;
  }
}

interface DigestEmailData {
  to: string;
  agentName: string;
  alerts: Array<{ summary: string; priority: string; createdAt: string }>;
}

export async function sendDigestEmail(data: DigestEmailData): Promise<boolean> {
  if (!resend) {
    console.log(`  [email-stub] Daily digest for ${data.agentName}: ${data.alerts.length} alerts`);
    return true;
  }

  const alertRows = data.alerts
    .map((a) =>
      `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;">
        <span style="color: ${a.priority === "high" ? "#ef4444" : a.priority === "medium" ? "#f59e0b" : "#22c55e"}; font-weight: bold; text-transform: uppercase; font-size: 11px;">${a.priority}</span>
      </td><td style="padding: 8px; border-bottom: 1px solid #eee;">${a.summary}</td></tr>`)
    .join("");

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "DDRE War Room <noreply@ddre.com>",
      to: data.to,
      subject: `Daily Digest: ${data.alerts.length} alert(s) — DDRE War Room`,
      html: `
        <div style="font-family: 'DM Sans', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1e23;">Daily Digest</h2>
          <p>Hi ${data.agentName}, here's your summary from the last 24 hours:</p>
          <table style="width: 100%; border-collapse: collapse;">${alertRows}</table>
          <a href="${process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000"}/alerts"
             style="display: inline-block; margin-top: 16px; padding: 12px 32px; background: #77d5c0; color: #1a1e23; text-decoration: none; border-radius: 8px; font-weight: 600;">
            View All Alerts
          </a>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("Failed to send digest email:", err);
    return false;
  }
}
