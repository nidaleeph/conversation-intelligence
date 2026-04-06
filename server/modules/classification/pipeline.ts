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

  const rulesResult = classifyByRules(input.rawText);

  if (rulesResult) {
    method = "rules";
    type = rulesResult.type;
    confidence = rulesResult.confidence;
    actionable = rulesResult.actionable;

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
    const llmResult = await classifyByLLM(
      input.rawText,
      input.senderName,
      input.sourceGroup
    );

    if (!llmResult) {
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

  const needsReview = confidence < 0.85;
  const status = "new";

  await query(
    "UPDATE messages SET classified = true WHERE id = $1",
    [input.messageId]
  );

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

  // Fire-and-forget audit log
  import("../audit/service.js").then(({ logAudit }) =>
    logAudit({
      agentId: null,
      action: "signal_classified",
      entityType: "signal",
      entityId: result.rows[0].id,
      metadata: { type, method, confidence },
    })
  ).catch(() => {});

  // Broadcast classification events
  try {
    const { broadcast: wsBroadcast, sendToAgent } = await import(
      "../notifications/websocket.js"
    );
    wsBroadcast({
      type: "livefeed:classified",
      data: {
        messageId: input.messageId,
        signalId: result.rows[0].id,
        type,
        method,
        confidence,
        actionable,
        summary,
      },
    });

    if (actionable && location.length > 0) {
      const agentsResult = await query(
        `SELECT id FROM agents WHERE is_active = true AND coverage_areas && $1`,
        [location]
      );
      for (const agent of agentsResult.rows) {
        sendToAgent(agent.id, {
          type: "signal:new",
          data: { signalId: result.rows[0].id, type, location, summary },
        });
      }
    }
  } catch {}

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
