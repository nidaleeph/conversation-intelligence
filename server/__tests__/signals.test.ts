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
