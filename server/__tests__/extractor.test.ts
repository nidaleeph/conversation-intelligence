import { describe, it, expect } from "vitest";
import { extractFields } from "../modules/classification/extractor.js";

describe("extractFields", () => {
  it("extracts budget in millions (£3.3m)", () => {
    const result = extractFields("Budget up to £3.3m, Hampstead");
    expect(result.budgetMax).toBe(3_300_000);
  });

  it("extracts budget in thousands (£550k)", () => {
    const result = extractFields("Looking for something around £550k");
    expect(result.budgetMax).toBe(550_000);
  });

  it("extracts budget with commas (£1,550,000)", () => {
    const result = extractFields("Redington Road, NW3, £1,550,000, 3 Bed");
    expect(result.budgetMax).toBe(1_550_000);
  });

  it("extracts bedrooms (3 bed)", () => {
    const result = extractFields("Minimum 3 beds, garden, Hampstead");
    expect(result.bedrooms).toBe(3);
  });

  it("extracts bedrooms (4 bedroom)", () => {
    const result = extractFields("4 bedroom house with parking");
    expect(result.bedrooms).toBe(4);
  });

  it("extracts bathrooms (2 bath)", () => {
    const result = extractFields("3 bed 2 bath apartment");
    expect(result.bathrooms).toBe(2);
  });

  it("extracts sqft", () => {
    const result = extractFields("1,375 SQFT, Share of Freehold");
    expect(result.sqft).toBe(1375);
  });

  it("extracts known locations", () => {
    const result = extractFields("Hampstead, Belsize Park, Primrose Hill");
    expect(result.location).toContain("Hampstead");
    expect(result.location).toContain("Belsize Park");
    expect(result.location).toContain("Primrose Hill");
  });

  it("extracts postcodes (NW3)", () => {
    const result = extractFields("Property in NW3, £2m");
    expect(result.postcodes).toContain("NW3");
  });

  it("extracts multiple postcodes", () => {
    const result = extractFields("NW3, NW6, or NW8 area");
    expect(result.postcodes).toContain("NW3");
    expect(result.postcodes).toContain("NW6");
    expect(result.postcodes).toContain("NW8");
  });

  it("extracts property type (house)", () => {
    const result = extractFields("Looking for a house or garden flat");
    expect(result.propertyType).toBe("House");
  });

  it("extracts property type (flat)", () => {
    const result = extractFields("2 bed flat in Hampstead");
    expect(result.propertyType).toBe("Flat");
  });

  it("detects garden/outside space", () => {
    const result = extractFields("Needs a garden or outside space");
    expect(result.outsideSpace).toBe(true);
  });

  it("detects parking", () => {
    const result = extractFields("2 bed with parking, £9k a month");
    expect(result.parking).toBe(true);
  });

  it("returns nulls for missing fields", () => {
    const result = extractFields("Happy new year everyone!");
    expect(result.budgetMin).toBeNull();
    expect(result.budgetMax).toBeNull();
    expect(result.bedrooms).toBeNull();
    expect(result.location).toEqual([]);
    expect(result.postcodes).toEqual([]);
  });

  it("extracts pcm rental budget", () => {
    const result = extractFields("£9k a month, Marylebone");
    expect(result.budgetMax).toBe(9_000);
  });
});
