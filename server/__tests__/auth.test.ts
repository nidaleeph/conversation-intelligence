import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMagicLinkToken,
  verifyMagicLinkToken,
} from "../modules/auth/service.js";

// Mock database
vi.mock("../db/connection.js", () => ({
  query: vi.fn(),
  getClient: vi.fn(),
}));

import { query, getClient } from "../db/connection.js";
const mockQuery = vi.mocked(query);
const mockGetClient = vi.mocked(getClient);

describe("auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMagicLinkToken", () => {
    it("returns null if agent not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await createMagicLinkToken("nobody@test.com");
      expect(result).toBeNull();
    });

    it("returns null if agent is inactive", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: "agent-1", is_active: false }],
        rowCount: 1,
      } as any);

      const result = await createMagicLinkToken("inactive@test.com");
      expect(result).toBeNull();
    });

    it("returns a token for active agent", async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: "agent-1", is_active: true }],
          rowCount: 1,
        } as any)
        .mockResolvedValueOnce({
          rows: [{ token: "test-token-123" }],
          rowCount: 1,
        } as any);

      const result = await createMagicLinkToken("agent@test.com");
      expect(result).toBe("test-token-123");
    });
  });

  describe("verifyMagicLinkToken", () => {
    it("returns null for non-existent token", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

      const result = await verifyMagicLinkToken("bad-token");
      expect(result).toBeNull();
    });

    it("returns null for expired token", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "session-1",
            agent_id: "agent-1",
            expires_at: new Date(Date.now() - 1000),
            verified: false,
          },
        ],
        rowCount: 1,
      } as any);

      const result = await verifyMagicLinkToken("expired-token");
      expect(result).toBeNull();
    });

    it("returns session ID for valid token", async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "session-1",
            agent_id: "agent-1",
            expires_at: new Date(Date.now() + 60000),
            verified: false,
          },
        ],
        rowCount: 1,
      } as any);
      mockGetClient.mockResolvedValueOnce(mockClient as any);
      mockClient.query.mockResolvedValueOnce({} as any); // BEGIN
      mockClient.query.mockResolvedValueOnce({} as any); // UPDATE old session
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: "new-session-id", agent_id: "agent-1" }],
        rowCount: 1,
      } as any); // INSERT new session
      mockClient.query.mockResolvedValueOnce({} as any); // COMMIT

      const result = await verifyMagicLinkToken("valid-token");
      expect(result).toEqual({ sessionId: "new-session-id", agentId: "agent-1" });
    });
  });
});
