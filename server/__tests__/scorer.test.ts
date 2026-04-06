import { describe, it, expect } from "vitest";
import { scoreMatch } from "../modules/matching/scorer.js";

const buyerSignal = {
  id: "buyer-1",
  type: "Buyer Search" as const,
  location: ["Hampstead", "Belsize Park"],
  budgetMin: null,
  budgetMax: 3_000_000,
  bedrooms: 3,
  propertyType: "House",
  createdAt: new Date().toISOString(),
};

const listingSignal = {
  id: "listing-1",
  type: "Property for Sale" as const,
  location: ["Hampstead"],
  budgetMin: null,
  budgetMax: 2_800_000,
  bedrooms: 3,
  propertyType: "House",
  createdAt: new Date().toISOString(),
};

describe("scoreMatch", () => {
  it("scores a perfect match above 0.9", () => {
    const result = scoreMatch(buyerSignal, listingSignal);
    expect(result.score).toBeGreaterThan(0.9);
    expect(result.reasons).toContain("area overlap");
    expect(result.reasons).toContain("budget fit");
    expect(result.reasons).toContain("bedroom match");
    expect(result.reasons).toContain("property type match");
  });

  it("scores zero when no area overlap", () => {
    const noOverlap = { ...listingSignal, location: ["Islington"] };
    const result = scoreMatch(buyerSignal, noOverlap);
    expect(result.score).toBeLessThan(0.5);
    expect(result.reasons).not.toContain("area overlap");
  });

  it("scores budget fit with 15% tolerance", () => {
    const slightlyOver = { ...listingSignal, budgetMax: 3_400_000 };
    const result = scoreMatch(buyerSignal, slightlyOver);
    expect(result.reasons).toContain("budget fit");
  });

  it("fails budget fit when listing is >15% over buyer budget", () => {
    const tooExpensive = { ...listingSignal, budgetMax: 4_000_000 };
    const result = scoreMatch(buyerSignal, tooExpensive);
    expect(result.reasons).not.toContain("budget fit");
  });

  it("scores bedroom match for exact match", () => {
    const result = scoreMatch(buyerSignal, listingSignal);
    expect(result.reasons).toContain("bedroom match");
  });

  it("scores bedroom match for ±1", () => {
    const fourBed = { ...listingSignal, bedrooms: 4 };
    const result = scoreMatch(buyerSignal, fourBed);
    expect(result.reasons).toContain("bedroom match");
  });

  it("fails bedroom match for ±2 or more", () => {
    const sixBed = { ...listingSignal, bedrooms: 6 };
    const result = scoreMatch(buyerSignal, sixBed);
    expect(result.reasons).not.toContain("bedroom match");
  });

  it("handles null budgets gracefully", () => {
    const noBudget = { ...buyerSignal, budgetMax: null };
    const result = scoreMatch(noBudget, listingSignal);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("handles null bedrooms gracefully", () => {
    const noBeds = { ...buyerSignal, bedrooms: null };
    const result = scoreMatch(noBeds, listingSignal);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("applies recency decay for old signals", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 45);
    const oldListing = { ...listingSignal, createdAt: oldDate.toISOString() };
    const freshResult = scoreMatch(buyerSignal, listingSignal);
    const oldResult = scoreMatch(buyerSignal, oldListing);
    expect(oldResult.score).toBeLessThan(freshResult.score);
  });
});
