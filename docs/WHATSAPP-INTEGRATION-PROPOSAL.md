# WhatsApp Integration — Moving from Baileys to the Business API

**From:** Nidal
**Date:** April 2026

---

## Why Baileys Keeps Breaking

Right now the production server uses Baileys to monitor WhatsApp groups. Baileys is an unofficial library that pretends to be WhatsApp Web — you scan a QR code and it hijacks the WebSocket connection to WhatsApp's servers.

The problem is Meta doesn't want you doing this. They actively detect and kill non-browser connections, so every time WhatsApp pushes an update, there's a good chance the session breaks. On top of that, the session is tied to the phone — if the phone loses signal, restarts, or updates WhatsApp, the connection drops and you might need to re-scan the QR code.

There's also the ban risk. Using Baileys violates Meta's Terms of Service. They can permanently ban the phone number, and for a business that depends on these group conversations, that's not a risk worth taking. And since Baileys is a community project maintained by volunteers, if something breaks on a Friday evening, you're just waiting and hoping someone fixes it over the weekend.

This isn't going to get better. It's a cat-and-mouse game with Meta, and Meta always wins.

---

## The Fix: WhatsApp Business API

Meta has an official API for this. Instead of pretending to be a browser, their Cloud API sends messages to your server via webhooks — standard HTTPS POST requests. No QR codes, no phone dependency, no session management.

The flow looks like this:

```
WhatsApp Groups
      ↓
Meta's Cloud API Servers
      ↓ (HTTPS webhook POST)
Our Server — /api/webhooks/whatsapp
      ↓
Existing Ingestion Pipeline
      ↓ (deduplicate → classify → match → alert)
Agents get notified
```

Here's how it compares:

|                      | Baileys (now)                                   | Business API (proposed)                        |
| -------------------- | ----------------------------------------------- | ---------------------------------------------- |
| **Connection**       | WebSocket pretending to be a browser            | HTTPS webhooks from Meta                       |
| **Auth**             | QR code scan, needs repeating on disconnect     | One-time API key, permanent                    |
| **Session**          | Fragile — depends on phone, network, WA updates | No session to maintain                         |
| **Group access**     | All groups on the linked account                | Only groups where the business number is added |
| **Message delivery** | Best-effort, loses messages on disconnect       | Meta retries delivery if your server is down   |
| **Uptime**           | Drops daily/weekly                              | 99.9%+ SLA                                     |
| **Risk**             | Account ban possible                            | Officially supported by Meta                   |
| **Reconnection**     | Manual QR re-scan                               | Not needed                                     |

---

## What Needs to Happen (Non-Dev)

This is mostly Meta dashboard work that the boss needs to handle since it requires business owner credentials.

**1. Create a Meta Business Account** at business.facebook.com — either create new or use an existing one.

**2. Business Verification** — submit business name, address, and registration docs (Companies House, VAT certificate, etc.) through Meta Business Suite > Settings > Business Verification. Takes 1–5 business days. You need this to use a real phone number (test numbers work without it).

**3. Create a Meta App** at developers.facebook.com — click "Create App", pick "Business" type, add the WhatsApp product. This gives you three things you'll pass to me: a Phone Number ID, a WhatsApp Business Account ID, and a permanent access token.

**4. Get a phone number.** Best option is a cheap virtual number (£5–15/month from Twilio or a UK VoIP provider). Register it in the WhatsApp Business API dashboard. This number becomes the "bot" that sits in the groups. Don't migrate an existing personal number unless you're fine losing it from regular WhatsApp — once migrated, it's API-only.

**5. I'll handle the webhook config** once the above is done — pointing Meta's dashboard at our server endpoint.

**6. Add the business number to groups.** Someone with admin access (or any member) adds the number to each WhatsApp group we want to monitor. One-time setup per group.

---

## What I'd Build

One new endpoint: `/api/webhooks/whatsapp`

It does two things:

**Webhook verification (GET)** — Meta sends a challenge request when you first set up the webhook. The endpoint just echoes back the challenge token. Standard stuff.

**Message reception (POST)** — Meta POSTs message events to this endpoint. It validates the request signature (using the App Secret, so nobody can spoof messages), pulls the message data out of Meta's nested JSON format, converts it to our existing message format, and feeds it into the ingestion pipeline. Has to respond with 200 within 5 seconds or Meta considers it failed.

Meta's payload is deeply nested — here's what it looks like coming in:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "changes": [
        {
          "value": {
            "contacts": [
              {
                "profile": { "name": "Scott Bennett" },
                "wa_id": "447712345678"
              }
            ],
            "messages": [
              {
                "from": "447712345678",
                "id": "wamid.ABC123",
                "timestamp": "1712500000",
                "type": "text",
                "text": {
                  "body": "Looking for a 3-bed detached in Hampstead, budget around £2.5m."
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

I'd flatten that into our format:

```json
{
  "sender": "Scott Bennett",
  "text": "Looking for a 3-bed detached in Hampstead, budget around £2.5m.",
  "group": "DDRE North London Agents",
  "timestamp": "2026-04-07T12:00:00.000Z",
  "externalId": "wamid.ABC123",
  "source": "whatsapp-business-api"
}
```

From there, the existing pipeline handles everything — dedup, classification, matching, alerts. No changes needed downstream.

**Files I'd touch:**

- `server/webhooks/whatsapp.ts` — new file, the webhook endpoint
- `server/routes.ts` — register the GET and POST routes
- `.env` — four new variables (verify token, app secret, phone number ID, access token)
- `shared/schema.ts` — add an optional `source` field to track where messages came from

That's maybe 2–4 hours of actual coding. The Meta setup takes longer than the development.

---

## Costs

Meta charges per "conversation window" — a 24-hour period with a single contact. Multiple messages from the same person in the same day count as one window, so group monitoring is cheaper than it sounds.

**Per-conversation pricing (UK):**

- Service conversations: first 1,000/month free, then ~£0.03 each
- User-initiated: ~£0.04
- Business-initiated: ~£0.07
- Marketing: ~£0.08

**What this actually costs us monthly:**

| Scale  | Groups | Messages/Day | Estimated Monthly Cost |
| ------ | ------ | ------------ | ---------------------- |
| Pilot  | 5      | ~50          | £20–30                 |
| Active | 15     | ~200         | £50–100                |
| Scaled | 30+    | ~500+        | £100–200               |

Add in Claude Haiku for classification (£20–70/month depending on volume) and a virtual phone number (£10/month), and the total is somewhere between £50–180/month at normal usage. Compared to the cost of agents manually monitoring groups and missing leads, that's nothing.

---

## The Trade-offs

Worth being honest about what we'd lose:

- **Automatic access to all groups** — with Baileys, the linked account sees every group it's in. With the Business API, someone has to manually add the business number to each group. It's a one-time thing per group, but it's a step.
- **Invisibility** — Baileys is invisible. The Business API number shows up as a group member. People can see it's there.
- **Free** — Baileys costs nothing (if you don't count the downtime and missed leads).

What we'd gain:

- No more daily disconnections or QR re-scans
- Messages don't get lost during downtime — Meta retries delivery for up to 7 days
- No risk of the phone number getting banned
- No maintenance — Baileys breaks with every WhatsApp update and someone has to fix it. The Business API just works.
- Each message comes with a unique ID from Meta, which makes deduplication cleaner
- Having a business number in the group looks more professional than running a scraper off a personal number

---

## Timeline

**Week 1:**

- creates Meta Business Account and submits verification docs (1–5 day wait)
- Get a virtual phone number
- I build and test the webhook endpoint against Meta's sandbox

**Week 2:**

- Once verification comes through, register the real number
- Point the production webhook at our server
- Add the business number to all target groups
- Monitor for a few days to make sure everything flows through

**Week 3:**

- If everything's stable, strip out Baileys — remove the dependency, the QR auth flow, the session management, all of it

Most of the time is spent waiting on Meta's verification. The actual dev work is a few hours.

---

## What Could Go Wrong

**Business verification gets rejected** — unlikely if the right docs are submitted, and you can resubmit. But it would delay things.

**Group admins don't want to add the business number** — possible, but easy to explain. Framing it as "this is how we make sure we never miss a lead in your group" should work. It's a professional upgrade, not surveillance.

**Meta changes pricing** — the costs are already low enough that even a 2x increase wouldn't matter much. Worth checking the usage dashboard monthly.

**Our webhook goes down** — Meta retries for up to 7 days, so a brief outage wouldn't lose messages. Still worth having server monitoring in place.

---

## Next Steps

1. Boss creates the Meta Business Account and submits verification (needs business owner credentials, I can't do this part)
2. I build the webhook endpoint and test it against Meta's sandbox
3. Once verified, we configure the production webhook and add the number to groups
4. After a stable week, we rip out Baileys

---

## Links

- Meta Business Suite: business.facebook.com
- Meta Developer Portal: developers.facebook.com
- WhatsApp Cloud API Docs: developers.facebook.com/docs/whatsapp/cloud-api
- Pricing: developers.facebook.com/docs/whatsapp/pricing
- Webhook Setup: developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks
