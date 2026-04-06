import Anthropic from "@anthropic-ai/sdk";
import type { SignalType } from "@shared/types.js";
import type { ExtractedFields } from "./extractor.js";

interface LLMClassification {
  type: SignalType;
  confidence: number;
  actionable: boolean;
  fields: ExtractedFields;
  summary: string;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a real estate message classifier for the North London luxury property market.
You analyze WhatsApp group messages from estate agents and classify them.

Signal types:
- "Buyer Search" — agent has a buyer looking for a property
- "Tenant Search" — agent has a tenant looking for a rental
- "Seller Signal" — someone wants to sell their property
- "Landlord Signal" — someone wants to let their property / looking for a tenant
- "Property for Sale" — a specific property listing for sale
- "Property for Rent" — a specific property listing for rent
- "Service Request" — asking for recommendations (architects, builders, etc.)
- "Service Reply" — responding to a service request
- "Contextual Reply" — reply to a previous message that adds context
- "Social" — greetings, congratulations, birthday wishes
- "Irrelevant" — spam, off-topic, admin messages
- "Market Commentary" — general market observations or news

Respond ONLY with valid JSON. No markdown, no explanation.`;

const USER_PROMPT_TEMPLATE = `Classify this WhatsApp message and extract structured data.

Message: "{rawText}"
Sender: "{senderName}"
Group: "{sourceGroup}"

Respond with JSON:
{
  "type": "one of the signal types",
  "confidence": 0.0 to 1.0,
  "actionable": true or false,
  "location": ["area names"],
  "postcodes": ["NW3", "NW6"],
  "budgetMin": null or number in GBP,
  "budgetMax": null or number in GBP,
  "propertyType": null or "House"/"Flat"/"Mansion" etc,
  "bedrooms": null or number,
  "bathrooms": null or number,
  "sqft": null or number,
  "outsideSpace": null or true/false,
  "parking": null or true/false,
  "condition": null or "Turnkey"/"Needs Work"/"New Build",
  "summary": "one-line summary of the message"
}`;

export async function classifyByLLM(
  rawText: string,
  senderName: string,
  sourceGroup: string
): Promise<LLMClassification | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY not set — skipping LLM classification");
    return null;
  }

  const userPrompt = USER_PROMPT_TEMPLATE
    .replace("{rawText}", rawText.replace(/"/g, '\\"'))
    .replace("{senderName}", senderName)
    .replace("{sourceGroup}", sourceGroup);

  try {
    const response = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);

    return {
      type: parsed.type,
      confidence: parsed.confidence,
      actionable: parsed.actionable ?? false,
      fields: {
        location: parsed.location ?? [],
        postcodes: parsed.postcodes ?? [],
        budgetMin: parsed.budgetMin ?? null,
        budgetMax: parsed.budgetMax ?? null,
        propertyType: parsed.propertyType ?? null,
        bedrooms: parsed.bedrooms ?? null,
        bathrooms: parsed.bathrooms ?? null,
        sqft: parsed.sqft ?? null,
        outsideSpace: parsed.outsideSpace ?? null,
        parking: parsed.parking ?? null,
        condition: parsed.condition ?? null,
      },
      summary: parsed.summary ?? "",
    };
  } catch (err) {
    console.error("LLM classification failed:", err);
    return null;
  }
}
