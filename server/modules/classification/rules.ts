import type { SignalType } from "@shared/types.js";

interface RuleMatch {
  type: SignalType;
  confidence: number;
  actionable: boolean;
}

interface Rule {
  patterns: RegExp[];
  type: SignalType;
  confidence: number;
  actionable: boolean;
}

const RULES: Rule[] = [
  {
    patterns: [
      /\b(buyer|looking to buy|want(?:s)? to (?:buy|purchase)|new buyer|hot buyer)\b/i,
      /\b(buyer (?:looking|searching|seeking))\b/i,
    ],
    type: "Buyer Search",
    confidence: 0.92,
    actionable: true,
  },
  {
    patterns: [
      /\b(looking for a tenant|need(?:s)? a tenant|landlord looking|seeking (?:a )?tenant)\b/i,
    ],
    type: "Landlord Signal",
    confidence: 0.90,
    actionable: true,
  },
  {
    patterns: [
      /\b(looking for a rental|looking to rent|tenant (?:looking|searching)|need(?:s)? a rental)\b/i,
      /\bhave a (?:rental|tenant)\b.*\b(?:search|looking)\b/i,
      /\b(?:does anyone have|anyone have)\b.*\b(?:rental|rent)\b/i,
    ],
    type: "Tenant Search",
    confidence: 0.90,
    actionable: true,
  },
  {
    patterns: [
      /\b(available to (?:rent|let)|to let|for rent|available (?:for )?(?:rent|letting))\b/i,
      /\b(?:pcm|per calendar month)\b/i,
    ],
    type: "Property for Rent",
    confidence: 0.91,
    actionable: true,
  },
  {
    patterns: [
      /\b(just listed|new listing|new instruction|just instructed|price reduction)\b/i,
      /£[\d,.]+(?:m|k)?\s*,?\s*\d+\s*bed/i,
      /\d+\s*bed.*£[\d,.]+(?:m|k)?/i,
    ],
    type: "Property for Sale",
    confidence: 0.93,
    actionable: true,
  },
  {
    patterns: [
      /\b(does anyone know|can anyone recommend|looking for a (?:good )?(?:architect|builder|plumber|lawyer|solicitor|surveyor|decorator|cleaner))\b/i,
      /\b(recommend(?:ation)?s? for|anyone know)\b/i,
    ],
    type: "Service Request",
    confidence: 0.88,
    actionable: true,
  },
  {
    patterns: [
      /\b(happy (?:birthday|new year|christmas|easter|holidays|anniversary))\b/i,
      /\b(congratulations|congrats|well done|good luck|thank(?:s| you) (?:all|everyone))\b/i,
      /\b(rip|condolences|thoughts and prayers)\b/i,
    ],
    type: "Social",
    confidence: 0.95,
    actionable: false,
  },
  {
    patterns: [
      /\b(out of office|ooo|on holiday|on vacation)\b/i,
    ],
    type: "Irrelevant",
    confidence: 0.90,
    actionable: false,
  },
];

export function classifyByRules(rawText: string): RuleMatch | null {
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(rawText)) {
        return {
          type: rule.type,
          confidence: rule.confidence,
          actionable: rule.actionable,
        };
      }
    }
  }
  return null;
}
