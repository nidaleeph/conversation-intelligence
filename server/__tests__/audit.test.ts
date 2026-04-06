import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAudit, listAuditLog } from "../modules/audit/service.js";

vi.mock("../db/connection.js", () => ({
  query: vi.fn(),
}));

import { query } from "../db/connection.js";
const mockQuery = vi.mocked(query);

describe("audit service", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("logAudit", () => {
    it("inserts an audit log entry", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "audit-1" }] } as any);
      await logAudit({
        agentId: "agent-1",
        action: "signal_reviewed",
        entityType: "signal",
        entityId: "signal-1",
        metadata: { approved: true },
      });
      expect(mockQuery).toHaveBeenCalledOnce();
      expect(mockQuery.mock.calls[0][0]).toContain("INSERT INTO audit_log");
    });

    it("handles null agentId for system actions", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "audit-2" }] } as any);
      await logAudit({
        agentId: null,
        action: "message_received",
        entityType: "message",
        entityId: "msg-1",
      });
      expect(mockQuery).toHaveBeenCalledOnce();
    });
  });

  describe("listAuditLog", () => {
    it("returns paginated audit entries", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: "25" }] } as any)
        .mockResolvedValueOnce({
          rows: [{
            id: "audit-1", agent_id: "agent-1", action: "signal_reviewed",
            entity_type: "signal", entity_id: "signal-1",
            metadata: { approved: true }, created_at: "2026-04-06T12:00:00Z",
          }],
        } as any);

      const result = await listAuditLog({ page: 1, limit: 20 });
      expect(result.total).toBe(25);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].action).toBe("signal_reviewed");
    });

    it("filters by entity type", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: "5" }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);
      await listAuditLog({ page: 1, limit: 20, entityType: "signal" });
      expect(mockQuery.mock.calls[0][0]).toContain("entity_type = $");
    });
  });
});
