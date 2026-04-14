# whatsapp-web.js Evaluation — Alternative to Meta Cloud API

**Prepared by:** Nidal
**Date:** April 2026
**Decision needed:** Whether to pivot from Meta WhatsApp Cloud API to whatsapp-web.js, or run both.

---

## TL;DR

whatsapp-web.js is a **fast, free, unofficial** way to receive WhatsApp group messages into our system. It works by automating a headless browser running WhatsApp Web, linked to a real WhatsApp account.

- **Pros:** Free, works in minutes, handles groups natively, no business verification needed
- **Cons:** Unofficial (violates WhatsApp ToS), the linked number can be banned, requires a server running 24/7 and a phone that stays online

**Recommendation:** Use it for immediate prototype / demo with a **burner SIM** (not the boss's real number). Keep the Meta Cloud API path we already built as the long-term production target.

---

## 1. What It Is

`whatsapp-web.js` is an open-source Node.js library that drives WhatsApp Web through Puppeteer (a headless Chromium browser). Your server runs a hidden browser session logged into WhatsApp, and the library exposes all the events and actions of WhatsApp Web as a clean API.

Key facts from their own documentation:

- **Unofficial** — not affiliated with or endorsed by WhatsApp
- **Open-source**, Node.js, actively maintained
- **Risk disclaimer from maintainers:** "It is not guaranteed you will not be blocked by using this method. WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe."

## 2. How It Works

```
┌──────────────────────────────────┐
│ Phone with WhatsApp (burner SIM) │
│ - Scans QR once                   │
│ - Linked device status            │
│ - Added to monitored groups       │
└──────────────┬───────────────────┘
               │ WhatsApp protocol
               ↓
┌──────────────────────────────────┐
│ Your server                      │
│                                  │
│ ┌────────────────────────────┐  │
│ │ whatsapp-web.js Client     │  │
│ │ ├─ Puppeteer (headless)    │  │
│ │ └─ WhatsApp Web JS         │  │
│ └──────────┬─────────────────┘  │
│            │ "message" event    │
│            ↓                    │
│ ┌────────────────────────────┐  │
│ │ ingestMessage() (existing) │  │
│ └──────────┬─────────────────┘  │
│            ↓                    │
│    classify → match → alert      │
└──────────────────────────────────┘
```

## 3. Setup Walkthrough

### 3.1 Prerequisites

- **A burner phone number** — a cheap PAYG SIM (£5) or any old number, **not** the boss's personal or the ADVSR.ai business number. If this account gets banned, you lose only the burner.
- **A phone** (or emulator) to install WhatsApp on and scan the initial QR code
- **Node.js server** (we already have this)
- **A small amount of disk space** for the session files (~100 MB)

### 3.2 Installation

```bash
pnpm add whatsapp-web.js qrcode-terminal
```

Note: whatsapp-web.js uses Puppeteer which downloads ~170MB of Chromium on install.

### 3.3 Minimal integration code

```typescript
// server/modules/whatsapp-web/client.ts
import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { ingestMessage } from "../ingestion/service.js";

export function startWhatsAppClient() {
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: "./whatsapp-session", // session files persisted here
    }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox"],
    },
  });

  client.on("qr", (qr) => {
    console.log("Scan this QR code with the burner phone WhatsApp:");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("WhatsApp client ready — monitoring groups");
  });

  client.on("message", async (msg) => {
    const chat = await msg.getChat();
    if (!chat.isGroup) return; // only monitor group messages

    await ingestMessage({
      sourceGroup: chat.name,
      senderName: msg._data.notifyName || "Unknown",
      senderPhone: msg.from,
      rawText: msg.body,
      platform: "whatsapp-web",
    });
  });

  client.on("disconnected", (reason) => {
    console.log("WhatsApp disconnected:", reason);
    // reconnection strategy — see section 5
  });

  client.initialize();
  return client;
}
```

Wire it up in `server/index.ts`:

```typescript
import { startWhatsAppClient } from "./modules/whatsapp-web/client.js";
startWhatsAppClient();
```

### 3.4 First-run experience

1. Start the server (`pnpm dev`)
2. Terminal prints a QR code
3. On burner phone: open WhatsApp > Settings > Linked Devices > Link a Device > scan QR
4. Server prints "WhatsApp client ready"
5. Session is now saved to `./whatsapp-session/`
6. Subsequent server restarts reconnect automatically — no QR needed

### 3.5 Adding the number to groups

Whoever holds the burner phone (or its linked WhatsApp) adds the number to each DDRE group like any other member. From the group's perspective, it's just another person in the group. From our server's perspective, every message in that group now flows into `ingestMessage()`.

## 4. Feature Comparison With Meta Cloud API

| Capability | Meta Cloud API | whatsapp-web.js |
|---|---|---|
| Official / sanctioned | Yes (violates nothing) | **No — violates WhatsApp ToS** |
| Setup time | Hours-to-days (business verification, number registration, webhook setup) | **~15 minutes** |
| Cost | Meta usage charges + ~£5-10/mo for phone number | **Free** (pay only for the burner SIM once) |
| Business verification required | Yes | **No** |
| Monitor group messages | Difficult — business number must be added, uses up capacity | **Easy — works like a normal WhatsApp user** |
| Receive from unlimited groups | Limited | **Unlimited** (as long as phone can be added) |
| Attachments (images, PDFs, voice notes) | Yes, with some effort | **Yes, natively** |
| Reliability (SLA) | Meta-grade, enterprise | **Depends on Puppeteer + WhatsApp Web not breaking** |
| Ban risk | None (when used within policy) | **Moderate — random enforcement, especially for spam patterns** |
| Server must run 24/7 | Webhook is stateless, can scale | **Yes — session is stateful** |
| Works if phone is offline | Yes | **No — phone must be online at least every 14 days** |
| Suitable for production | Yes | **Prototype / demo only** |

## 5. Reconnection & Session Management

### 5.1 Session persistence

`LocalAuth` stores the authenticated session in `./whatsapp-session/` on disk. Files include cookies and local storage from the Chromium session. This is what lets you skip the QR after the first scan.

**Do not commit this folder to git** — it's equivalent to a login credential. Add to `.gitignore`.

### 5.2 Normal reconnection (server restart)

```
Server starts → LocalAuth loads session from disk → Puppeteer launches →
WhatsApp Web reconnects → "ready" event fires → monitoring resumes
```

No user action needed. Takes ~15-30 seconds.

### 5.3 Disconnect scenarios and recovery

| Scenario | Event / Signal | Automatic? | User action |
|---|---|---|---|
| Server process crashes | N/A | No | Restart process (use pm2) |
| Server restart | N/A | Yes | None |
| Temporary network drop | No disconnect event usually | Yes | None |
| WhatsApp Web pushes user out | `disconnected` with reason `NAVIGATION` | Often | Call `client.initialize()` again |
| Burner phone logged out remotely | `disconnected` with reason `LOGOUT` | No | Re-scan QR on burner phone |
| Burner phone offline > 14 days | `disconnected` with reason `UNPAIRED` | No | Re-scan QR on burner phone |
| wwebjs broken by WhatsApp update | `auth_failure` event | No | `pnpm update whatsapp-web.js`, redeploy |
| Puppeteer crashes | Process dies | No | pm2 auto-restart |

### 5.4 Auto-reconnect code

```typescript
client.on("disconnected", async (reason) => {
  console.log("WhatsApp disconnected:", reason);

  if (reason === "LOGOUT" || reason === "UNPAIRED") {
    // Session is dead — need manual QR re-scan
    // Send admin alert (email, Slack, etc.)
    await notifyAdmin(`WhatsApp session lost: ${reason}. Scan QR at /admin/whatsapp-qr`);
    return;
  }

  // Otherwise try to reconnect
  console.log("Attempting reconnection in 5s...");
  setTimeout(() => client.initialize(), 5000);
});
```

### 5.5 Admin observability

Expose a status endpoint so admins can check connection health without digging into server logs:

```typescript
app.get("/api/whatsapp/status", requireAdmin, async (req, res) => {
  const state = client.getState ? await client.getState() : "unknown";
  res.json({ connected: state === "CONNECTED", state });
});
```

Show this on the admin dashboard with a red/green indicator.

### 5.6 Re-scanning the QR (when needed)

If `LOGOUT` or `UNPAIRED` happens, an admin needs to scan a new QR on the burner phone. Options:

1. **SSH into the server** and check logs — simplest but only works for sysadmins
2. **Admin UI that displays the QR** — exposes the QR image on a protected admin page. Slightly more engineering work but much better UX.

## 6. Risk Assessment

### 6.1 Ban risk in practice

Reports from the community suggest:

- **Receiving-only / monitoring** use cases rarely trigger bans
- **High-volume sending** (marketing, mass messaging) triggers bans fast
- **Joining many groups in rapid succession** can trigger bans
- **Behavioral flags** (non-human patterns) are the main trigger

**Our use case is receive-only monitoring.** We don't send messages from the burner, we don't join groups automatically. This puts us in the lower-risk tier — but not zero-risk.

### 6.2 Mitigations

| Risk | Mitigation |
|---|---|
| Burner gets banned | Use a dedicated burner SIM, never the boss's real number. Losing the burner is just £5. |
| wwebjs breaks on WhatsApp update | Monitor the library's GitHub issues, update promptly |
| Server goes down, messages lost | Use pm2 for auto-restart, alert on long downtimes |
| Session expires (14-day rule) | Keep burner phone charged and online |
| Compliance / legal concern | It's unofficial, so don't market this to external agencies. Fine for internal tool. |

### 6.3 What happens if we're banned

- The **burner number only** is banned from WhatsApp — not the server, not the company, not other accounts
- Buy a new SIM, scan a new QR, re-add to groups — roughly a half-day of work
- Historical messages already ingested remain in our database

### 6.4 What this does NOT risk

- Does not jeopardize the ADVSR.ai business WhatsApp number (managed by Zoho)
- Does not require changing how the existing Meta API webhook works
- Does not touch the boss's personal WhatsApp

## 7. Integration With Our Existing System

### 7.1 What changes

- One new module: `server/modules/whatsapp-web/client.ts` (~60 lines)
- New dependency: `whatsapp-web.js` + `qrcode-terminal`
- `.gitignore` addition: `whatsapp-session/`
- One new env var: `WHATSAPP_WEB_ENABLED=true` (to toggle on/off)

### 7.2 What stays the same

- All existing Meta Cloud API webhook code (unchanged, still works)
- Ingestion pipeline (unchanged — same `ingestMessage()` call)
- Classification, matching, alerts, Live Feed UI — all unchanged
- We can run **both** in parallel — messages from Meta webhook and messages from wwebjs both feed the same database

### 7.3 Platform tagging

We tag messages with `platform: "whatsapp-web"` so we can always trace the origin. The existing Meta webhook uses `"whatsapp-business-api"`. This lets us filter, debug, and migrate between them without data mixing.

## 8. Is This Possible? Concrete Answers

**Q: Can we monitor multiple WhatsApp groups in real-time?**
Yes. Every message in every group the burner is part of fires the `message` event immediately.

**Q: Can we get sender name, phone, group name, message text?**
Yes. All exposed on the `message` and `chat` objects.

**Q: Can we stay connected 24/7?**
Yes, as long as the burner phone is online (at least every 14 days) and the server process doesn't crash permanently. pm2 handles crashes.

**Q: Can we reconnect automatically after a restart?**
Yes. LocalAuth persists the session. No QR re-scan needed unless the session is forcibly expired.

**Q: Can we send messages from our app back to the group?**
Yes — but we should NOT do this. Sending is what triggers bans. Use it as receive-only.

**Q: Can we see messages sent before we joined the group?**
No. Only messages received after the burner joined. Same behavior as any human joining a group late.

**Q: Can we see edits, reactions, replies, deleted messages?**
Yes. There are dedicated events (`message_edit`, `message_reaction`, etc.).

**Q: What if the burner is added to a group with 1,000+ members?**
Works fine. The message volume is handled by Puppeteer, and our existing ingestion pipeline + job queue scales fine.

**Q: What about media (images, voice notes, documents)?**
Supported. `msg.downloadMedia()` returns the file. We can save to disk / cloud storage and tie it to the message record. (Not needed for MVP — we're classifying text only.)

## 9. Decision Framework

### Go with whatsapp-web.js (as the primary path) if:
- Boss wants to see group-monitoring working **this week**
- Budget for Meta / virtual numbers is not available
- Internal tool only (not sold to other agencies)
- Willing to accept occasional reconnection maintenance

### Go with Meta Cloud API (keep what we built) if:
- This is going to market or be sold to other agencies
- Compliance and ToS-cleanliness matter (legal, brand risk)
- Boss is willing to handle business verification + buy a number
- Long-term stability is more important than speed

### Run both (hybrid) if:
- You want immediate prototype wins + long-term production
- Happy to write the small module (~1 hour) to add wwebjs
- Want to compare real group data from both paths

## 10. Recommended Next Step

1. Boss decides: **burner SIM for wwebjs OR business number for Meta**
2. If wwebjs: I spec it out in detail, write an implementation plan, build in an afternoon
3. If Meta: boss gets a new phone number, I wire it up — probably 1-2 hours once the number is ready
4. If both: wwebjs now for the demo, Meta in parallel for production readiness

Either way, the ingestion pipeline, classification, matching, alerts, and dashboards — all of that is already built and waiting.

---

## Appendix: Cost & Time Comparison

| Path | Upfront | Monthly | Ban risk | Time to live |
|---|---|---|---|---|
| Meta Cloud API + Twilio number | Business verification (days) | ~£5-10 | Zero | 1-2 days |
| Meta Cloud API + physical SIM | Buy SIM (£5) | £0 | Zero | 2-4 hours |
| **whatsapp-web.js + burner SIM** | **Buy SIM (£5)** | **£0** | **Low-moderate** | **1 hour** |
| whatsapp-web.js + existing spare phone | £0 | £0 | Low-moderate | 30 minutes |
