import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAgents,
  getAgentById,
  createAgent,
  updateAgent,
} from "../modules/agents/service.js";

vi.mock("../db/connection.js", () => ({
  query: vi.fn(),
}));

import { query } from "../db/connection.js";
const mockQuery = vi.mocked(query);

describe("agents service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listAgents", () => {
    it("returns paginated agents", async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ count: "5" }],
        } as any)
        .mockResolvedValueOnce({
          rows: [
            { id: "a1", name: "Agent 1", email: "a1@test.com", role: "agent", coverage_areas: [], is_active: true, created_at: "2026-01-01", updated_at: "2026-01-01" },
            { id: "a2", name: "Agent 2", email: "a2@test.com", role: "agent", coverage_areas: [], is_active: true, created_at: "2026-01-01", updated_at: "2026-01-01" },
          ],
        } as any);

      const result = await listAgents({ page: 1, limit: 2 });
      expect(result.total).toBe(5);
      expect(result.agents).toHaveLength(2);
      expect(result.agents[0].name).toBe("Agent 1");
    });
  });

  describe("getAgentById", () => {
    it("returns agent when found", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "a1", name: "Agent 1", email: "a1@test.com", role: "agent", coverage_areas: ["Hampstead"], is_active: true, created_at: "2026-01-01", updated_at: "2026-01-01" }],
      } as any);

      const result = await getAgentById("a1");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Agent 1");
    });

    it("returns null when not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await getAgentById("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("createAgent", () => {
    it("creates and returns a new agent", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "new-id",
            name: "New Agent",
            email: "new@test.com",
            role: "agent",
            coverage_areas: ["Hampstead"],
            is_active: true,
            created_at: "2026-04-06T00:00:00Z",
            updated_at: "2026-04-06T00:00:00Z",
          },
        ],
      } as any);

      const result = await createAgent({
        name: "New Agent",
        email: "new@test.com",
        role: "agent",
        coverageAreas: ["Hampstead"],
      });

      expect(result.id).toBe("new-id");
      expect(result.name).toBe("New Agent");
    });
  });

  describe("updateAgent", () => {
    it("updates specified fields only", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "a1",
            name: "Updated",
            email: "a1@test.com",
            role: "agent",
            coverage_areas: ["Highgate"],
            is_active: true,
            created_at: "2026-04-06T00:00:00Z",
            updated_at: "2026-04-06T00:00:00Z",
          },
        ],
      } as any);

      const result = await updateAgent("a1", { name: "Updated" });
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Updated");
    });

    it("returns null when agent not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const result = await updateAgent("nonexistent", { name: "X" });
      expect(result).toBeNull();
    });
  });
});
