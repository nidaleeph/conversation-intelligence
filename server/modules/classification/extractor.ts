export interface ExtractedFields {
  location: string[];
  postcodes: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  outsideSpace: boolean | null;
  parking: boolean | null;
  condition: string | null;
}

const KNOWN_LOCATIONS = [
  "Hampstead", "Belsize Park", "Primrose Hill", "Highgate",
  "St John's Wood", "Kenwood", "West Hampstead", "South Hampstead",
  "Hampstead Garden Suburb", "Dartmouth Park", "Marylebone",
  "Swiss Cottage", "Tufnell Park", "Kentish Town", "Gospel Oak",
  "Parliament Hill", "Maida Vale", "Little Venice", "Kilburn",
  "Cricklewood", "Golders Green", "Finchley", "Muswell Hill",
  "Crouch End", "Archway", "Islington", "Camden", "Regent's Park",
];

const POSTCODE_PATTERN = /\b(NW[0-9]{1,2}|N[0-9]{1,2}|W[0-9]{1,2}|WC[0-9]{1,2}|EC[0-9]{1,2}|SW[0-9]{1,2}|SE[0-9]{1,2}|E[0-9]{1,2})\b/gi;

export function extractFields(rawText: string): ExtractedFields {
  const text = rawText;

  let budgetMin: number | null = null;
  let budgetMax: number | null = null;

  // £9k a month / pcm (check BEFORE general patterns)
  const pcmMatch = text.match(/£([\d.]+)\s*k?\s*(?:a month|per month|pcm|per calendar month|pw|per week)/i);
  if (pcmMatch) {
    let val = parseFloat(pcmMatch[1]);
    if (/£[\d.]+\s*k\s*(?:a month|per month|pcm)/i.test(text)) {
      val *= 1000;
    }
    budgetMax = Math.round(val);
  }

  if (!budgetMax) {
    // £3.3m, £2.5m
    const millionMatch = text.match(/£([\d.]+)\s*m\b/i);
    if (millionMatch) {
      budgetMax = Math.round(parseFloat(millionMatch[1]) * 1_000_000);
    }

    // £550k
    if (!budgetMax) {
      const thousandMatch = text.match(/£([\d.]+)\s*k\b/i);
      if (thousandMatch) {
        budgetMax = Math.round(parseFloat(thousandMatch[1]) * 1_000);
      }
    }

    // £1,550,000
    if (!budgetMax) {
      const fullPriceMatch = text.match(/£([\d,]+)(?!\s*[mk])\b/);
      if (fullPriceMatch) {
        const val = parseInt(fullPriceMatch[1].replace(/,/g, ""), 10);
        if (val > 1000) {
          budgetMax = val;
        }
      }
    }
  }

  let bedrooms: number | null = null;
  const bedMatch = text.match(/(\d+)\s*(?:bed(?:room)?s?)\b/i);
  if (bedMatch) bedrooms = parseInt(bedMatch[1], 10);

  let bathrooms: number | null = null;
  const bathMatch = text.match(/(\d+)\s*(?:bath(?:room)?s?)\b/i);
  if (bathMatch) bathrooms = parseInt(bathMatch[1], 10);

  let sqft: number | null = null;
  const sqftMatch = text.match(/([\d,]+)\s*(?:sq\s*ft|sqft|square feet)/i);
  if (sqftMatch) sqft = parseInt(sqftMatch[1].replace(/,/g, ""), 10);

  const location: string[] = [];
  for (const loc of KNOWN_LOCATIONS) {
    if (text.toLowerCase().includes(loc.toLowerCase())) {
      location.push(loc);
    }
  }

  const postcodeMatches = text.match(POSTCODE_PATTERN);
  const postcodes = postcodeMatches
    ? Array.from(new Set(postcodeMatches.map((p) => p.toUpperCase())))
    : [];

  let propertyType: string | null = null;
  if (/\b(house|townhouse|town house|semi-detached|detached|terraced|freehold)\b/i.test(text)) {
    propertyType = "House";
  } else if (/\b(flat|apartment|maisonette|penthouse|studio)\b/i.test(text)) {
    propertyType = "Flat";
  } else if (/\b(mansion|manor|estate)\b/i.test(text)) {
    propertyType = "Mansion";
  }

  const outsideSpace = /\b(garden|outside space|terrace|balcony|patio|roof terrace)\b/i.test(text) ? true : null;
  const parking = /\b(parking|garage|off-street|driveway)\b/i.test(text) ? true : null;

  let condition: string | null = null;
  if (/\b(turnkey|move[- ]in ready|immaculate)\b/i.test(text)) condition = "Turnkey";
  else if (/\b(needs work|renovation|refurb|project|doer[- ]upper)\b/i.test(text)) condition = "Needs Work";
  else if (/\b(new build|newly built)\b/i.test(text)) condition = "New Build";

  return { location, postcodes, budgetMin, budgetMax, propertyType, bedrooms, bathrooms, sqft, outsideSpace, parking, condition };
}
