import { describe, it, expect } from "vitest";
import {
  loginSchema,
  createAgentSchema,
  updateAgentSchema,
} from "@shared/schemas";

describe("loginSchema", () => {
  it("accepts a valid email", () => {
    const result = loginSchema.safeParse({ email: "agent@ddre.com" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty email", () => {
    const result = loginSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });
});

describe("createAgentSchema", () => {
  it("accepts valid agent data", () => {
    const result = createAgentSchema.safeParse({
      name: "John Smith",
      email: "john@ddre.com",
      role: "agent",
      coverageAreas: ["Hampstead", "Highgate"],
    });
    expect(result.success).toBe(true);
  });

  it("defaults role to agent", () => {
    const result = createAgentSchema.safeParse({
      name: "John Smith",
      email: "john@ddre.com",
      coverageAreas: ["Hampstead"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("agent");
    }
  });

  it("rejects missing name", () => {
    const result = createAgentSchema.safeParse({
      email: "john@ddre.com",
      coverageAreas: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = createAgentSchema.safeParse({
      name: "John",
      email: "john@ddre.com",
      role: "superadmin",
      coverageAreas: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateAgentSchema", () => {
  it("accepts partial update", () => {
    const result = updateAgentSchema.safeParse({
      coverageAreas: ["Belsize Park"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no changes)", () => {
    const result = updateAgentSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
