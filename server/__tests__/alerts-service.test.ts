import { describe, it, expect, vi, beforeEach } from "vitest";
import { listAlerts, markAlertRead, getUnreadCount } from "../modules/alerts/service.js";

vi.mock("../db/connection.js", () => ({
  query: vi.fn(),
}));

import { query } from "../db/connection.js";
const mockQuery = vi.mocked(query);

describe("alerts service", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("listAlerts", () => {
    it("returns paginated alerts for agent", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: "5" }] } as any)
        .mockResolvedValueOnce({
          rows: [{
            id: "alert-1", agent_id: "agent-1", signal_id: "sig-1",
            match_id: "match-1", type: "match_found", priority: "high",
            summary: "Match found", read: false, read_at: null,
            delivered_via: ["in_app"], created_at: "2026-04-06", updated_at: "2026-04-06",
          }],
        } as any);

      const result = await listAlerts("agent-1", { page: 1, limit: 20 });
      expect(result.total).toBe(5);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe("match_found");
    });
  });

  describe("getUnreadCount", () => {
    it("returns unread count for agent", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: "3" }] } as any);
      const count = await getUnreadCount("agent-1");
      expect(count).toBe(3);
    });
  });

  describe("markAlertRead", () => {
    it("marks alert as read", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: "alert-1", agent_id: "agent-1", signal_id: "sig-1",
          match_id: null, type: "match_found", priority: "high",
          summary: "Match", read: true, read_at: "2026-04-06T12:00:00Z",
          delivered_via: ["in_app"], created_at: "2026-04-06", updated_at: "2026-04-06",
        }],
      } as any);

      const result = await markAlertRead("alert-1", "agent-1");
      expect(result).not.toBeNull();
      expect(result!.read).toBe(true);
    });
  });
});
