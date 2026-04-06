# Phase 2: Ingestion & Classification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the message ingestion pipeline with deduplication, a hybrid classification engine (rules + Claude Haiku), signals CRUD, and a human review queue — so messages flow in, get classified, and produce queryable signals.

**Architecture:** Messages arrive via POST endpoint → dedup by fingerprint → pg-boss queues a classification job → worker picks it up → rules engine tries first, Claude Haiku handles the rest → signal stored in DB. Low-confidence signals are flagged for human review.

**Tech Stack:** Express, PostgreSQL, pg-boss, Anthropic SDK (Claude Haiku), vitest, Zod

**Note:** Do NOT auto-commit. The user reviews and pushes all changes manually.

**Spec reference:** `docs/superpowers/specs/2026-04-06-ddre-war-room-production-design.md` (sections 7, 12)

**Depends on:** Phase 1 (foundation, auth, agents) — complete and running.

---

## File Map

### New files — Server
- `server/modules/ingestion/routes.ts` — POST /api/messages/ingest (accepts raw messages)
- `server/modules/ingestion/service.ts` — fingerprint generation, dedup check, pg-boss job dispatch
- `server/modules/ingestion/fingerprint.ts` — hash function for message deduplication
- `server/modules/classification/worker.ts` — pg-boss worker that processes classify-message jobs
- `server/modules/classification/rules.ts` — pattern-based rules engine (RegExp matching)
- `server/modules/classification/extractor.ts` — regex extractors for location, budget, bedrooms, etc.
- `server/modules/classification/llm.ts` — Claude Haiku API integration for ambiguous messages
- `server/modules/classification/pipeline.ts` — orchestrates rules → LLM → store signal flow
- `server/modules/signals/routes.ts` — signals CRUD API + review endpoints
- `server/modules/signals/service.ts` — signals business logic (create, list, update status, review)

### Modified files
- `server/app.ts` — register ingestion and signals routes
- `server/index.ts` — start classification worker after pg-boss
- `shared/schemas.ts` — add ingestMessageSchema, signalFilterSchema, reviewSignalSchema

### New test files
- `server/__tests__/fingerprint.test.ts` — fingerprint hashing tests
- `server/__tests__/rules.test.ts` — rules engine classification tests
- `server/__tests__/extractor.test.ts` — field extraction tests
- `server/__tests__/pipeline.test.ts` — classification pipeline orchestration tests
- `server/__tests__/signals.test.ts` — signals service tests

---

## Task 1: Fingerprint & Deduplication

**Files:**
- Create: `server/modules/ingestion/fingerprint.ts`
- Create: `server/__tests__/fingerprint.test.ts`

- [ ] **Step 1: Write failing tests for fingerprint**

Create `server/__tests__/fingerprint.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateFingerprint } from "../modules/ingestion/fingerprint.js";

describe("generateFingerprint", () => {
  it("produces consistent hash for same input", () => {
    const a = generateFingerprint("Hello world", "Scott Bennett", "Group A");
    const b = generateFingerprint("Hello world", "Scott Bennett", "Group A");
    expect(a).toBe(b);
  });

  it("produces different hashes for different text", () => {
    const a = generateFingerprint("Looking to buy", "Scott", "Group A");
    const b = generateFingerprint("Looking to rent", "Scott", "Group A");
    expect(a).not.toBe(b);
  });

  it("normalizes whitespace before hashing", () => {
    const a = generateFingerprint("hello  world\n\nfoo", "Scott", "G");
    const b = generateFingerprint("hello world\nfoo", "Scott", "G");
    expect(a).toBe(b);
  });

  it("is case-insensitive", () => {
    const a = generateFingerprint("Hello World", "Scott", "G");
    const b = generateFingerprint("hello world", "Scott", "G");
    expect(a).toBe(b);
  });

  it("same message from same sender in different groups produces different fingerprints", () => {
    const a = generateFingerprint("test", "Scott", "Group A");
    const b = generateFingerprint("test", "Scott", "Group B");
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test
```

- [ ] **Step 3: Implement fingerprint**

Create `server/modules/ingestion/fingerprint.ts`:

```typescript
import crypto from "node:crypto";

export function generateFingerprint(
  rawText: string,
  senderName: string,
  sourceGroup: string
): string {
  const normalized = rawText
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const input = `${normalized}|${senderName.toLowerCase()}|${sourceGroup.toLowerCase()}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test
```

Expected: All fingerprint tests PASS.

---

## Task 2: Rules Engine

**Files:**
- Create: `server/modules/classification/rules.ts`
- Create: `server/__tests__/rules.test.ts`

- [ ] **Step 1: Write failing tests for rules engine**

Create `server/__tests__/rules.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { classifyByRules } from "../modules/classification/rules.js";

describe("classifyByRules", () => {
  it("classifies 'looking to buy' as Buyer Search", () => {
    const result = classifyByRules("I have a buyer looking to buy a 3 bed in Hampstead");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Buyer Search");
    expect(result!.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("classifies 'new buyer' as Buyer Search", () => {
    const result = classifyByRules("I have a new buyer looking for a house in NW3");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Buyer Search");
  });

  it("classifies rental search as Tenant Search", () => {
    const result = classifyByRules("Does anyone have a rental in Marylebone 2 bed 2 bath £9k a month");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Tenant Search");
  });

  it("classifies 'just listed' as Property for Sale", () => {
    const result = classifyByRules("Just listed: Redington Road, NW3, £1,550,000, 3 Bed");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Property for Sale");
  });

  it("classifies property with price and beds as Property for Sale", () => {
    const result = classifyByRules("Redington Road, NW3, £1,550,000, 3 Bed, 2 Bath, 1,375 SQFT, Share of Freehold. Fees Available.");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Property for Sale");
  });

  it("classifies 'available to rent' as Property for Rent", () => {
    const result = classifyByRules("Beautiful 2 bed flat available to rent in Belsize Park, £3,500 pcm");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Property for Rent");
  });

  it("classifies 'does anyone know' as Service Request", () => {
    const result = classifyByRules("Does anyone know a good architect in the area?");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Service Request");
  });

  it("classifies 'happy birthday' as Social", () => {
    const result = classifyByRules("Happy birthday John! Hope you have a great day!");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Social");
  });

  it("classifies 'happy new year' as Social", () => {
    const result = classifyByRules("Happy new year everyone!");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Social");
  });

  it("classifies 'looking for a tenant' as Landlord Signal", () => {
    const result = classifyByRules("I'm looking for a tenant for my 3 bed in Highgate");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Landlord Signal");
  });

  it("returns null for ambiguous messages", () => {
    const result = classifyByRules("Thanks for the info, will follow up tomorrow");
    expect(result).toBeNull();
  });

  it("returns actionable=false for Social", () => {
    const result = classifyByRules("Happy birthday!");
    expect(result).not.toBeNull();
    expect(result!.actionable).toBe(false);
  });

  it("returns actionable=true for Buyer Search", () => {
    const result = classifyByRules("New buyer looking for 3 bed house in Hampstead, budget £3m");
    expect(result).not.toBeNull();
    expect(result!.actionable).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test
```

- [ ] **Step 3: Implement rules engine**

Create `server/modules/classification/rules.ts`:

```typescript
import type { SignalType } from "@shared/types.js";

interface RuleMatch {
  type: SignalType;
  confidence: number;
  actionable: boolean;
}

interface Rule {
  patterns: RegExp[];
  type: SignalType;
  confidence: number;
  actionable: boolean;
}

const RULES: Rule[] = [
  // Buyer Search — highest priority for estate agent groups
  {
    patterns: [
      /\b(buyer|looking to buy|want(?:s)? to (?:buy|purchase)|new buyer|hot buyer)\b/i,
      /\b(buyer (?:looking|searching|seeking))\b/i,
    ],
    type: "Buyer Search",
    confidence: 0.92,
    actionable: true,
  },
  // Tenant Search
  {
    patterns: [
      /\b(looking for a rental|looking to rent|tenant (?:looking|searching)|need(?:s)? a rental)\b/i,
      /\bhave a (?:rental|tenant)\b.*\b(?:search|looking)\b/i,
      /\b(?:rental|rent)\b.*\b(?:bed|bath|pcm|per month|a month)\b/i,
    ],
    type: "Tenant Search",
    confidence: 0.90,
    actionable: true,
  },
  // Landlord Signal
  {
    patterns: [
      /\b(looking for a tenant|need(?:s)? a tenant|landlord looking|seeking (?:a )?tenant)\b/i,
    ],
    type: "Landlord Signal",
    confidence: 0.90,
    actionable: true,
  },
  // Property for Sale — listing-style messages with price + beds
  {
    patterns: [
      /\b(just listed|new listing|new instruction|just instructed|price reduction)\b/i,
      /£[\d,.]+(?:m|k)?\s*,?\s*\d+\s*bed/i,
      /\d+\s*bed.*£[\d,.]+(?:m|k)?/i,
    ],
    type: "Property for Sale",
    confidence: 0.93,
    actionable: true,
  },
  // Property for Rent
  {
    patterns: [
      /\b(available to (?:rent|let)|to let|for rent|available (?:for )?(?:rent|letting))\b/i,
      /\b(?:pcm|per calendar month|per month|pw|per week)\b.*(?:bed|flat|house|apartment)/i,
    ],
    type: "Property for Rent",
    confidence: 0.91,
    actionable: true,
  },
  // Service Request
  {
    patterns: [
      /\b(does anyone know|can anyone recommend|looking for a (?:good )?(?:architect|builder|plumber|lawyer|solicitor|surveyor|decorator|cleaner))\b/i,
      /\b(recommend(?:ation)?s? for|anyone know)\b/i,
    ],
    type: "Service Request",
    confidence: 0.88,
    actionable: true,
  },
  // Social — greetings, congratulations, etc.
  {
    patterns: [
      /\b(happy (?:birthday|new year|christmas|easter|holidays|anniversary))\b/i,
      /\b(congratulations|congrats|well done|good luck|thank(?:s| you) (?:all|everyone))\b/i,
      /\b(rip|condolences|thoughts and prayers)\b/i,
    ],
    type: "Social",
    confidence: 0.95,
    actionable: false,
  },
  // Irrelevant
  {
    patterns: [
      /\b(out of office|ooo|on holiday|on vacation)\b/i,
    ],
    type: "Irrelevant",
    confidence: 0.90,
    actionable: false,
  },
];

export function classifyByRules(rawText: string): RuleMatch | null {
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(rawText)) {
        return {
          type: rule.type,
          confidence: rule.confidence,
          actionable: rule.actionable,
        };
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test
```

Expected: All rules tests PASS.

---

## Task 3: Field Extractor

**Files:**
- Create: `server/modules/classification/extractor.ts`
- Create: `server/__tests__/extractor.test.ts`

- [ ] **Step 1: Write failing tests for extractor**

Create `server/__tests__/extractor.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractFields } from "../modules/classification/extractor.js";

describe("extractFields", () => {
  it("extracts budget in millions (£3.3m)", () => {
    const result = extractFields("Budget up to £3.3m, Hampstead");
    expect(result.budgetMax).toBe(3_300_000);
  });

  it("extracts budget in thousands (£550k)", () => {
    const result = extractFields("Looking for something around £550k");
    expect(result.budgetMax).toBe(550_000);
  });

  it("extracts budget with commas (£1,550,000)", () => {
    const result = extractFields("Redington Road, NW3, £1,550,000, 3 Bed");
    expect(result.budgetMax).toBe(1_550_000);
  });

  it("extracts bedrooms (3 bed)", () => {
    const result = extractFields("Minimum 3 beds, garden, Hampstead");
    expect(result.bedrooms).toBe(3);
  });

  it("extracts bedrooms (4 bedroom)", () => {
    const result = extractFields("4 bedroom house with parking");
    expect(result.bedrooms).toBe(4);
  });

  it("extracts bathrooms (2 bath)", () => {
    const result = extractFields("3 bed 2 bath apartment");
    expect(result.bathrooms).toBe(2);
  });

  it("extracts sqft", () => {
    const result = extractFields("1,375 SQFT, Share of Freehold");
    expect(result.sqft).toBe(1375);
  });

  it("extracts known locations", () => {
    const result = extractFields("Hampstead, Belsize Park, Primrose Hill");
    expect(result.location).toContain("Hampstead");
    expect(result.location).toContain("Belsize Park");
    expect(result.location).toContain("Primrose Hill");
  });

  it("extracts postcodes (NW3)", () => {
    const result = extractFields("Property in NW3, £2m");
    expect(result.postcodes).toContain("NW3");
  });

  it("extracts multiple postcodes", () => {
    const result = extractFields("NW3, NW6, or NW8 area");
    expect(result.postcodes).toContain("NW3");
    expect(result.postcodes).toContain("NW6");
    expect(result.postcodes).toContain("NW8");
  });

  it("extracts property type (house)", () => {
    const result = extractFields("Looking for a house or garden flat");
    expect(result.propertyType).toBe("House");
  });

  it("extracts property type (flat)", () => {
    const result = extractFields("2 bed flat in Hampstead");
    expect(result.propertyType).toBe("Flat");
  });

  it("detects garden/outside space", () => {
    const result = extractFields("Needs a garden or outside space");
    expect(result.outsideSpace).toBe(true);
  });

  it("detects parking", () => {
    const result = extractFields("2 bed with parking, £9k a month");
    expect(result.parking).toBe(true);
  });

  it("returns nulls for missing fields", () => {
    const result = extractFields("Happy new year everyone!");
    expect(result.budgetMin).toBeNull();
    expect(result.budgetMax).toBeNull();
    expect(result.bedrooms).toBeNull();
    expect(result.location).toEqual([]);
    expect(result.postcodes).toEqual([]);
  });

  it("extracts pcm rental budget", () => {
    const result = extractFields("£9k a month, Marylebone");
    expect(result.budgetMax).toBe(9_000);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test
```

- [ ] **Step 3: Implement field extractor**

Create `server/modules/classification/extractor.ts`:

```typescript
export interface ExtractedFields {
  location: string[];
  postcodes: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  outsideSpace: boolean | null;
  parking: boolean | null;
  condition: string | null;
}

const KNOWN_LOCATIONS = [
  "Hampstead",
  "Belsize Park",
  "Primrose Hill",
  "Highgate",
  "St John's Wood",
  "Kenwood",
  "West Hampstead",
  "South Hampstead",
  "Hampstead Garden Suburb",
  "Dartmouth Park",
  "Marylebone",
  "Swiss Cottage",
  "Tufnell Park",
  "Kentish Town",
  "Gospel Oak",
  "Parliament Hill",
  "Maida Vale",
  "Little Venice",
  "Kilburn",
  "Cricklewood",
  "Golders Green",
  "Finchley",
  "Muswell Hill",
  "Crouch End",
  "Archway",
  "Islington",
  "Camden",
  "Regent's Park",
];

const POSTCODE_PATTERN = /\b(NW[0-9]{1,2}|N[0-9]{1,2}|W[0-9]{1,2}|WC[0-9]{1,2}|EC[0-9]{1,2}|SW[0-9]{1,2}|SE[0-9]{1,2}|E[0-9]{1,2})\b/gi;

export function extractFields(rawText: string): ExtractedFields {
  const text = rawText;

  // Budget extraction
  let budgetMin: number | null = null;
  let budgetMax: number | null = null;

  // £3.3m, £2.5m
  const millionMatch = text.match(/£([\d.]+)\s*m\b/i);
  if (millionMatch) {
    budgetMax = Math.round(parseFloat(millionMatch[1]) * 1_000_000);
  }

  // £550k
  const thousandMatch = text.match(/£([\d.]+)\s*k\b/i);
  if (thousandMatch) {
    const val = Math.round(parseFloat(thousandMatch[1]) * 1_000);
    budgetMax = budgetMax ? Math.max(budgetMax, val) : val;
  }

  // £1,550,000
  const fullPriceMatch = text.match(/£([\d,]+)(?!\s*[mk])\b/i);
  if (fullPriceMatch && !millionMatch && !thousandMatch) {
    const val = parseInt(fullPriceMatch[1].replace(/,/g, ""), 10);
    if (val > 1000) {
      budgetMax = val;
    }
  }

  // £9k a month / pcm
  const pcmMatch = text.match(/£([\d.]+)\s*k?\s*(?:a month|per month|pcm|per calendar month|pw|per week)/i);
  if (pcmMatch) {
    let val = parseFloat(pcmMatch[1]);
    if (text.match(/£[\d.]+\s*k\s*(?:a month|per month|pcm)/i)) {
      val *= 1000;
    }
    budgetMax = Math.round(val);
  }

  // Bedrooms
  let bedrooms: number | null = null;
  const bedMatch = text.match(/(\d+)\s*(?:bed(?:room)?s?)\b/i);
  if (bedMatch) {
    bedrooms = parseInt(bedMatch[1], 10);
  }

  // Bathrooms
  let bathrooms: number | null = null;
  const bathMatch = text.match(/(\d+)\s*(?:bath(?:room)?s?)\b/i);
  if (bathMatch) {
    bathrooms = parseInt(bathMatch[1], 10);
  }

  // Square footage
  let sqft: number | null = null;
  const sqftMatch = text.match(/([\d,]+)\s*(?:sq\s*ft|sqft|square feet)/i);
  if (sqftMatch) {
    sqft = parseInt(sqftMatch[1].replace(/,/g, ""), 10);
  }

  // Locations
  const location: string[] = [];
  for (const loc of KNOWN_LOCATIONS) {
    if (text.toLowerCase().includes(loc.toLowerCase())) {
      location.push(loc);
    }
  }

  // Postcodes
  const postcodeMatches = text.match(POSTCODE_PATTERN);
  const postcodes = postcodeMatches
    ? [...new Set(postcodeMatches.map((p) => p.toUpperCase()))]
    : [];

  // Property type
  let propertyType: string | null = null;
  if (/\b(house|townhouse|town house|semi-detached|detached|terraced|freehold)\b/i.test(text)) {
    propertyType = "House";
  } else if (/\b(flat|apartment|maisonette|penthouse|studio)\b/i.test(text)) {
    propertyType = "Flat";
  } else if (/\b(mansion|manor|estate)\b/i.test(text)) {
    propertyType = "Mansion";
  }

  // Outside space
  const outsideSpace = /\b(garden|outside space|terrace|balcony|patio|roof terrace)\b/i.test(text)
    ? true
    : null;

  // Parking
  const parking = /\b(parking|garage|off-street|driveway)\b/i.test(text)
    ? true
    : null;

  // Condition
  let condition: string | null = null;
  if (/\b(turnkey|move[- ]in ready|immaculate)\b/i.test(text)) {
    condition = "Turnkey";
  } else if (/\b(needs work|renovation|refurb|project|doer[- ]upper)\b/i.test(text)) {
    condition = "Needs Work";
  } else if (/\b(new build|newly built)\b/i.test(text)) {
    condition = "New Build";
  }

  return {
    location,
    postcodes,
    budgetMin,
    budgetMax,
    propertyType,
    bedrooms,
    bathrooms,
    sqft,
    outsideSpace,
    parking,
    condition,
  };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test
```

Expected: All extractor tests PASS.

---

## Task 4: Claude Haiku LLM Classifier

**Files:**
- Create: `server/modules/classification/llm.ts`

- [ ] **Step 1: Install Anthropic SDK**

```bash
pnpm add @anthropic-ai/sdk
```

- [ ] **Step 2: Create LLM classifier**

Create `server/modules/classification/llm.ts`:

```typescript
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
```

---

## Task 5: Classification Pipeline

**Files:**
- Create: `server/modules/classification/pipeline.ts`
- Create: `server/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write failing tests for pipeline**

Create `server/__tests__/pipeline.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyMessage } from "../modules/classification/pipeline.js";

vi.mock("../db/connection.js", () => ({
  query: vi.fn(),
}));

vi.mock("../modules/classification/llm.js", () => ({
  classifyByLLM: vi.fn(),
}));

import { query } from "../db/connection.js";
import { classifyByLLM } from "../modules/classification/llm.js";
const mockQuery = vi.mocked(query);
const mockLLM = vi.mocked(classifyByLLM);

describe("classifyMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies via rules and stores signal (no LLM needed)", async () => {
    // Mock: update message as classified
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    // Mock: insert signal
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "signal-1" }],
      rowCount: 1,
    } as any);

    const result = await classifyMessage({
      messageId: "msg-1",
      rawText: "New buyer looking for 3 bed house in Hampstead, budget £3m",
      senderName: "Scott Bennett",
      sourceGroup: "DDRE Agents",
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe("Buyer Search");
    expect(result!.method).toBe("rules");
    expect(mockLLM).not.toHaveBeenCalled();
  });

  it("falls back to LLM when rules return null", async () => {
    mockLLM.mockResolvedValueOnce({
      type: "Contextual Reply",
      confidence: 0.78,
      actionable: false,
      fields: {
        location: [],
        postcodes: [],
        budgetMin: null,
        budgetMax: null,
        propertyType: null,
        bedrooms: null,
        bathrooms: null,
        sqft: null,
        outsideSpace: null,
        parking: null,
        condition: null,
      },
      summary: "Reply to previous message",
    });
    // Mock: update message as classified
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    // Mock: insert signal
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "signal-2" }],
      rowCount: 1,
    } as any);

    const result = await classifyMessage({
      messageId: "msg-2",
      rawText: "Thanks for the info, will follow up tomorrow",
      senderName: "Agent",
      sourceGroup: "DDRE Agents",
    });

    expect(result).not.toBeNull();
    expect(result!.method).toBe("llm");
    expect(mockLLM).toHaveBeenCalledOnce();
  });

  it("sets status to new when confidence >= 0.85", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "signal-3" }],
      rowCount: 1,
    } as any);

    const result = await classifyMessage({
      messageId: "msg-3",
      rawText: "I have a buyer looking to buy in Hampstead £5m",
      senderName: "Agent",
      sourceGroup: "Group",
    });

    expect(result!.status).toBe("new");
  });

  it("sets status to new with review flag when confidence 0.70-0.84", async () => {
    mockLLM.mockResolvedValueOnce({
      type: "Market Commentary",
      confidence: 0.75,
      actionable: false,
      fields: {
        location: [],
        postcodes: [],
        budgetMin: null,
        budgetMax: null,
        propertyType: null,
        bedrooms: null,
        bathrooms: null,
        sqft: null,
        outsideSpace: null,
        parking: null,
        condition: null,
      },
      summary: "Market observation",
    });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "signal-4" }],
      rowCount: 1,
    } as any);

    const result = await classifyMessage({
      messageId: "msg-4",
      rawText: "The market seems to be picking up in this area",
      senderName: "Agent",
      sourceGroup: "Group",
    });

    expect(result!.status).toBe("new");
    expect(result!.needsReview).toBe(true);
  });

  it("queues for review when confidence < 0.70", async () => {
    mockLLM.mockResolvedValueOnce({
      type: "Contextual Reply",
      confidence: 0.55,
      actionable: false,
      fields: {
        location: [],
        postcodes: [],
        budgetMin: null,
        budgetMax: null,
        propertyType: null,
        bedrooms: null,
        bathrooms: null,
        sqft: null,
        outsideSpace: null,
        parking: null,
        condition: null,
      },
      summary: "Unclear message",
    });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "signal-5" }],
      rowCount: 1,
    } as any);

    const result = await classifyMessage({
      messageId: "msg-5",
      rawText: "Sure, let me know",
      senderName: "Agent",
      sourceGroup: "Group",
    });

    expect(result!.status).toBe("new");
    expect(result!.needsReview).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm test
```

- [ ] **Step 3: Implement classification pipeline**

Create `server/modules/classification/pipeline.ts`:

```typescript
import { query } from "../../db/connection.js";
import { classifyByRules } from "./rules.js";
import { extractFields } from "./extractor.js";
import { classifyByLLM } from "./llm.js";
import type { SignalType, ClassificationMethod } from "@shared/types.js";

interface ClassifyInput {
  messageId: string;
  rawText: string;
  senderName: string;
  sourceGroup: string;
}

interface ClassifyResult {
  signalId: string;
  type: SignalType;
  method: ClassificationMethod;
  confidence: number;
  status: string;
  needsReview: boolean;
  actionable: boolean;
}

export async function classifyMessage(
  input: ClassifyInput
): Promise<ClassifyResult | null> {
  let type: SignalType;
  let method: ClassificationMethod;
  let confidence: number;
  let actionable: boolean;
  let summary: string;
  let location: string[];
  let postcodes: string[];
  let budgetMin: number | null;
  let budgetMax: number | null;
  let propertyType: string | null;
  let bedrooms: number | null;
  let bathrooms: number | null;
  let sqft: number | null;
  let outsideSpace: boolean | null;
  let parking: boolean | null;
  let condition: string | null;

  // Try rules engine first
  const rulesResult = classifyByRules(input.rawText);

  if (rulesResult) {
    method = "rules";
    type = rulesResult.type;
    confidence = rulesResult.confidence;
    actionable = rulesResult.actionable;

    // Extract fields from text
    const fields = extractFields(input.rawText);
    location = fields.location;
    postcodes = fields.postcodes;
    budgetMin = fields.budgetMin;
    budgetMax = fields.budgetMax;
    propertyType = fields.propertyType;
    bedrooms = fields.bedrooms;
    bathrooms = fields.bathrooms;
    sqft = fields.sqft;
    outsideSpace = fields.outsideSpace;
    parking = fields.parking;
    condition = fields.condition;
    summary = `${type}: ${input.rawText.slice(0, 80)}${input.rawText.length > 80 ? "..." : ""}`;
  } else {
    // Fall back to LLM
    const llmResult = await classifyByLLM(
      input.rawText,
      input.senderName,
      input.sourceGroup
    );

    if (!llmResult) {
      // LLM unavailable — mark message classified but skip signal
      await query(
        "UPDATE messages SET classified = true WHERE id = $1",
        [input.messageId]
      );
      return null;
    }

    method = "llm";
    type = llmResult.type;
    confidence = llmResult.confidence;
    actionable = llmResult.actionable;
    summary = llmResult.summary;
    location = llmResult.fields.location;
    postcodes = llmResult.fields.postcodes;
    budgetMin = llmResult.fields.budgetMin;
    budgetMax = llmResult.fields.budgetMax;
    propertyType = llmResult.fields.propertyType;
    bedrooms = llmResult.fields.bedrooms;
    bathrooms = llmResult.fields.bathrooms;
    sqft = llmResult.fields.sqft;
    outsideSpace = llmResult.fields.outsideSpace;
    parking = llmResult.fields.parking;
    condition = llmResult.fields.condition;
  }

  // Determine status based on confidence
  const needsReview = confidence < 0.85;
  const status = "new";

  // Mark message as classified
  await query(
    "UPDATE messages SET classified = true WHERE id = $1",
    [input.messageId]
  );

  // Store signal
  const result = await query(
    `INSERT INTO signals (
      message_id, type, classification_method, confidence,
      location, postcodes, budget_min, budget_max,
      property_type, bedrooms, bathrooms, sqft,
      outside_space, parking, condition,
      summary, status, actionable
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, $15,
      $16, $17, $18
    ) RETURNING id`,
    [
      input.messageId, type, method, confidence,
      location, postcodes, budgetMin, budgetMax,
      propertyType, bedrooms, bathrooms, sqft,
      outsideSpace, parking, condition,
      summary, status, actionable,
    ]
  );

  return {
    signalId: result.rows[0].id,
    type,
    method,
    confidence,
    status,
    needsReview,
    actionable,
  };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm test
```

Expected: All pipeline tests PASS.

---

## Task 6: Ingestion Service & Routes

**Files:**
- Create: `server/modules/ingestion/service.ts`
- Create: `server/modules/ingestion/routes.ts`
- Modify: `shared/schemas.ts` — add ingestMessageSchema

- [ ] **Step 1: Add ingest schema to shared/schemas.ts**

Add to the end of `shared/schemas.ts`:

```typescript
// ============================================================
// Ingestion schemas (Phase 2)
// ============================================================

export const ingestMessageSchema = z.object({
  sourceGroup: z.string().min(1),
  senderName: z.string().min(1),
  senderPhone: z.string().optional().default(""),
  rawText: z.string().min(1),
  platform: z.string().optional().default("whatsapp"),
});

export const ingestBatchSchema = z.object({
  messages: z.array(ingestMessageSchema).min(1).max(100),
});
```

- [ ] **Step 2: Create ingestion service**

Create `server/modules/ingestion/service.ts`:

```typescript
import { query } from "../../db/connection.js";
import { getBoss } from "../../db/boss.js";
import { generateFingerprint } from "./fingerprint.js";

interface IngestInput {
  sourceGroup: string;
  senderName: string;
  senderPhone: string;
  rawText: string;
  platform: string;
}

interface IngestResult {
  messageId: string;
  duplicate: boolean;
}

export async function ingestMessage(
  input: IngestInput
): Promise<IngestResult> {
  const fingerprint = generateFingerprint(
    input.rawText,
    input.senderName,
    input.sourceGroup
  );

  // Check for duplicate
  const existing = await query(
    "SELECT id FROM messages WHERE fingerprint = $1",
    [fingerprint]
  );

  if (existing.rows.length > 0) {
    return { messageId: existing.rows[0].id, duplicate: true };
  }

  // Insert message
  const result = await query(
    `INSERT INTO messages (source_group, sender_name, sender_phone, raw_text, platform, fingerprint)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.sourceGroup,
      input.senderName,
      input.senderPhone,
      input.rawText,
      input.platform,
      fingerprint,
    ]
  );

  const messageId = result.rows[0].id;

  // Queue classification job
  const boss = await getBoss();
  await boss.send("classify-message", {
    messageId,
    rawText: input.rawText,
    senderName: input.senderName,
    sourceGroup: input.sourceGroup,
  });

  return { messageId, duplicate: false };
}
```

- [ ] **Step 3: Create ingestion routes**

Create `server/modules/ingestion/routes.ts`:

```typescript
import { Router } from "express";
import {
  ingestMessageSchema,
  ingestBatchSchema,
} from "@shared/schemas.js";
import { requireAuth, type AuthenticatedRequest } from "../../middleware/auth.js";
import { createError } from "../../middleware/error.js";
import { ingestMessage } from "./service.js";

export function ingestionRoutes(): Router {
  const router = Router();

  // POST /api/messages/ingest — single message
  router.post(
    "/ingest",
    requireAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = ingestMessageSchema.safeParse(req.body);
        if (!parsed.success) {
          throw createError(400, "Invalid message data");
        }

        const result = await ingestMessage(parsed.data);
        res.status(result.duplicate ? 200 : 201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/messages/ingest/batch — multiple messages
  router.post(
    "/ingest/batch",
    requireAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = ingestBatchSchema.safeParse(req.body);
        if (!parsed.success) {
          throw createError(400, "Invalid batch data");
        }

        const results = [];
        for (const msg of parsed.data.messages) {
          const result = await ingestMessage(msg);
          results.push(result);
        }

        const newCount = results.filter((r) => !r.duplicate).length;
        const dupCount = results.filter((r) => r.duplicate).length;

        res.status(201).json({
          total: results.length,
          new: newCount,
          duplicates: dupCount,
          results,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
```

---

## Task 7: Signals Service & Routes

**Files:**
- Create: `server/modules/signals/service.ts`
- Create: `server/modules/signals/routes.ts`
- Create: `server/__tests__/signals.test.ts`
- Modify: `shared/schemas.ts` — add signal filter and review schemas

- [ ] **Step 1: Add signal schemas to shared/schemas.ts**

Add to the end of `shared/schemas.ts`:

```typescript
// ============================================================
// Signal filter & review schemas (Phase 2)
// ============================================================

export const signalFilterSchema = z.object({
  type: signalTypeSchema.optional(),
  status: z.enum(["new", "reviewed", "alerted", "matched"]).optional(),
  needsReview: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reviewSignalSchema = z.object({
  approved: z.boolean(),
  reviewedType: signalTypeSchema.optional(),
});
```

- [ ] **Step 2: Write failing tests for signals service**

Create `server/__tests__/signals.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listSignals, getSignalById, reviewSignal } from "../modules/signals/service.js";

vi.mock("../db/connection.js", () => ({
  query: vi.fn(),
}));

import { query } from "../db/connection.js";
const mockQuery = vi.mocked(query);

describe("signals service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listSignals", () => {
    it("returns paginated signals", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: "10" }] } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              id: "s1",
              message_id: "m1",
              type: "Buyer Search",
              classification_method: "rules",
              confidence: 0.92,
              location: ["Hampstead"],
              postcodes: ["NW3"],
              budget_min: null,
              budget_max: 3000000,
              property_type: "House",
              bedrooms: 3,
              bathrooms: null,
              sqft: null,
              outside_space: true,
              parking: null,
              condition: null,
              summary: "Buyer search in Hampstead",
              status: "new",
              reviewed_by: null,
              actionable: true,
              created_at: "2026-04-06",
              updated_at: "2026-04-06",
            },
          ],
        } as any);

      const result = await listSignals({ page: 1, limit: 20 });
      expect(result.total).toBe(10);
      expect(result.signals).toHaveLength(1);
      expect(result.signals[0].type).toBe("Buyer Search");
      expect(result.signals[0].budgetMax).toBe(3000000);
    });
  });

  describe("getSignalById", () => {
    it("returns null when not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);
      const result = await getSignalById("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("reviewSignal", () => {
    it("updates signal status to reviewed", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "s1",
            message_id: "m1",
            type: "Buyer Search",
            classification_method: "rules",
            confidence: 0.92,
            location: ["Hampstead"],
            postcodes: [],
            budget_min: null,
            budget_max: null,
            property_type: null,
            bedrooms: null,
            bathrooms: null,
            sqft: null,
            outside_space: null,
            parking: null,
            condition: null,
            summary: "test",
            status: "reviewed",
            reviewed_by: "agent-1",
            actionable: true,
            created_at: "2026-04-06",
            updated_at: "2026-04-06",
          },
        ],
      } as any);

      const result = await reviewSignal("s1", "agent-1", {
        approved: true,
      });
      expect(result).not.toBeNull();
      expect(result!.status).toBe("reviewed");
    });
  });
});
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
pnpm test
```

- [ ] **Step 4: Implement signals service**

Create `server/modules/signals/service.ts`:

```typescript
import { query } from "../../db/connection.js";
import type { SignalType } from "@shared/types.js";

interface SignalRow {
  id: string;
  message_id: string;
  type: string;
  classification_method: string;
  confidence: number;
  location: string[];
  postcodes: string[];
  budget_min: number | null;
  budget_max: number | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  outside_space: boolean | null;
  parking: boolean | null;
  condition: string | null;
  summary: string;
  status: string;
  reviewed_by: string | null;
  actionable: boolean;
  created_at: string;
  updated_at: string;
}

function toSignal(row: SignalRow) {
  return {
    id: row.id,
    messageId: row.message_id,
    type: row.type as SignalType,
    classificationMethod: row.classification_method,
    confidence: parseFloat(String(row.confidence)),
    location: row.location,
    postcodes: row.postcodes,
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
    propertyType: row.property_type,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    sqft: row.sqft,
    outsideSpace: row.outside_space,
    parking: row.parking,
    condition: row.condition,
    summary: row.summary,
    status: row.status,
    reviewedBy: row.reviewed_by,
    actionable: row.actionable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSignals(opts: {
  page: number;
  limit: number;
  type?: string;
  status?: string;
  needsReview?: boolean;
}) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (opts.type) {
    conditions.push(`type = $${paramIndex++}`);
    values.push(opts.type);
  }
  if (opts.status) {
    conditions.push(`status = $${paramIndex++}`);
    values.push(opts.status);
  }
  if (opts.needsReview) {
    conditions.push(`confidence < 0.85 AND status = 'new'`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query(
    `SELECT count(*) FROM signals ${where}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (opts.page - 1) * opts.limit;
  const result = await query<SignalRow>(
    `SELECT * FROM signals ${where} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, opts.limit, offset]
  );

  return { signals: result.rows.map(toSignal), total };
}

export async function getSignalById(id: string) {
  const result = await query<SignalRow>(
    "SELECT * FROM signals WHERE id = $1",
    [id]
  );
  return result.rows[0] ? toSignal(result.rows[0]) : null;
}

export async function reviewSignal(
  id: string,
  agentId: string,
  data: { approved: boolean; reviewedType?: SignalType }
) {
  const updates: string[] = [
    "status = 'reviewed'",
    `reviewed_by = $1`,
    `updated_at = now()`,
  ];
  const values: unknown[] = [agentId];
  let paramIndex = 2;

  if (data.reviewedType) {
    updates.push(`type = $${paramIndex++}`);
    values.push(data.reviewedType);
  }

  if (!data.approved) {
    updates.push(`actionable = false`);
  }

  values.push(id);

  const result = await query<SignalRow>(
    `UPDATE signals SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result.rows[0] ? toSignal(result.rows[0]) : null;
}
```

- [ ] **Step 5: Create signals routes**

Create `server/modules/signals/routes.ts`:

```typescript
import { Router } from "express";
import {
  signalFilterSchema,
  reviewSignalSchema,
} from "@shared/schemas.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.js";
import { createError } from "../../middleware/error.js";
import { listSignals, getSignalById, reviewSignal } from "./service.js";

export function signalsRoutes(): Router {
  const router = Router();

  router.use(requireAuth);

  // GET /api/signals
  router.get("/", async (req, res, next) => {
    try {
      const filters = signalFilterSchema.parse(req.query);
      const result = await listSignals(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/signals/:id
  router.get("/:id", async (req, res, next) => {
    try {
      const signal = await getSignalById(req.params.id);
      if (!signal) throw createError(404, "Signal not found");
      res.json(signal);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/signals/:id/review
  router.post(
    "/:id/review",
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = reviewSignalSchema.safeParse(req.body);
        if (!parsed.success) {
          throw createError(400, "Invalid review data");
        }

        const signal = await reviewSignal(
          req.params.id,
          req.agent!.id,
          parsed.data
        );
        if (!signal) throw createError(404, "Signal not found");
        res.json(signal);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
pnpm test
```

Expected: All signals tests PASS.

---

## Task 8: Classification Worker & Server Wiring

**Files:**
- Create: `server/modules/classification/worker.ts`
- Modify: `server/app.ts` — register new routes
- Modify: `server/index.ts` — start worker

- [ ] **Step 1: Create pg-boss classification worker**

Create `server/modules/classification/worker.ts`:

```typescript
import type { PgBoss } from "pg-boss";
import { classifyMessage } from "./pipeline.js";

export async function startClassificationWorker(boss: PgBoss) {
  await boss.work(
    "classify-message",
    { teamSize: 5, teamConcurrency: 5 },
    async (job) => {
      const { messageId, rawText, senderName, sourceGroup } = job.data as {
        messageId: string;
        rawText: string;
        senderName: string;
        sourceGroup: string;
      };

      console.log(`Classifying message ${messageId}...`);

      const result = await classifyMessage({
        messageId,
        rawText,
        senderName,
        sourceGroup,
      });

      if (result) {
        console.log(
          `  → ${result.type} (${result.method}, confidence: ${result.confidence}${result.needsReview ? ", needs review" : ""})`
        );
      } else {
        console.log(`  → no signal produced`);
      }
    }
  );

  console.log("Classification worker started (listening for classify-message jobs)");
}
```

- [ ] **Step 2: Register ingestion and signals routes in app.ts**

Add imports and routes in `server/app.ts`:

Add these imports:
```typescript
import { ingestionRoutes } from "./modules/ingestion/routes.js";
import { signalsRoutes } from "./modules/signals/routes.js";
```

Add these routes after the existing `app.use("/api/agents", ...)` line:
```typescript
  app.use("/api/messages", ingestionRoutes());
  app.use("/api/signals", signalsRoutes());
```

- [ ] **Step 3: Start classification worker in server/index.ts**

In `server/index.ts`, after `await getBoss();`, add:

```typescript
  // Start classification worker
  const { startClassificationWorker } = await import(
    "./modules/classification/worker.js"
  );
  const boss = await getBoss();
  await startClassificationWorker(boss);
```

Note: `getBoss()` is called twice but it's a singleton — the second call returns the same instance.

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: All tests pass (existing + new).

- [ ] **Step 5: Type check**

```bash
pnpm check
```

Expected: Clean, no errors.

- [ ] **Step 6: Start dev server and verify**

Restart both terminals:
- Terminal 1: `npm run dev:server`
- Terminal 2: `npm run dev`

Expected in Terminal 1:
```
PostgreSQL connected
pg-boss started
Classification worker started (listening for classify-message jobs)
Server running on http://localhost:3001/
```

- [ ] **Step 7: Test ingestion endpoint**

With the server running, test from a third terminal or browser console:

```bash
curl -X POST http://localhost:3001/api/messages/ingest \
  -H "Content-Type: application/json" \
  -H "Cookie: ddre_session=YOUR_SESSION_ID" \
  -d '{"sourceGroup":"DDRE Agents","senderName":"Scott Bennett","rawText":"I have a new buyer looking for 3 bed house in Hampstead, budget £3m. Need a fee please.","platform":"whatsapp"}'
```

Expected: 201 response with `{ messageId: "...", duplicate: false }`. Backend terminal shows:
```
Classifying message ...
  → Buyer Search (rules, confidence: 0.92)
```

Sending the same message again should return `{ messageId: "...", duplicate: true }` with status 200.

---

## Summary

After Phase 2 completion:
- **POST /api/messages/ingest** — accepts raw WhatsApp messages, deduplicates, queues for classification
- **POST /api/messages/ingest/batch** — accepts up to 100 messages at once
- **GET /api/signals** — list classified signals with filters (type, status, needsReview)
- **GET /api/signals/:id** — get single signal
- **POST /api/signals/:id/review** — human review of low-confidence signals
- **pg-boss worker** processes classify-message jobs automatically
- **Rules engine** catches ~70% of messages instantly (buyer searches, listings, social, etc.)
- **Claude Haiku** handles the ambiguous 30% with structured JSON extraction
- **Deduplication** via SHA-256 fingerprint prevents the same message from being processed twice
