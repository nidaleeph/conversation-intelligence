// ============================================================
// DDRE War Room Design System — Data Layer
// Colour tokens: bg #1a1e23, card #22272d, teal #77d5c0, gold #d4a843
// Typography: DM Sans, section headers 0.65rem uppercase teal
// ============================================================

export type SignalType =
  | "Buyer Search"
  | "Tenant Search"
  | "Seller Signal"
  | "Landlord Signal"
  | "Property for Sale"
  | "Property for Rent"
  | "Service Request"
  | "Service Reply"
  | "Contextual Reply"
  | "Social"
  | "Irrelevant"
  | "Market Commentary";

export type SignalStatus = "New" | "Reviewed" | "Alerted" | "Matched";

export interface RawMessage {
  id: string;
  timestamp: string;
  sender: string;
  platform: string;
  rawText: string;
  classification: SignalType;
  confidence: number;
  actionable: boolean;
  retained: "Yes" | "No" | "Unknown";
}

export interface Signal {
  id: string;
  type: SignalType;
  location: string[];
  postcodes: string[];
  budget: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  outsideSpace: string;
  parking: string;
  condition: string;
  feeRequired: string;
  retained: "Yes" | "No" | "Unknown";
  agent: string;
  platform: string;
  timestamp: string;
  confidence: number;
  summary: string;
  status: SignalStatus;
  messageId: string;
}

export interface Alert {
  id: string;
  recipientAgent: string;
  matchingArea: string;
  signalType: SignalType;
  summary: string;
  originatingAgent: string;
  timestamp: string;
  priority: "High" | "Medium" | "Low";
}

export interface AgentProfile {
  name: string;
  areas: string[];
  signalCount: number;
}

// ============================================================
// RAW MESSAGES — parsed from Hampstead conversation
// ============================================================

export const rawMessages: RawMessage[] = [
  {
    id: "MSG-001",
    timestamp: "2026-01-02T09:58:42Z",
    sender: "Scott Bennett",
    platform: "WhatsApp",
    rawText: "Happy new year to you all!\nI have a new search hot buyer looking for:\nMinimum 3 beds\nNeeds a garden\nHouse or garden flat\nBudget up to £3.3m\nIdeally turnkey but will look at anything that needs work as well\nHampstead or Belsize park\nNeed a fee please",
    classification: "Buyer Search",
    confidence: 0.96,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-002",
    timestamp: "2026-01-02T21:44:20Z",
    sender: "Scott Bennett",
    platform: "WhatsApp",
    rawText: "I have a new buyer looking for:\nMinimum 3 beds\nNeeds a garden\nHouse or garden flat\nBudget up to £4m\nHampstead, Belsize park, primrose hill or south Hampstead\nNeed a fee please",
    classification: "Buyer Search",
    confidence: 0.97,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-003",
    timestamp: "2026-01-05T10:24:36Z",
    sender: "Natalie Malka",
    platform: "WhatsApp",
    rawText: "Happy New Year All. Does anyone have a rental in Marylebone 2 bed 2 bath ideally with parking £9k a month. Needed from Feb - please let me know x",
    classification: "Tenant Search",
    confidence: 0.95,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-004",
    timestamp: "2026-01-05T13:52:00Z",
    sender: "Lauren Christy",
    platform: "WhatsApp",
    rawText: "Hi All, happy new year! Have a great buyer looking for a 2 bed + turnkey apartment or house in Hampstead, Primrose Hill, SJW with a budget up to £2.5m. Needs to have a garden or outside space. Please send off-market options only as have sent all on portals already.",
    classification: "Buyer Search",
    confidence: 0.95,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-005",
    timestamp: "2026-01-07T13:14:26Z",
    sender: "Daisy Spanbok",
    platform: "WhatsApp",
    rawText: "Does anyone know any architects who are familiar with the suburbs and are reasonably priced?",
    classification: "Service Request",
    confidence: 0.88,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-006",
    timestamp: "2026-01-07T16:25:53Z",
    sender: "Jamie Gallagher ADN",
    platform: "WhatsApp",
    rawText: "Slightly out of patch but does anyone have a turnkey freehold in Tufnell Park / Kentish Town. Min 4 beds. Budget is up to £2.2m. Not retained.",
    classification: "Buyer Search",
    confidence: 0.93,
    actionable: true,
    retained: "No",
  },
  {
    id: "MSG-007",
    timestamp: "2026-01-08T12:53:36Z",
    sender: "Jonathan Singer",
    platform: "WhatsApp",
    rawText: "Redington Road, NW3, £1,550,000, 3 Bed, 2 Bath, 1,375 SQFT, Share of Freehold. Fees Available.",
    classification: "Property for Sale",
    confidence: 0.98,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-008",
    timestamp: "2026-01-08T13:18:23Z",
    sender: "Zoe Green",
    platform: "WhatsApp",
    rawText: "Hi all, Happy New Year! A reminder of our off-market Belsize Avenue garden maisonette £3.25m. 2152 sqft. 4 bed, 3 bath. Stucco fronted and in great condition. 0.5% fee + £5k neg bonus.",
    classification: "Property for Sale",
    confidence: 0.97,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-009",
    timestamp: "2026-01-09T16:37:54Z",
    sender: "Dan Stern",
    platform: "WhatsApp",
    rawText: "Very hot buyer. Cash. £5m. Kenwood, Highgate, Hampstead, Heath Extension. Ideally close to King Alfred school and a station. 5 bed plus study. Open to works at the right level. Timings - within the next 6 months.",
    classification: "Buyer Search",
    confidence: 0.97,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-010",
    timestamp: "2026-01-12T13:39:38Z",
    sender: "Katie Gee",
    platform: "WhatsApp",
    rawText: "Looking for a 4/5 bedroom house on the south side of Hampstead Garden Suburb. Budget from 2.5m to 3.2m max. Ideally no work but happy if minimal. Has seen a few options on the market so any new or off market options would be appreciated. I am not retained.",
    classification: "Buyer Search",
    confidence: 0.94,
    actionable: true,
    retained: "No",
  },
  {
    id: "MSG-011",
    timestamp: "2026-01-12T13:56:07Z",
    sender: "Adam Newman",
    platform: "WhatsApp",
    rawText: "Anything new coming up guys, need a fee preferably. Budget flexible, but ideally below £15m, cash buyer, not in a chain. Ideally turnkey, but willing to do some work if not structural etc. Hampstead or Hampstead Garden Suburb. 7,000+ sqft.",
    classification: "Buyer Search",
    confidence: 0.96,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-012",
    timestamp: "2026-01-14T14:33:55Z",
    sender: "Jake",
    platform: "WhatsApp",
    rawText: "Afternoon, fees available, 2 bedroom penthouse in The Panoramic - £1,750,000. Just had cladding works signed off & scaffolding taken down.",
    classification: "Property for Sale",
    confidence: 0.96,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-013",
    timestamp: "2026-01-15T11:58:55Z",
    sender: "Jamie Gallagher ADN",
    platform: "WhatsApp",
    rawText: "5+ Bed Search, NW3, Freehold, 3000+ Sqft, Need a fee. Off market / Discreet Options only please. Up to £5.5m.",
    classification: "Buyer Search",
    confidence: 0.97,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-014",
    timestamp: "2026-01-16T08:00:48Z",
    sender: "Jonathan Singer",
    platform: "WhatsApp",
    rawText: "Retained Search. £4m. St John's Wood. 4 Bed+. Houses Only. Open to doing work. Please send anything off market.",
    classification: "Buyer Search",
    confidence: 0.98,
    actionable: true,
    retained: "Yes",
  },
  {
    id: "MSG-015",
    timestamp: "2026-01-19T09:53:51Z",
    sender: "Scott Bennett",
    platform: "WhatsApp",
    rawText: "New search. House or apartment. Must have outside space as they have a dog. 4 bedrooms. St John's Wood, Belsize Park or Primrose Hill. Budget up to £4.5m. Chain free. Ideally turnkey. Need a fee please.",
    classification: "Buyer Search",
    confidence: 0.96,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-016",
    timestamp: "2026-01-21T15:01:34Z",
    sender: "Daisy Spanbok",
    platform: "WhatsApp",
    rawText: "Working with a buyer looking for a 4 bedroom house in Hampstead / the suburbs. Budget up to about £3.2m. Not retained. Happy to do work if priced lower.",
    classification: "Buyer Search",
    confidence: 0.94,
    actionable: true,
    retained: "No",
  },
  {
    id: "MSG-017",
    timestamp: "2026-01-22T16:33:35Z",
    sender: "Simon Dean Private",
    platform: "WhatsApp",
    rawText: "This buyer has increased his budget to £6m. I can be retained for anything which is off-market. Hampstead or Highgate, doesn't want to do any work.",
    classification: "Buyer Search",
    confidence: 0.95,
    actionable: true,
    retained: "Yes",
  },
  {
    id: "MSG-018",
    timestamp: "2026-01-27T16:04:22Z",
    sender: "Kevin Dolly",
    platform: "WhatsApp",
    rawText: "Hot buyer looking for the following: Primrose or Belsize Park only. Houses only. Min 3000 sqft - Max 5000 sqft. Must have garden & parking. Must be turnkey and a vendor who can ideally move quickly. Budget up to £13m. Cash buyer.",
    classification: "Buyer Search",
    confidence: 0.98,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-019",
    timestamp: "2026-01-28T13:54:17Z",
    sender: "Nouri @ Henry Alexander x Vita Properties",
    platform: "WhatsApp",
    rawText: "Got a super hot chain free buyer. 2 bed min. Budget up to £2.5m. Hampstead, Belsize Park, Primrose Hill. Turnkey only. Fee required.",
    classification: "Buyer Search",
    confidence: 0.96,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-020",
    timestamp: "2026-01-29T10:28:17Z",
    sender: "Dan Stern",
    platform: "WhatsApp",
    rawText: "Back to the market. Sheldon Avenue N6 - £8,950,000. 6228 sq.ft. 7 bed. 6 bath. 110 ft west facing garden. Outdoor pool. Separate pool house with gym. Gated driveway. Fees available.",
    classification: "Property for Sale",
    confidence: 0.99,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-021",
    timestamp: "2026-02-03T20:32:05Z",
    sender: "Ok/Vita",
    platform: "WhatsApp",
    rawText: "West Hampstead house search. 3.5m. Retained.",
    classification: "Buyer Search",
    confidence: 0.92,
    actionable: true,
    retained: "Yes",
  },
  {
    id: "MSG-022",
    timestamp: "2026-02-04T13:46:42Z",
    sender: "Daisy Spanbok",
    platform: "WhatsApp",
    rawText: "New listing. Sheldon Avenue N6. £11,500,000. 9,246 sqft. 8 bed. 8 bath. Carriage gated driveway. Swimming pool. Gym/spa facilities. Fees available.",
    classification: "Property for Sale",
    confidence: 0.99,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-023",
    timestamp: "2026-02-06T07:33:03Z",
    sender: "Alex Main",
    platform: "WhatsApp",
    rawText: "Morning all, dealing with a motivated family looking for: good looking house, ideally detached, good garden, good condition, maybe a project but the numbers need to work. £7m, maybe more if super special. Location: all of Highgate, but ideally closer to Kenwood.",
    classification: "Buyer Search",
    confidence: 0.95,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-024",
    timestamp: "2026-02-09T10:35:31Z",
    sender: "Kevin Dolly",
    platform: "WhatsApp",
    rawText: "You're invited to our Open House this Thursday at 5 Belsize Place, NW3. Property is available off market for rent or purchase with generous fees offered.",
    classification: "Property for Sale",
    confidence: 0.88,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-025",
    timestamp: "2026-02-11T11:40:14Z",
    sender: "Jack - SDRE",
    platform: "WhatsApp",
    rawText: "Working with a buyer looking for a 2/3 bed apartment in Belsize Park. Budget up to £2m. 3 beds, circa 1500 sq ft, no lower ground floor. Please let me know of any suitable options, not retained.",
    classification: "Buyer Search",
    confidence: 0.94,
    actionable: true,
    retained: "No",
  },
  {
    id: "MSG-026",
    timestamp: "2026-02-16T10:17:55Z",
    sender: "Robert Kramer Property Consultancy Ltd.",
    platform: "WhatsApp",
    rawText: "Looking for a lateral apartment in one of the better Hampstead or Kenwood blocks. 2500 sq ft+ with good formal dining area. As few internal steps as possible. Healthy flexible budget. Not Bishops Avenue.",
    classification: "Buyer Search",
    confidence: 0.93,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-027",
    timestamp: "2026-02-17T19:01:46Z",
    sender: "Daisy Spanbok",
    platform: "WhatsApp",
    rawText: "Looking for a lateral apartment in NW3. No period conversions and no duplexes. Minimum 2000 sqft ish but nothing bigger than 3500/4000 sqft. Up to £5m but could stretch if perfect. Likes Novel House. Close to Heath. Doesn't want a large garden, needs to be small and easily maintainable. Not retained.",
    classification: "Buyer Search",
    confidence: 0.94,
    actionable: true,
    retained: "No",
  },
  {
    id: "MSG-028",
    timestamp: "2026-02-18T17:07:01Z",
    sender: "Zoe Green",
    platform: "WhatsApp",
    rawText: "New search. Hampstead / NW3. As close to village as possible. Open to period/modern. No major works. Must have a room at least 7x5m. Please send all options up to £8m. Retained for off-market.",
    classification: "Buyer Search",
    confidence: 0.96,
    actionable: true,
    retained: "Yes",
  },
  {
    id: "MSG-029",
    timestamp: "2026-02-19T16:48:09Z",
    sender: "Dan Stern",
    platform: "WhatsApp",
    rawText: "Does anyone have anything off market in Dartmouth Park? 3 bed. Circa 1600 sq.ft. In good condition. Up to £2.5m. Very motivated cash buyer. Fee required.",
    classification: "Buyer Search",
    confidence: 0.95,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-030",
    timestamp: "2026-02-20T14:31:20Z",
    sender: "Daisy Spanbok",
    platform: "WhatsApp",
    rawText: "Great buyers looking for minimum 8000 sqft. Budget up to £12m but please send up to £15m. 6 beds. Ideally indoor pool and leisure space. Needs separate living / kitchen space or annex for mother in law. Highgate or suburbs close to Kenwood. Need a fee.",
    classification: "Buyer Search",
    confidence: 0.97,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-031",
    timestamp: "2026-02-21T12:54:44Z",
    sender: "Scott Bennett",
    platform: "WhatsApp",
    rawText: "New search: renting at the moment, looking for either a house or flat, south facing garden, bright and sunny interior, Hampstead area, budget around £4m but could go up a bit more for right property, 3-4 beds, not on a main road. Need a fee please.",
    classification: "Buyer Search",
    confidence: 0.95,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-032",
    timestamp: "2026-02-23T17:28:31Z",
    sender: "Natalie Malka",
    platform: "WhatsApp",
    rawText: "Looking for a 3–4 bedroom house in Mill Hill, Finchley, Golders Green or Temple Fortune - for rental. Need something asap. £6k a month.",
    classification: "Tenant Search",
    confidence: 0.96,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-033",
    timestamp: "2026-02-24T11:30:46Z",
    sender: "Scott Bennett",
    platform: "WhatsApp",
    rawText: "New search. 3 bedrooms+. Hampstead or Primrose Hill. House or garden flat. Turnkey condition. Ideally something off market. Budget between £3.5-4m. Cash buyer. In London tomorrow. Need a fee please.",
    classification: "Buyer Search",
    confidence: 0.97,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-034",
    timestamp: "2026-02-24T13:16:43Z",
    sender: "Kevin Dolly",
    platform: "WhatsApp",
    rawText: "Big price drop. 21 Regents Park Road, NW1. 3396 sqft. 4/5 bedrooms. South facing garden. Good condition. Great ceiling heights. Guide price £5m. 0.5% and a 10k neg bonus.",
    classification: "Property for Sale",
    confidence: 0.98,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-035",
    timestamp: "2026-02-25T11:40:36Z",
    sender: "Alex Main",
    platform: "WhatsApp",
    rawText: "I have a very good value garden apartment off market in Belsize Park. 2,700 sq ft. Large rear garden. 3 double bedrooms. 3 bathrooms. Guide £3,000,000.",
    classification: "Property for Sale",
    confidence: 0.97,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-036",
    timestamp: "2026-02-26T14:33:03Z",
    sender: "Ok/Vita",
    platform: "WhatsApp",
    rawText: "Buyer Search. 4 beds over 2/3 floors max. Up to £5m - in NW3, NW8, W9 and South Hampstead. Fee required.",
    classification: "Buyer Search",
    confidence: 0.96,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-037",
    timestamp: "2026-02-26T16:18:37Z",
    sender: "Sam Buckwald",
    platform: "WhatsApp",
    rawText: "Flat. 2 bed + study / 3 bed. Private garden is a must. Up to £1.4m. Will consider works if priced lower. West Hampstead, Queen's Park, Kilburn. Not retained so need a fee.",
    classification: "Buyer Search",
    confidence: 0.94,
    actionable: true,
    retained: "No",
  },
  {
    id: "MSG-038",
    timestamp: "2026-02-27T15:37:29Z",
    sender: "Daisy Spanbok",
    platform: "WhatsApp",
    rawText: "Does anyone have anything to rent in Milbrook Court? Or anything for sale that will rent there.",
    classification: "Tenant Search",
    confidence: 0.82,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-039",
    timestamp: "2026-02-27T21:13:09Z",
    sender: "Howard Mobile",
    platform: "WhatsApp",
    rawText: "It's going to make the Finchley Rd even worse than it is now!",
    classification: "Irrelevant",
    confidence: 0.91,
    actionable: false,
    retained: "Unknown",
  },
  {
    id: "MSG-040",
    timestamp: "2026-02-27T22:26:11Z",
    sender: "Nibbs",
    platform: "WhatsApp",
    rawText: "I am buying a bin lorry",
    classification: "Social",
    confidence: 0.95,
    actionable: false,
    retained: "Unknown",
  },
  {
    id: "MSG-041",
    timestamp: "2026-02-28T08:23:04Z",
    sender: "Zoe Green",
    platform: "WhatsApp",
    rawText: "Two retained buyers. NW3. Absolute minimum 2300 sqft. Must have character / something special. Projects only please, nothing turnkey. £4-7m depending on works.",
    classification: "Buyer Search",
    confidence: 0.96,
    actionable: true,
    retained: "Yes",
  },
  {
    id: "MSG-042",
    timestamp: "2026-03-02T08:33:04Z",
    sender: "Orly Lehman",
    platform: "WhatsApp",
    rawText: "Anyone got a rental in Hampstead or surrounding areas; circa £4,500 a month, has to be decent condition, lady living alone. Circa 6 months. Don't need a fee.",
    classification: "Tenant Search",
    confidence: 0.94,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-043",
    timestamp: "2026-03-04T11:50:22Z",
    sender: "Kevin Dolly",
    platform: "WhatsApp",
    rawText: "48c Netherhall Gardens. 4/5 Bedrooms. 3990 Sqft. Gated Off Street Parking. Turnkey Condition. Private terrace. Guide £5.95m. 0.5% split and a £7,500 neg bonus.",
    classification: "Property for Sale",
    confidence: 0.98,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-044",
    timestamp: "2026-03-05T13:02:58Z",
    sender: "Kevin Dolly",
    platform: "WhatsApp",
    rawText: "Agent Open House. 71 Redington Road, NW3. Tuesday 12th March, 12:00 – 14:00. 0.5% fee + £10,000 negotiator bonus.",
    classification: "Property for Sale",
    confidence: 0.92,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-045",
    timestamp: "2026-03-06T09:15:30Z",
    sender: "Zoe Green",
    platform: "WhatsApp",
    rawText: "Any new off-market houses or maisonettes up to £4m max in NW3? Cash buyer.",
    classification: "Buyer Search",
    confidence: 0.93,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-046",
    timestamp: "2026-03-10T10:51:56Z",
    sender: "Ok/Vita",
    platform: "WhatsApp",
    rawText: "Looking for a house around Bishops Ave - Highgate with a pool. Budget up to 25k per month. Fee required.",
    classification: "Tenant Search",
    confidence: 0.94,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-047",
    timestamp: "2026-03-12T10:36:08Z",
    sender: "Josh C",
    platform: "WhatsApp",
    rawText: "Looking for a house in Hampstead Garden Suburb. Needs to be south facing and ideally unmodernised needing refurbishment. Around 2500/2600 sq ft with option to extend. Sweet spot around £2.6/2.7m. Fees needed.",
    classification: "Buyer Search",
    confidence: 0.95,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-048",
    timestamp: "2026-03-12T14:56:50Z",
    sender: "Jonathan Singer",
    platform: "WhatsApp",
    rawText: "New Search. £2 -£4m. South & West Hampstead. 4 Bed+. Garden flats & Houses Only. Ideally Turn Key.",
    classification: "Buyer Search",
    confidence: 0.96,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-049",
    timestamp: "2026-03-12T16:09:02Z",
    sender: "Kevin Dolly",
    platform: "WhatsApp",
    rawText: "Retained Search. Hot Buyer. £1.2m absolute max. Outdoor Space is must have. Cash Buyer. Min 2 beds. Open to Cosmetic Work. Wants Belsize Park area.",
    classification: "Buyer Search",
    confidence: 0.97,
    actionable: true,
    retained: "Yes",
  },
  {
    id: "MSG-050",
    timestamp: "2026-03-13T11:48:38Z",
    sender: "Scott Bennett",
    platform: "WhatsApp",
    rawText: "New search. Looking for minimum 3 beds in Belsize Park or Primrose Hill up to £4m, would look at a house only over 3 floors, garden flat or a penthouse with outside space. Need a fee please.",
    classification: "Buyer Search",
    confidence: 0.96,
    actionable: true,
    retained: "Unknown",
  },
  {
    id: "MSG-051",
    timestamp: "2026-03-13T14:25:26Z",
    sender: "Natalie Malka",
    platform: "WhatsApp",
    rawText: "Does anyone have any houses right by the Heath. £4-£6m. The closer the better. Hampstead.",
    classification: "Buyer Search",
    confidence: 0.93,
    actionable: true,
    retained: "Unknown",
  },
];

// ============================================================
// STRUCTURED SIGNALS — parcelled from actionable messages
// ============================================================

export const signals: Signal[] = [
  {
    id: "SIG-001", type: "Buyer Search", location: ["Hampstead", "Belsize Park"], postcodes: ["NW3", "NW3"], budget: "Up to £3.3m",
    propertyType: "House / Garden Flat", bedrooms: "3+", bathrooms: "-", sqft: "-", outsideSpace: "Garden required",
    parking: "-", condition: "Turnkey preferred, open to works", feeRequired: "Yes",
    retained: "Unknown", agent: "Scott Bennett", platform: "WhatsApp", timestamp: "2026-01-02T09:58:42Z",
    confidence: 0.96, summary: "Hot buyer seeking 3+ bed house or garden flat in Hampstead/Belsize Park, up to £3.3m, garden essential, fee required.",
    status: "Alerted", messageId: "MSG-001",
  },
  {
    id: "SIG-002", type: "Buyer Search", location: ["Hampstead", "Belsize Park", "Primrose Hill", "South Hampstead"], postcodes: ["NW3", "NW3", "NW1", "NW6"], budget: "Up to £4m",
    propertyType: "House / Garden Flat", bedrooms: "3+", bathrooms: "-", sqft: "-", outsideSpace: "Garden required",
    parking: "-", condition: "Any", feeRequired: "Yes",
    retained: "Unknown", agent: "Scott Bennett", platform: "WhatsApp", timestamp: "2026-01-02T21:44:20Z",
    confidence: 0.97, summary: "Buyer seeking 3+ bed with garden across Hampstead, Belsize Park, Primrose Hill or South Hampstead, up to £4m.",
    status: "Alerted", messageId: "MSG-002",
  },
  {
    id: "SIG-003", type: "Tenant Search", location: ["Marylebone"], postcodes: ["W1"], budget: "£9,000 pcm",
    propertyType: "Flat", bedrooms: "2", bathrooms: "2", sqft: "-", outsideSpace: "-",
    parking: "Preferred", condition: "Good", feeRequired: "Unknown",
    retained: "Unknown", agent: "Natalie Malka", platform: "WhatsApp", timestamp: "2026-01-05T10:24:36Z",
    confidence: 0.95, summary: "Rental search: 2 bed 2 bath in Marylebone with parking, £9k pcm, needed from February.",
    status: "Reviewed", messageId: "MSG-003",
  },
  {
    id: "SIG-004", type: "Buyer Search", location: ["Hampstead", "Primrose Hill", "St John's Wood"], postcodes: ["NW3", "NW1", "NW8"], budget: "Up to £2.5m",
    propertyType: "Apartment / House", bedrooms: "2+", bathrooms: "-", sqft: "-", outsideSpace: "Garden / outside space required",
    parking: "-", condition: "Turnkey", feeRequired: "Unknown",
    retained: "Unknown", agent: "Lauren Christy", platform: "WhatsApp", timestamp: "2026-01-05T13:52:00Z",
    confidence: 0.95, summary: "Buyer seeking 2+ bed turnkey in Hampstead/Primrose Hill/SJW, up to £2.5m, off-market only, outside space essential.",
    status: "Alerted", messageId: "MSG-004",
  },
  {
    id: "SIG-005", type: "Service Request", location: ["Hampstead suburbs"], postcodes: ["NW11"], budget: "-",
    propertyType: "-", bedrooms: "-", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "-", feeRequired: "-",
    retained: "Unknown", agent: "Daisy Spanbok", platform: "WhatsApp", timestamp: "2026-01-07T13:14:26Z",
    confidence: 0.88, summary: "Architect recommendation request for the suburbs, reasonably priced.",
    status: "Reviewed", messageId: "MSG-005",
  },
  {
    id: "SIG-006", type: "Buyer Search", location: ["Tufnell Park", "Kentish Town"], postcodes: ["N7", "NW5"], budget: "Up to £2.2m",
    propertyType: "Freehold House", bedrooms: "4+", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "Turnkey", feeRequired: "Unknown",
    retained: "No", agent: "Jamie Gallagher ADN", platform: "WhatsApp", timestamp: "2026-01-07T16:25:53Z",
    confidence: 0.93, summary: "Buyer seeking turnkey freehold 4+ bed in Tufnell Park/Kentish Town, up to £2.2m, not retained.",
    status: "New", messageId: "MSG-006",
  },
  {
    id: "SIG-007", type: "Property for Sale", location: ["Redington Road, NW3"], postcodes: ["NW3"], budget: "£1,550,000",
    propertyType: "Share of Freehold Flat", bedrooms: "3", bathrooms: "2", sqft: "1,375", outsideSpace: "-",
    parking: "-", condition: "-", feeRequired: "Yes",
    retained: "Unknown", agent: "Jonathan Singer", platform: "WhatsApp", timestamp: "2026-01-08T12:53:36Z",
    confidence: 0.98, summary: "Redington Road NW3, 3 bed 2 bath, 1,375 sqft, share of freehold, £1.55m, fees available.",
    status: "Alerted", messageId: "MSG-007",
  },
  {
    id: "SIG-008", type: "Property for Sale", location: ["Belsize Avenue"], postcodes: ["NW3"], budget: "£3,250,000",
    propertyType: "Garden Maisonette", bedrooms: "4", bathrooms: "3", sqft: "2,152", outsideSpace: "Garden",
    parking: "-", condition: "Great condition", feeRequired: "0.5% + £5k neg bonus",
    retained: "Unknown", agent: "Zoe Green", platform: "WhatsApp", timestamp: "2026-01-08T13:18:23Z",
    confidence: 0.97, summary: "Off-market Belsize Avenue garden maisonette, 4 bed 3 bath, 2,152 sqft, stucco fronted, £3.25m.",
    status: "Alerted", messageId: "MSG-008",
  },
  {
    id: "SIG-009", type: "Buyer Search", location: ["Kenwood", "Highgate", "Hampstead", "Heath Extension"], postcodes: ["N6", "N6", "NW3", "NW3"], budget: "£5m cash",
    propertyType: "House", bedrooms: "5+ plus study", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "Open to works", feeRequired: "Unknown",
    retained: "Unknown", agent: "Dan Stern", platform: "WhatsApp", timestamp: "2026-01-09T16:37:54Z",
    confidence: 0.97, summary: "Very hot cash buyer, £5m, 5+ bed plus study, Kenwood/Highgate/Hampstead, near King Alfred school, 6-month timeline.",
    status: "Alerted", messageId: "MSG-009",
  },
  {
    id: "SIG-010", type: "Buyer Search", location: ["Hampstead Garden Suburb"], postcodes: ["NW11"], budget: "£2.5m–£3.2m",
    propertyType: "House", bedrooms: "4-5", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "Minimal work", feeRequired: "No",
    retained: "No", agent: "Katie Gee", platform: "WhatsApp", timestamp: "2026-01-12T13:39:38Z",
    confidence: 0.94, summary: "4/5 bed house on south side of Hampstead Garden Suburb, £2.5m–£3.2m, not retained.",
    status: "Reviewed", messageId: "MSG-010",
  },
  {
    id: "SIG-011", type: "Buyer Search", location: ["Hampstead", "Hampstead Garden Suburb"], postcodes: ["NW3", "NW11"], budget: "Up to £15m",
    propertyType: "House", bedrooms: "-", bathrooms: "-", sqft: "7,000+", outsideSpace: "-",
    parking: "-", condition: "Turnkey preferred", feeRequired: "Yes",
    retained: "Unknown", agent: "Adam Newman", platform: "WhatsApp", timestamp: "2026-01-12T13:56:07Z",
    confidence: 0.96, summary: "Cash buyer, flexible budget up to £15m, 7,000+ sqft, Hampstead/HGS, turnkey preferred, fee needed.",
    status: "Alerted", messageId: "MSG-011",
  },
  {
    id: "SIG-012", type: "Property for Sale", location: ["The Panoramic"], postcodes: ["NW3"], budget: "£1,750,000",
    propertyType: "Penthouse", bedrooms: "2", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "Cladding completed", feeRequired: "Yes",
    retained: "Unknown", agent: "Jake", platform: "WhatsApp", timestamp: "2026-01-14T14:33:55Z",
    confidence: 0.96, summary: "2 bed penthouse in The Panoramic, £1.75m, cladding works completed, fees available.",
    status: "New", messageId: "MSG-012",
  },
  {
    id: "SIG-013", type: "Buyer Search", location: ["NW3"], postcodes: ["NW3"], budget: "Up to £5.5m",
    propertyType: "Freehold", bedrooms: "5+", bathrooms: "-", sqft: "3,000+", outsideSpace: "-",
    parking: "-", condition: "Any", feeRequired: "Yes",
    retained: "Unknown", agent: "Jamie Gallagher ADN", platform: "WhatsApp", timestamp: "2026-01-15T11:58:55Z",
    confidence: 0.97, summary: "5+ bed freehold in NW3, 3,000+ sqft, up to £5.5m, off-market/discreet only, fee needed.",
    status: "Alerted", messageId: "MSG-013",
  },
  {
    id: "SIG-014", type: "Buyer Search", location: ["St John's Wood"], postcodes: ["NW8"], budget: "£4m",
    propertyType: "House", bedrooms: "4+", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "Open to works", feeRequired: "Unknown",
    retained: "Yes", agent: "Jonathan Singer", platform: "WhatsApp", timestamp: "2026-01-16T08:00:48Z",
    confidence: 0.98, summary: "Retained search: 4+ bed houses in St John's Wood, £4m, open to works, off-market only.",
    status: "Matched", messageId: "MSG-014",
  },
  {
    id: "SIG-015", type: "Buyer Search", location: ["St John's Wood", "Belsize Park", "Primrose Hill"], postcodes: ["NW8", "NW3", "NW1"], budget: "Up to £4.5m",
    propertyType: "House / Apartment", bedrooms: "4", bathrooms: "-", sqft: "-", outsideSpace: "Must have (dog)",
    parking: "-", condition: "Turnkey", feeRequired: "Yes",
    retained: "Unknown", agent: "Scott Bennett", platform: "WhatsApp", timestamp: "2026-01-19T09:53:51Z",
    confidence: 0.96, summary: "4 bed with outside space (dog owner), SJW/Belsize Park/Primrose Hill, up to £4.5m, chain free, turnkey.",
    status: "Alerted", messageId: "MSG-015",
  },
  {
    id: "SIG-016", type: "Buyer Search", location: ["Hampstead", "Hampstead suburbs"], postcodes: ["NW3", "NW11"], budget: "Up to £3.2m",
    propertyType: "House", bedrooms: "4", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "Open to works if priced lower", feeRequired: "Unknown",
    retained: "No", agent: "Daisy Spanbok", platform: "WhatsApp", timestamp: "2026-01-21T15:01:34Z",
    confidence: 0.94, summary: "4 bed house in Hampstead/suburbs, up to £3.2m, not retained, happy to do work.",
    status: "Reviewed", messageId: "MSG-016",
  },
  {
    id: "SIG-017", type: "Buyer Search", location: ["Hampstead", "Highgate"], postcodes: ["NW3", "N6"], budget: "Up to £6m",
    propertyType: "House", bedrooms: "-", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "Turnkey only", feeRequired: "Yes",
    retained: "Yes", agent: "Simon Dean Private", platform: "WhatsApp", timestamp: "2026-01-22T16:33:35Z",
    confidence: 0.95, summary: "Budget increased to £6m, Hampstead or Highgate, no works, retained for off-market.",
    status: "Alerted", messageId: "MSG-017",
  },
  {
    id: "SIG-018", type: "Buyer Search", location: ["Primrose Hill", "Belsize Park"], postcodes: ["NW1", "NW3"], budget: "Up to £13m",
    propertyType: "House", bedrooms: "-", bathrooms: "-", sqft: "3,000–5,000", outsideSpace: "Garden & parking required",
    parking: "Required", condition: "Turnkey, quick vendor", feeRequired: "Unknown",
    retained: "Unknown", agent: "Kevin Dolly", platform: "WhatsApp", timestamp: "2026-01-27T16:04:22Z",
    confidence: 0.98, summary: "Hot cash buyer, houses only in Primrose Hill/Belsize Park, 3,000–5,000 sqft, up to £13m, turnkey, quick completion.",
    status: "Alerted", messageId: "MSG-018",
  },
  {
    id: "SIG-019", type: "Buyer Search", location: ["Hampstead", "Belsize Park", "Primrose Hill"], postcodes: ["NW3", "NW3", "NW1"], budget: "Up to £2.5m",
    propertyType: "Any", bedrooms: "2+", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "Turnkey", feeRequired: "Yes",
    retained: "Unknown", agent: "Nouri @ Henry Alexander x Vita Properties", platform: "WhatsApp", timestamp: "2026-01-28T13:54:17Z",
    confidence: 0.96, summary: "Super hot chain free buyer, 2+ bed, Hampstead/Belsize Park/Primrose Hill, up to £2.5m, turnkey, fee required.",
    status: "New", messageId: "MSG-019",
  },
  {
    id: "SIG-020", type: "Property for Sale", location: ["Sheldon Avenue, N6"], postcodes: ["N6"], budget: "£8,950,000",
    propertyType: "Detached House", bedrooms: "7", bathrooms: "6", sqft: "6,228", outsideSpace: "110ft garden, outdoor pool, pool house",
    parking: "Gated driveway", condition: "Good", feeRequired: "Yes",
    retained: "Unknown", agent: "Dan Stern", platform: "WhatsApp", timestamp: "2026-01-29T10:28:17Z",
    confidence: 0.99, summary: "Sheldon Avenue N6, 7 bed 6 bath, 6,228 sqft, outdoor pool, gym, gated driveway, £8.95m.",
    status: "Alerted", messageId: "MSG-020",
  },
  {
    id: "SIG-021", type: "Buyer Search", location: ["West Hampstead"], postcodes: ["NW6"], budget: "£3.5m",
    propertyType: "House", bedrooms: "-", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "-", feeRequired: "Yes",
    retained: "Yes", agent: "Ok/Vita", platform: "WhatsApp", timestamp: "2026-02-03T20:32:05Z",
    confidence: 0.92, summary: "West Hampstead house search, £3.5m, retained.",
    status: "Matched", messageId: "MSG-021",
  },
  {
    id: "SIG-022", type: "Property for Sale", location: ["Sheldon Avenue, N6"], postcodes: ["N6"], budget: "£11,500,000",
    propertyType: "Detached House", bedrooms: "8", bathrooms: "8", sqft: "9,246", outsideSpace: "Swimming pool, gym/spa",
    parking: "Carriage gated driveway", condition: "Good", feeRequired: "Yes",
    retained: "Unknown", agent: "Daisy Spanbok", platform: "WhatsApp", timestamp: "2026-02-04T13:46:42Z",
    confidence: 0.99, summary: "Sheldon Avenue N6, 8 bed 8 bath, 9,246 sqft, swimming pool, gym/spa, carriage driveway, £11.5m.",
    status: "Alerted", messageId: "MSG-022",
  },
  {
    id: "SIG-023", type: "Buyer Search", location: ["Highgate", "Kenwood"], postcodes: ["N6", "N6"], budget: "£7m+",
    propertyType: "Detached House", bedrooms: "-", bathrooms: "-", sqft: "-", outsideSpace: "Good garden",
    parking: "-", condition: "Good condition or project", feeRequired: "Unknown",
    retained: "Unknown", agent: "Alex Main", platform: "WhatsApp", timestamp: "2026-02-06T07:33:03Z",
    confidence: 0.95, summary: "Motivated family, detached house in Highgate near Kenwood, good garden, £7m+, open to project.",
    status: "Alerted", messageId: "MSG-023",
  },
  {
    id: "SIG-024", type: "Property for Sale", location: ["5 Belsize Place, NW3"], postcodes: ["NW3"], budget: "-",
    propertyType: "House", bedrooms: "-", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "-", feeRequired: "Generous fees",
    retained: "Unknown", agent: "Kevin Dolly", platform: "WhatsApp", timestamp: "2026-02-09T10:35:31Z",
    confidence: 0.88, summary: "Open House at 5 Belsize Place NW3, available off-market for rent or purchase, generous fees.",
    status: "Reviewed", messageId: "MSG-024",
  },
  {
    id: "SIG-025", type: "Buyer Search", location: ["Belsize Park"], postcodes: ["NW3"], budget: "Up to £2m",
    propertyType: "Apartment", bedrooms: "2-3", bathrooms: "-", sqft: "~1,500", outsideSpace: "No LGF",
    parking: "-", condition: "Any", feeRequired: "Unknown",
    retained: "No", agent: "Jack - SDRE", platform: "WhatsApp", timestamp: "2026-02-11T11:40:14Z",
    confidence: 0.94, summary: "2/3 bed apartment in Belsize Park, ~1,500 sqft, up to £2m, no lower ground floor, not retained.",
    status: "New", messageId: "MSG-025",
  },
  {
    id: "SIG-026", type: "Buyer Search", location: ["Hampstead", "Kenwood"], postcodes: ["NW3", "N6"], budget: "Flexible",
    propertyType: "Lateral Apartment", bedrooms: "-", bathrooms: "-", sqft: "2,500+", outsideSpace: "-",
    parking: "-", condition: "Any", feeRequired: "Unknown",
    retained: "Unknown", agent: "Robert Kramer Property Consultancy Ltd.", platform: "WhatsApp", timestamp: "2026-02-16T10:17:55Z",
    confidence: 0.93, summary: "Lateral apartment in Hampstead/Kenwood blocks, 2,500+ sqft, formal dining, minimal steps, not Bishops Avenue.",
    status: "Reviewed", messageId: "MSG-026",
  },
  {
    id: "SIG-027", type: "Buyer Search", location: ["NW3", "Hampstead"], postcodes: ["NW3"], budget: "Up to £5m",
    propertyType: "Lateral Apartment", bedrooms: "-", bathrooms: "-", sqft: "2,000–4,000", outsideSpace: "Small garden",
    parking: "-", condition: "No period conversions", feeRequired: "Unknown",
    retained: "No", agent: "Daisy Spanbok", platform: "WhatsApp", timestamp: "2026-02-17T19:01:46Z",
    confidence: 0.94, summary: "Lateral apartment in NW3, 2,000–4,000 sqft, up to £5m, close to Heath, likes Novel House, not retained.",
    status: "Reviewed", messageId: "MSG-027",
  },
  {
    id: "SIG-028", type: "Buyer Search", location: ["Hampstead", "NW3"], postcodes: ["NW3"], budget: "Up to £8m",
    propertyType: "Any", bedrooms: "-", bathrooms: "-", sqft: "-", outsideSpace: "Room 7x5m min",
    parking: "-", condition: "No major works", feeRequired: "Yes",
    retained: "Yes", agent: "Zoe Green", platform: "WhatsApp", timestamp: "2026-02-18T17:07:01Z",
    confidence: 0.96, summary: "Hampstead/NW3, close to village, period or modern, no major works, up to £8m, retained for off-market.",
    status: "Matched", messageId: "MSG-028",
  },
  {
    id: "SIG-029", type: "Buyer Search", location: ["Dartmouth Park"], postcodes: ["NW5"], budget: "Up to £2.5m",
    propertyType: "Any", bedrooms: "3", bathrooms: "-", sqft: "~1,600", outsideSpace: "-",
    parking: "-", condition: "Good condition", feeRequired: "Yes",
    retained: "Unknown", agent: "Dan Stern", platform: "WhatsApp", timestamp: "2026-02-19T16:48:09Z",
    confidence: 0.95, summary: "Motivated cash buyer, 3 bed in Dartmouth Park, ~1,600 sqft, good condition, up to £2.5m, fee required.",
    status: "New", messageId: "MSG-029",
  },
  {
    id: "SIG-030", type: "Buyer Search", location: ["Highgate", "Kenwood suburbs"], postcodes: ["N6", "N6"], budget: "Up to £12m–£15m",
    propertyType: "House", bedrooms: "6+", bathrooms: "-", sqft: "8,000+", outsideSpace: "Indoor pool, leisure space",
    parking: "-", condition: "Any", feeRequired: "Yes",
    retained: "Unknown", agent: "Daisy Spanbok", platform: "WhatsApp", timestamp: "2026-02-20T14:31:20Z",
    confidence: 0.97, summary: "6+ bed, 8,000+ sqft, Highgate/Kenwood, up to £15m, indoor pool, annex for mother-in-law, fee needed.",
    status: "Alerted", messageId: "MSG-030",
  },
  {
    id: "SIG-031", type: "Buyer Search", location: ["Hampstead"], postcodes: ["NW3"], budget: "~£4m",
    propertyType: "House / Flat", bedrooms: "3-4", bathrooms: "-", sqft: "-", outsideSpace: "South facing garden",
    parking: "-", condition: "Bright, not main road", feeRequired: "Yes",
    retained: "Unknown", agent: "Scott Bennett", platform: "WhatsApp", timestamp: "2026-02-21T12:54:44Z",
    confidence: 0.95, summary: "Currently renting, seeking 3-4 bed in Hampstead, south facing garden, ~£4m, not on main road, fee needed.",
    status: "Alerted", messageId: "MSG-031",
  },
  {
    id: "SIG-032", type: "Tenant Search", location: ["Mill Hill", "Finchley", "Golders Green", "Temple Fortune"], postcodes: ["NW7", "N3", "NW11", "NW11"], budget: "£6,000 pcm",
    propertyType: "House", bedrooms: "3-4", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "Any", feeRequired: "Unknown",
    retained: "Unknown", agent: "Natalie Malka", platform: "WhatsApp", timestamp: "2026-02-23T17:28:31Z",
    confidence: 0.96, summary: "Rental: 3-4 bed house in Mill Hill/Finchley/Golders Green/Temple Fortune, £6k pcm, needed ASAP.",
    status: "New", messageId: "MSG-032",
  },
  {
    id: "SIG-033", type: "Buyer Search", location: ["Hampstead", "Primrose Hill"], postcodes: ["NW3", "NW1"], budget: "£3.5m–£4m",
    propertyType: "House / Garden Flat", bedrooms: "3+", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "Turnkey", feeRequired: "Yes",
    retained: "Unknown", agent: "Scott Bennett", platform: "WhatsApp", timestamp: "2026-02-24T11:30:46Z",
    confidence: 0.97, summary: "Cash buyer, 3+ bed in Hampstead/Primrose Hill, turnkey, off-market, £3.5m–£4m, in London tomorrow.",
    status: "Alerted", messageId: "MSG-033",
  },
  {
    id: "SIG-034", type: "Property for Sale", location: ["21 Regents Park Road, NW1"], postcodes: ["NW1"], budget: "£5,000,000",
    propertyType: "House", bedrooms: "4-5", bathrooms: "-", sqft: "3,396", outsideSpace: "South facing garden",
    parking: "-", condition: "Good condition", feeRequired: "0.5% + £10k neg bonus",
    retained: "Unknown", agent: "Kevin Dolly", platform: "WhatsApp", timestamp: "2026-02-24T13:16:43Z",
    confidence: 0.98, summary: "Price drop: 21 Regents Park Road NW1, 4/5 bed, 3,396 sqft, south facing garden, £5m guide.",
    status: "Alerted", messageId: "MSG-034",
  },
  {
    id: "SIG-035", type: "Property for Sale", location: ["Belsize Park"], postcodes: ["NW3"], budget: "£3,000,000",
    propertyType: "Garden Apartment", bedrooms: "3", bathrooms: "3", sqft: "2,700", outsideSpace: "Large rear garden",
    parking: "-", condition: "Good value", feeRequired: "Unknown",
    retained: "Unknown", agent: "Alex Main", platform: "WhatsApp", timestamp: "2026-02-25T11:40:36Z",
    confidence: 0.97, summary: "Off-market garden apartment in Belsize Park, 3 bed 3 bath, 2,700 sqft, large garden, £3m guide.",
    status: "Alerted", messageId: "MSG-035",
  },
  {
    id: "SIG-036", type: "Buyer Search", location: ["NW3", "NW8", "W9", "South Hampstead"], postcodes: ["NW3", "NW8", "W9", "NW6"], budget: "Up to £5m",
    propertyType: "House / Flat", bedrooms: "4", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "Max 2-3 floors", feeRequired: "Yes",
    retained: "Unknown", agent: "Ok/Vita", platform: "WhatsApp", timestamp: "2026-02-26T14:33:03Z",
    confidence: 0.96, summary: "4 bed over 2/3 floors max, NW3/NW8/W9/South Hampstead, up to £5m, fee required.",
    status: "New", messageId: "MSG-036",
  },
  {
    id: "SIG-037", type: "Buyer Search", location: ["West Hampstead", "Queen's Park", "Kilburn"], postcodes: ["NW6", "NW6", "NW6"], budget: "Up to £1.4m",
    propertyType: "Flat", bedrooms: "2-3", bathrooms: "-", sqft: "-", outsideSpace: "Private garden required",
    parking: "-", condition: "Open to works if cheaper", feeRequired: "Yes",
    retained: "No", agent: "Sam Buckwald", platform: "WhatsApp", timestamp: "2026-02-26T16:18:37Z",
    confidence: 0.94, summary: "2/3 bed flat with private garden, West Hampstead/Queen's Park/Kilburn, up to £1.4m, not retained, fee needed.",
    status: "New", messageId: "MSG-037",
  },
  {
    id: "SIG-038", type: "Tenant Search", location: ["Hampstead"], postcodes: ["NW3"], budget: "£4,500 pcm",
    propertyType: "Any", bedrooms: "-", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "Decent condition", feeRequired: "No",
    retained: "Unknown", agent: "Orly Lehman", platform: "WhatsApp", timestamp: "2026-03-02T08:33:04Z",
    confidence: 0.94, summary: "Rental: Hampstead or surrounding, £4,500 pcm, decent condition, lady living alone, ~6 months, no fee needed.",
    status: "New", messageId: "MSG-042",
  },
  {
    id: "SIG-039", type: "Property for Sale", location: ["48c Netherhall Gardens, NW3"], postcodes: ["NW3"], budget: "£5,950,000",
    propertyType: "House", bedrooms: "4-5", bathrooms: "-", sqft: "3,990", outsideSpace: "Private terrace",
    parking: "Gated off-street", condition: "Turnkey", feeRequired: "0.5% split + £7.5k neg bonus",
    retained: "Unknown", agent: "Kevin Dolly", platform: "WhatsApp", timestamp: "2026-03-04T11:50:22Z",
    confidence: 0.98, summary: "48c Netherhall Gardens NW3, 4/5 bed, 3,990 sqft, turnkey, gated parking, terrace, £5.95m.",
    status: "Alerted", messageId: "MSG-043",
  },
  {
    id: "SIG-040", type: "Property for Sale", location: ["71 Redington Road, NW3"], postcodes: ["NW3"], budget: "-",
    propertyType: "House", bedrooms: "-", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "-", feeRequired: "0.5% + £10k neg bonus",
    retained: "Unknown", agent: "Kevin Dolly", platform: "WhatsApp", timestamp: "2026-03-05T13:02:58Z",
    confidence: 0.92, summary: "Agent Open House at 71 Redington Road NW3, 12 March, 0.5% fee + £10k negotiator bonus.",
    status: "Reviewed", messageId: "MSG-044",
  },
  {
    id: "SIG-041", type: "Buyer Search", location: ["NW3"], postcodes: ["NW3"], budget: "Up to £4m",
    propertyType: "House / Maisonette", bedrooms: "-", bathrooms: "-", sqft: "-", outsideSpace: "-",
    parking: "-", condition: "Any", feeRequired: "Unknown",
    retained: "Unknown", agent: "Zoe Green", platform: "WhatsApp", timestamp: "2026-03-06T09:15:30Z",
    confidence: 0.93, summary: "Off-market houses or maisonettes in NW3, up to £4m, cash buyer.",
    status: "New", messageId: "MSG-045",
  },
  {
    id: "SIG-042", type: "Tenant Search", location: ["Bishops Avenue", "Highgate"], postcodes: ["N2", "N6"], budget: "Up to £25,000 pcm",
    propertyType: "House with pool", bedrooms: "-", bathrooms: "-", sqft: "-", outsideSpace: "Pool required",
    parking: "-", condition: "Any", feeRequired: "Yes",
    retained: "Unknown", agent: "Ok/Vita", platform: "WhatsApp", timestamp: "2026-03-10T10:51:56Z",
    confidence: 0.94, summary: "Rental: house near Bishops Ave/Highgate with pool, up to £25k pcm, fee required.",
    status: "New", messageId: "MSG-046",
  },
  {
    id: "SIG-043", type: "Buyer Search", location: ["Hampstead Garden Suburb"], postcodes: ["NW11"], budget: "~£2.6m–£2.7m",
    propertyType: "House", bedrooms: "-", bathrooms: "-", sqft: "2,500–2,600", outsideSpace: "South facing",
    parking: "-", condition: "Unmodernised, refurbishment", feeRequired: "Yes",
    retained: "Unknown", agent: "Josh C", platform: "WhatsApp", timestamp: "2026-03-12T10:36:08Z",
    confidence: 0.95, summary: "South facing house in HGS, unmodernised, 2,500–2,600 sqft with extension potential, ~£2.6m–£2.7m, fees needed.",
    status: "New", messageId: "MSG-047",
  },
  {
    id: "SIG-044", type: "Buyer Search", location: ["South Hampstead", "West Hampstead"], postcodes: ["NW6", "NW6"], budget: "£2m–£4m",
    propertyType: "Garden Flat / House", bedrooms: "4+", bathrooms: "-", sqft: "-", outsideSpace: "Garden",
    parking: "-", condition: "Turnkey preferred", feeRequired: "Unknown",
    retained: "Unknown", agent: "Jonathan Singer", platform: "WhatsApp", timestamp: "2026-03-12T14:56:50Z",
    confidence: 0.96, summary: "4+ bed garden flats and houses in South/West Hampstead, £2m–£4m, turnkey preferred.",
    status: "New", messageId: "MSG-048",
  },
  {
    id: "SIG-045", type: "Buyer Search", location: ["Belsize Park"], postcodes: ["NW3"], budget: "Up to £1.2m",
    propertyType: "Any", bedrooms: "2+", bathrooms: "-", sqft: "-", outsideSpace: "Must have",
    parking: "-", condition: "Open to cosmetic work", feeRequired: "Yes",
    retained: "Yes", agent: "Kevin Dolly", platform: "WhatsApp", timestamp: "2026-03-12T16:09:02Z",
    confidence: 0.97, summary: "Retained hot cash buyer, 2+ bed in Belsize Park, outdoor space essential, up to £1.2m, open to cosmetic work.",
    status: "Matched", messageId: "MSG-049",
  },
  {
    id: "SIG-046", type: "Buyer Search", location: ["Belsize Park", "Primrose Hill"], postcodes: ["NW3", "NW1"], budget: "Up to £4m",
    propertyType: "House / Garden Flat / Penthouse", bedrooms: "3+", bathrooms: "-", sqft: "-", outsideSpace: "Outside space",
    parking: "-", condition: "Any", feeRequired: "Yes",
    retained: "Unknown", agent: "Scott Bennett", platform: "WhatsApp", timestamp: "2026-03-13T11:48:38Z",
    confidence: 0.96, summary: "3+ bed in Belsize Park/Primrose Hill, house over 3 floors, garden flat or penthouse, up to £4m, fee needed.",
    status: "New", messageId: "MSG-050",
  },
  {
    id: "SIG-047", type: "Buyer Search", location: ["Hampstead"], postcodes: ["NW3"], budget: "£4m–£6m",
    propertyType: "House", bedrooms: "-", bathrooms: "-", sqft: "-", outsideSpace: "Near Heath",
    parking: "-", condition: "Any", feeRequired: "Unknown",
    retained: "Unknown", agent: "Natalie Malka", platform: "WhatsApp", timestamp: "2026-03-13T14:25:26Z",
    confidence: 0.93, summary: "Houses right by the Heath in Hampstead, £4m–£6m, the closer to Heath the better.",
    status: "New", messageId: "MSG-051",
  },
  {
    id: "SIG-048", type: "Buyer Search", location: ["NW3"], postcodes: ["NW3"], budget: "£4m–£7m",
    propertyType: "Any", bedrooms: "-", bathrooms: "-", sqft: "2,300+", outsideSpace: "Character/special",
    parking: "-", condition: "Projects only", feeRequired: "Yes",
    retained: "Yes", agent: "Zoe Green", platform: "WhatsApp", timestamp: "2026-02-28T08:23:04Z",
    confidence: 0.96, summary: "Two retained buyers, NW3, minimum 2,300 sqft, must have character, projects only, £4m–£7m.",
    status: "Matched", messageId: "MSG-041",
  },
];

// ============================================================
// ALERTS — generated from signal matching
// ============================================================

export const alerts: Alert[] = [
  { id: "ALT-001", recipientAgent: "Jonathan Singer", matchingArea: "Hampstead", signalType: "Buyer Search", summary: "Hot buyer, 3+ bed, up to £3.3m, garden essential", originatingAgent: "Scott Bennett", timestamp: "2026-01-02T10:05:00Z", priority: "High" },
  { id: "ALT-002", recipientAgent: "Zoe Green", matchingArea: "Belsize Park", signalType: "Buyer Search", summary: "3+ bed, up to £4m, garden required, multiple areas", originatingAgent: "Scott Bennett", timestamp: "2026-01-02T21:50:00Z", priority: "High" },
  { id: "ALT-003", recipientAgent: "Kevin Dolly", matchingArea: "Primrose Hill", signalType: "Buyer Search", summary: "2+ bed turnkey, up to £2.5m, off-market only", originatingAgent: "Lauren Christy", timestamp: "2026-01-05T14:00:00Z", priority: "Medium" },
  { id: "ALT-004", recipientAgent: "Scott Bennett", matchingArea: "Hampstead", signalType: "Property for Sale", summary: "Redington Road NW3, 3 bed, £1.55m, fees available", originatingAgent: "Jonathan Singer", timestamp: "2026-01-08T13:00:00Z", priority: "High" },
  { id: "ALT-005", recipientAgent: "Dan Stern", matchingArea: "Highgate", signalType: "Buyer Search", summary: "Cash buyer £5m, 5+ bed, Kenwood/Highgate/Hampstead", originatingAgent: "Dan Stern", timestamp: "2026-01-09T16:45:00Z", priority: "High" },
  { id: "ALT-006", recipientAgent: "Daisy Spanbok", matchingArea: "Hampstead Garden Suburb", signalType: "Buyer Search", summary: "4/5 bed house, south side HGS, £2.5m–£3.2m", originatingAgent: "Katie Gee", timestamp: "2026-01-12T13:45:00Z", priority: "Medium" },
  { id: "ALT-007", recipientAgent: "Alex Main", matchingArea: "Hampstead", signalType: "Buyer Search", summary: "Cash buyer up to £15m, 7,000+ sqft, turnkey", originatingAgent: "Adam Newman", timestamp: "2026-01-12T14:05:00Z", priority: "High" },
  { id: "ALT-008", recipientAgent: "Jamie Gallagher ADN", matchingArea: "NW3", signalType: "Buyer Search", summary: "5+ bed freehold, 3,000+ sqft, up to £5.5m", originatingAgent: "Jamie Gallagher ADN", timestamp: "2026-01-15T12:05:00Z", priority: "High" },
  { id: "ALT-009", recipientAgent: "Zoe Green", matchingArea: "Hampstead", signalType: "Buyer Search", summary: "Budget increased to £6m, turnkey only, retained", originatingAgent: "Simon Dean Private", timestamp: "2026-01-22T16:40:00Z", priority: "High" },
  { id: "ALT-010", recipientAgent: "Dan Stern", matchingArea: "Primrose Hill", signalType: "Buyer Search", summary: "Hot cash buyer, up to £13m, 3,000–5,000 sqft, turnkey", originatingAgent: "Kevin Dolly", timestamp: "2026-01-27T16:10:00Z", priority: "High" },
  { id: "ALT-011", recipientAgent: "Scott Bennett", matchingArea: "Sheldon Avenue", signalType: "Property for Sale", summary: "7 bed, 6,228 sqft, outdoor pool, £8.95m", originatingAgent: "Dan Stern", timestamp: "2026-01-29T10:35:00Z", priority: "Medium" },
  { id: "ALT-012", recipientAgent: "Kevin Dolly", matchingArea: "Highgate", signalType: "Buyer Search", summary: "Detached house, £7m+, good garden, near Kenwood", originatingAgent: "Alex Main", timestamp: "2026-02-06T07:40:00Z", priority: "High" },
  { id: "ALT-013", recipientAgent: "Daisy Spanbok", matchingArea: "Highgate", signalType: "Buyer Search", summary: "6+ bed, 8,000+ sqft, up to £15m, indoor pool", originatingAgent: "Daisy Spanbok", timestamp: "2026-02-20T14:40:00Z", priority: "High" },
  { id: "ALT-014", recipientAgent: "Jonathan Singer", matchingArea: "Hampstead", signalType: "Buyer Search", summary: "3-4 bed, south facing garden, ~£4m, not main road", originatingAgent: "Scott Bennett", timestamp: "2026-02-21T13:00:00Z", priority: "Medium" },
  { id: "ALT-015", recipientAgent: "Zoe Green", matchingArea: "NW3", signalType: "Buyer Search", summary: "Two retained buyers, 2,300+ sqft, projects only, £4m–£7m", originatingAgent: "Zoe Green", timestamp: "2026-02-28T08:30:00Z", priority: "High" },
  { id: "ALT-016", recipientAgent: "Alex Main", matchingArea: "Belsize Park", signalType: "Property for Sale", summary: "Netherhall Gardens, 4/5 bed, 3,990 sqft, £5.95m", originatingAgent: "Kevin Dolly", timestamp: "2026-03-04T12:00:00Z", priority: "Medium" },
  { id: "ALT-017", recipientAgent: "Scott Bennett", matchingArea: "Belsize Park", signalType: "Buyer Search", summary: "Retained hot buyer, 2+ bed, up to £1.2m, outdoor space", originatingAgent: "Kevin Dolly", timestamp: "2026-03-12T16:15:00Z", priority: "High" },
  { id: "ALT-018", recipientAgent: "Kevin Dolly", matchingArea: "Hampstead", signalType: "Buyer Search", summary: "Houses by the Heath, £4m–£6m", originatingAgent: "Natalie Malka", timestamp: "2026-03-13T14:30:00Z", priority: "Medium" },
];

// ============================================================
// AGENT PROFILES
// ============================================================

export const agentProfiles: AgentProfile[] = [
  { name: "Scott Bennett", areas: ["Hampstead", "Belsize Park", "Primrose Hill", "South Hampstead"], signalCount: 8 },
  { name: "Dan Stern", areas: ["Highgate", "Kenwood", "Hampstead", "Dartmouth Park"], signalCount: 4 },
  { name: "Daisy Spanbok", areas: ["Hampstead", "NW3", "Highgate", "Kenwood"], signalCount: 5 },
  { name: "Kevin Dolly", areas: ["Primrose Hill", "Belsize Park", "NW3", "Hampstead"], signalCount: 6 },
  { name: "Zoe Green", areas: ["Hampstead", "NW3", "Belsize Avenue"], signalCount: 5 },
  { name: "Jonathan Singer", areas: ["NW3", "St John's Wood", "South Hampstead"], signalCount: 4 },
  { name: "Jamie Gallagher ADN", areas: ["NW3", "Tufnell Park", "Kentish Town"], signalCount: 2 },
  { name: "Natalie Malka", areas: ["Marylebone", "Mill Hill", "Hampstead", "Golders Green"], signalCount: 3 },
  { name: "Lauren Christy", areas: ["Hampstead", "Primrose Hill", "St John's Wood"], signalCount: 1 },
  { name: "Alex Main", areas: ["Highgate", "Kenwood", "Belsize Park"], signalCount: 2 },
  { name: "Ok/Vita", areas: ["West Hampstead", "NW3", "NW8", "Highgate"], signalCount: 3 },
  { name: "Katie Gee", areas: ["Hampstead Garden Suburb"], signalCount: 1 },
  { name: "Adam Newman", areas: ["Hampstead", "Hampstead Garden Suburb"], signalCount: 1 },
  { name: "Simon Dean Private", areas: ["Hampstead", "Highgate"], signalCount: 1 },
  { name: "Jack - SDRE", areas: ["Belsize Park"], signalCount: 1 },
  { name: "Robert Kramer Property Consultancy Ltd.", areas: ["Hampstead", "Kenwood"], signalCount: 1 },
  { name: "Sam Buckwald", areas: ["West Hampstead", "Queen's Park", "Kilburn"], signalCount: 1 },
  { name: "Orly Lehman", areas: ["Hampstead"], signalCount: 1 },
  { name: "Josh C", areas: ["Hampstead Garden Suburb"], signalCount: 1 },
  { name: "Nouri @ Henry Alexander x Vita Properties", areas: ["Hampstead", "Belsize Park", "Primrose Hill"], signalCount: 1 },
  { name: "Jake", areas: ["NW3"], signalCount: 1 },
];

// ============================================================
// COMPUTED STATS
// ============================================================

export function getKPIs() {
  const totalMessages = rawMessages.length;
  const actionableSignals = signals.length;
  const buyerSearches = signals.filter(s => s.type === "Buyer Search").length;
  const tenantSearches = signals.filter(s => s.type === "Tenant Search").length;
  const sellerSignals = signals.filter(s => s.type === "Seller Signal").length;
  const landlordSignals = signals.filter(s => s.type === "Landlord Signal").length;
  const propertiesForSale = signals.filter(s => s.type === "Property for Sale").length;
  const propertiesForRent = signals.filter(s => s.type === "Property for Rent").length;
  const serviceRequests = signals.filter(s => s.type === "Service Request").length;
  const alertsSent = alerts.length;
  const highPriorityMatches = alerts.filter(a => a.priority === "High").length;

  return {
    totalMessages,
    actionableSignals,
    buyerSearches,
    tenantSearches,
    sellerSignals,
    landlordSignals,
    propertiesForSale,
    propertiesForRent,
    serviceRequests,
    alertsSent,
    highPriorityMatches,
  };
}

export function getAreaStats() {
  const areaMap: Record<string, { buyers: number; tenants: number; sales: number; rentals: number }> = {};

  signals.forEach(s => {
    s.location.forEach(loc => {
      if (!areaMap[loc]) areaMap[loc] = { buyers: 0, tenants: 0, sales: 0, rentals: 0 };
      if (s.type === "Buyer Search") areaMap[loc].buyers++;
      if (s.type === "Tenant Search") areaMap[loc].tenants++;
      if (s.type === "Property for Sale") areaMap[loc].sales++;
      if (s.type === "Property for Rent") areaMap[loc].rentals++;
    });
  });

  return Object.entries(areaMap)
    .map(([area, stats]) => ({ area, ...stats, total: stats.buyers + stats.tenants + stats.sales + stats.rentals }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Parse a budget string into a numeric GBP value.
 * Handles: £3.3m, £2.5m, Up to 2.5 (inferred millions), £9k, £9,000 pcm,
 * £1,550,000, 25k, bare numbers like "1.5" or "2.5" in property context.
 */
export function parseBudgetToNumber(budget: string): number | null {
  if (!budget || budget === "-" || budget === "\u2014" || budget.toLowerCase() === "flexible") return null;
  // Skip pcm (per calendar month) rental values for sale-price distributions
  if (budget.toLowerCase().includes("pcm")) return null;

  const cleaned = budget.replace(/,/g, "").replace(/\u00a3/g, "");
  // Find all numeric values
  const nums = cleaned.match(/[\d.]+/g);
  if (!nums) return null;

  // Use the last number (usually the upper bound in ranges like "2.5m\u20133.2m")
  const raw = parseFloat(nums[nums.length - 1]);
  if (isNaN(raw)) return null;

  // Determine multiplier
  const lc = budget.toLowerCase();
  if (lc.includes("k")) {
    return raw * 1000;
  }
  if (lc.includes("m")) {
    return raw * 1000000;
  }
  // If the number is >= 100000, it's likely already in pounds (e.g. 1,550,000)
  if (raw >= 100000) {
    return raw;
  }
  // Bare numbers under 100 in property context are almost certainly millions
  // e.g. "Up to 2.5" or "Budget upto 1.5" = \u00a32.5m / \u00a31.5m
  if (raw < 100) {
    return raw * 1000000;
  }
  // Numbers between 100 and 100000 are ambiguous, treat as thousands
  return raw * 1000;
}

export function getBudgetDistribution() {
  const ranges = [
    { label: "Under \u00a32m", min: 0, max: 2000000, count: 0 },
    { label: "\u00a32m\u2013\u00a34m", min: 2000000, max: 4000000, count: 0 },
    { label: "\u00a34m\u2013\u00a36m", min: 4000000, max: 6000000, count: 0 },
    { label: "\u00a36m\u2013\u00a310m", min: 6000000, max: 10000000, count: 0 },
    { label: "\u00a310m+", min: 10000000, max: Infinity, count: 0 },
  ];

  signals.forEach(s => {
    const numVal = parseBudgetToNumber(s.budget);
    if (numVal && numVal > 0) {
      const range = ranges.find(r => numVal >= r.min && numVal < r.max);
      if (range) range.count++;
    }
  });

  return ranges;
}

export function getBedroomDistribution() {
  const counts: Record<string, number> = { "2": 0, "3": 0, "4": 0, "5": 0, "6+": 0, "Unspecified": 0 };

  signals.forEach(s => {
    if (s.type === "Property for Sale" || s.type === "Property for Rent" || s.type === "Buyer Search" || s.type === "Tenant Search") {
      const bed = s.bedrooms;
      if (bed === "-" || bed === "") counts["Unspecified"]++;
      else if (bed.includes("6") || bed.includes("7") || bed.includes("8")) counts["6+"]++;
      else if (bed.includes("5")) counts["5"]++;
      else if (bed.includes("4")) counts["4"]++;
      else if (bed.includes("3")) counts["3"]++;
      else if (bed.includes("2")) counts["2"]++;
      else counts["Unspecified"]++;
    }
  });

  return Object.entries(counts).map(([beds, count]) => ({ beds, count }));
}

export function getPropertyTypeDistribution() {
  const types: Record<string, number> = {};

  signals.forEach(s => {
    const t = s.propertyType;
    if (t && t !== "-") {
      types[t] = (types[t] || 0) + 1;
    }
  });

  return Object.entries(types)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// Human review queue items
export interface ReviewItem {
  id: string;
  rawMessage: string;
  suggestedClassification: SignalType;
  reasonFlagged: string;
  confidence: number;
  reviewer: string;
  status: "Pending" | "Approved" | "Rejected";
}

export const reviewQueue: ReviewItem[] = [
  {
    id: "REV-001",
    rawMessage: "Does anyone have anything to rent in Milbrook Court? Or anything for sale that will rent there.",
    suggestedClassification: "Tenant Search",
    reasonFlagged: "Ambiguous intent — could be investor search or tenant search",
    confidence: 0.82,
    reviewer: "Unassigned",
    status: "Pending",
  },
  {
    id: "REV-002",
    rawMessage: "You're invited to our Open House this Thursday at 5 Belsize Place, NW3. Property is available off market for rent or purchase with generous fees offered.",
    suggestedClassification: "Property for Sale",
    reasonFlagged: "Dual intent — property available for both rent and purchase",
    confidence: 0.88,
    reviewer: "Unassigned",
    status: "Pending",
  },
  {
    id: "REV-003",
    rawMessage: "It's going to make the Finchley Rd even worse than it is now!",
    suggestedClassification: "Irrelevant",
    reasonFlagged: "Could contain local market intelligence about infrastructure",
    confidence: 0.91,
    reviewer: "Unassigned",
    status: "Pending",
  },
  {
    id: "REV-004",
    rawMessage: "I am buying a bin lorry",
    suggestedClassification: "Social",
    reasonFlagged: "Low confidence — could be sarcasm or genuine off-topic",
    confidence: 0.95,
    reviewer: "Unassigned",
    status: "Pending",
  },
];

// Watchlist data
export interface Watchlist {
  id: string;
  name: string;
  areas: string[];
  signalTypes: SignalType[];
  matchCount: number;
}

export const watchlists: Watchlist[] = [
  { id: "WL-001", name: "Hampstead Premium", areas: ["Hampstead", "NW3"], signalTypes: ["Buyer Search", "Property for Sale"], matchCount: 22 },
  { id: "WL-002", name: "Highgate & Kenwood", areas: ["Highgate", "Kenwood"], signalTypes: ["Buyer Search", "Property for Sale"], matchCount: 8 },
  { id: "WL-003", name: "Belsize Park Activity", areas: ["Belsize Park", "Belsize Avenue"], signalTypes: ["Buyer Search", "Property for Sale", "Tenant Search"], matchCount: 12 },
  { id: "WL-004", name: "Primrose Hill Watch", areas: ["Primrose Hill"], signalTypes: ["Buyer Search", "Property for Sale"], matchCount: 7 },
  { id: "WL-005", name: "Rental Market NW", areas: ["Marylebone", "Mill Hill", "Hampstead"], signalTypes: ["Tenant Search", "Property for Rent"], matchCount: 5 },
];
