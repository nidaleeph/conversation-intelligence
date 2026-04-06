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
