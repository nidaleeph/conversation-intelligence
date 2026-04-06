import { describe, it, expect, vi, beforeEach } from "vitest";
import { findAndStoreMatches } from "../modules/matching/service.js";

vi.mock("../db/connection.js", () => ({
  query: vi.fn(),
}));

import { query } from "../db/connection.js";
const mockQuery = vi.mocked(query);

describe("findAndStoreMatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds matching listings for a buyer search", async () => {
    // Get the new signal
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "buyer-1", type: "Buyer Search", location: ["Hampstead"],
        budget_min: null, budget_max: 3000000, bedrooms: 3,
        property_type: "House", created_at: new Date().toISOString(), message_id: "msg-1",
      }],
    } as any);
    // Find opposite signals
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "listing-1", type: "Property for Sale", location: ["Hampstead"],
        budget_min: null, budget_max: 2800000, bedrooms: 3,
        property_type: "House", created_at: new Date().toISOString(), message_id: "msg-2",
      }],
    } as any);
    // Check existing match
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    // Insert match
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "match-1" }] } as any);
    // Get demand sender name
    mockQuery.mockResolvedValueOnce({ rows: [{ sender_name: "Scott Bennett" }] } as any);
    // Get supply sender name
    mockQuery.mockResolvedValueOnce({ rows: [{ sender_name: "Jonathan Singer" }] } as any);
    // Find agents with overlapping coverage
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "agent-1", name: "Agent One" }] } as any);
    // Insert alert
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "alert-1" }] } as any);

    const result = await findAndStoreMatches("buyer-1");
    expect(result.matchesFound).toBeGreaterThanOrEqual(1);
  });

  it("skips non-matchable signal types", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "social-1", type: "Social", location: [],
        budget_min: null, budget_max: null, bedrooms: null,
        property_type: null, created_at: new Date().toISOString(), message_id: "msg-3",
      }],
    } as any);

    const result = await findAndStoreMatches("social-1");
    expect(result.matchesFound).toBe(0);
  });

  it("skips duplicate matches", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "buyer-2", type: "Buyer Search", location: ["Hampstead"],
        budget_min: null, budget_max: 3000000, bedrooms: 3,
        property_type: "House", created_at: new Date().toISOString(), message_id: "msg-4",
      }],
    } as any);
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: "listing-2", type: "Property for Sale", location: ["Hampstead"],
        budget_min: null, budget_max: 2800000, bedrooms: 3,
        property_type: "House", created_at: new Date().toISOString(), message_id: "msg-5",
      }],
    } as any);
    // Match already exists
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "existing-match" }] } as any);

    const result = await findAndStoreMatches("buyer-2");
    expect(result.matchesFound).toBe(0);
  });
});
