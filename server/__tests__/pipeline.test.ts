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
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
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
        location: [], postcodes: [], budgetMin: null, budgetMax: null,
        propertyType: null, bedrooms: null, bathrooms: null, sqft: null,
        outsideSpace: null, parking: null, condition: null,
      },
      summary: "Reply to previous message",
    });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
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
    expect(result!.needsReview).toBe(false);
  });

  it("flags for review when confidence 0.70-0.84", async () => {
    mockLLM.mockResolvedValueOnce({
      type: "Market Commentary",
      confidence: 0.75,
      actionable: false,
      fields: {
        location: [], postcodes: [], budgetMin: null, budgetMax: null,
        propertyType: null, bedrooms: null, bathrooms: null, sqft: null,
        outsideSpace: null, parking: null, condition: null,
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

  it("flags for review when confidence < 0.70", async () => {
    mockLLM.mockResolvedValueOnce({
      type: "Contextual Reply",
      confidence: 0.55,
      actionable: false,
      fields: {
        location: [], postcodes: [], budgetMin: null, budgetMax: null,
        propertyType: null, bedrooms: null, bathrooms: null, sqft: null,
        outsideSpace: null, parking: null, condition: null,
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
