import { describe, it, expect } from "vitest";
import { classifyByRules } from "../modules/classification/rules.js";

describe("classifyByRules", () => {
  it("classifies 'looking to buy' as Buyer Search", () => {
    const result = classifyByRules("I have a buyer looking to buy a 3 bed in Hampstead");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Buyer Search");
    expect(result!.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("classifies 'new buyer' as Buyer Search", () => {
    const result = classifyByRules("I have a new buyer looking for a house in NW3");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Buyer Search");
  });

  it("classifies rental search as Tenant Search", () => {
    const result = classifyByRules("Does anyone have a rental in Marylebone 2 bed 2 bath £9k a month");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Tenant Search");
  });

  it("classifies 'just listed' as Property for Sale", () => {
    const result = classifyByRules("Just listed: Redington Road, NW3, £1,550,000, 3 Bed");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Property for Sale");
  });

  it("classifies property with price and beds as Property for Sale", () => {
    const result = classifyByRules("Redington Road, NW3, £1,550,000, 3 Bed, 2 Bath, 1,375 SQFT, Share of Freehold. Fees Available.");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Property for Sale");
  });

  it("classifies 'available to rent' as Property for Rent", () => {
    const result = classifyByRules("Beautiful 2 bed flat available to rent in Belsize Park, £3,500 pcm");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Property for Rent");
  });

  it("classifies 'does anyone know' as Service Request", () => {
    const result = classifyByRules("Does anyone know a good architect in the area?");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Service Request");
  });

  it("classifies 'happy birthday' as Social", () => {
    const result = classifyByRules("Happy birthday John! Hope you have a great day!");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Social");
  });

  it("classifies 'happy new year' as Social", () => {
    const result = classifyByRules("Happy new year everyone!");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Social");
  });

  it("classifies 'looking for a tenant' as Landlord Signal", () => {
    const result = classifyByRules("I'm looking for a tenant for my 3 bed in Highgate");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("Landlord Signal");
  });

  it("returns null for ambiguous messages", () => {
    const result = classifyByRules("Thanks for the info, will follow up tomorrow");
    expect(result).toBeNull();
  });

  it("returns actionable=false for Social", () => {
    const result = classifyByRules("Happy birthday!");
    expect(result).not.toBeNull();
    expect(result!.actionable).toBe(false);
  });

  it("returns actionable=true for Buyer Search", () => {
    const result = classifyByRules("New buyer looking for 3 bed house in Hampstead, budget £3m");
    expect(result).not.toBeNull();
    expect(result!.actionable).toBe(true);
  });
});
