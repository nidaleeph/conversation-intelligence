import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendMagicLinkEmail(
  email: string,
  token: string
): Promise<void> {
  const baseUrl =
    process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000";
  const link = `${baseUrl}/verify-login?token=${token}`;

  if (!resend) {
    console.log(`\n  Magic link for ${email}:\n  ${link}\n`);
    return;
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "DDRE War Room <noreply@ddre.com>",
    to: email,
    subject: "Your DDRE War Room Login Link",
    html: `
      <div style="font-family: 'DM Sans', sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a1e23;">Sign in to DDRE War Room</h2>
        <p>Click the button below to sign in. This link expires in 15 minutes.</p>
        <a href="${link}" style="display: inline-block; padding: 12px 32px; background: #77d5c0; color: #1a1e23; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Sign In
        </a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
