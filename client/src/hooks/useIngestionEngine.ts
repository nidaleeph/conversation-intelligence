// ============================================================
// DDRE War Room — Ingestion Simulation Engine
// Simulates real-time WhatsApp message arrival, auto-classification,
// and signal extraction with configurable speed.
// Uses refs for mutable state to avoid re-render cascades.
// ============================================================

import { useState, useCallback, useRef, useEffect } from "react";
import type { SignalType } from "@shared/types";

// Simulation-only types (not used by real API)
interface RawMessage {
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

interface Signal {
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
  status: "New" | "Reviewed" | "Alerted" | "Matched";
  messageId: string;
}

export type IngestionPhase = "idle" | "receiving" | "classifying" | "extracting" | "complete";

export interface IngestedMessage {
  id: string;
  message: RawMessage;
  signal: Signal | null;
  phase: IngestionPhase;
  ingestedAt: number;
  classifiedAt: number | null;
  extractedAt: number | null;
}

export interface IngestionStats {
  totalIngested: number;
  totalClassified: number;
  totalExtracted: number;
  totalActionable: number;
  totalNonActionable: number;
  avgClassificationTime: number;
  avgExtractionTime: number;
  messagesPerMinute: number;
  isRunning: boolean;
  speed: number;
}

const simulatedNewMessages: Omit<RawMessage, "id">[] = [
  { timestamp: "", sender: "Scott Bennett", platform: "WhatsApp", rawText: "New buyer just landed. Cash. Looking for a 3 bed house in Hampstead Village. Must be walking distance to the Heath. Budget up to £5m. Turnkey only. Need a fee.", classification: "Buyer Search", confidence: 0.97, actionable: true, retained: "Unknown" },
  { timestamp: "", sender: "Kevin Dolly", platform: "WhatsApp", rawText: "Just listed. 52 Fitzjohn's Avenue, NW3. 5 bed, 4 bath, 3,800 sqft. Period conversion with garden. Guide £4.75m. 0.5% fee + £7,500 neg bonus.", classification: "Property for Sale", confidence: 0.98, actionable: true, retained: "Unknown" },
  { timestamp: "", sender: "Zoe Green", platform: "WhatsApp", rawText: "Urgent rental needed. Family relocating from Dubai. 4 bed house, Hampstead or Highgate. Up to £8k per week. Furnished. Available immediately. Fee offered.", classification: "Tenant Search", confidence: 0.96, actionable: true, retained: "Unknown" },
  { timestamp: "", sender: "Dan Stern", platform: "WhatsApp", rawText: "Back to back viewings today on Sheldon Avenue. Three serious offers expected by Friday. Market is moving fast in N6.", classification: "Market Commentary", confidence: 0.89, actionable: false, retained: "Unknown" },
  { timestamp: "", sender: "Daisy Spanbok", platform: "WhatsApp", rawText: "Retained buyer. Budget just increased to £9m. Must be detached. Minimum 5,000 sqft. Pool or space for one. Bishops Avenue or The Bishops area. Will pay 1% fee.", classification: "Buyer Search", confidence: 0.98, actionable: true, retained: "Yes" },
  { timestamp: "", sender: "Jonathan Singer", platform: "WhatsApp", rawText: "Price reduction. Platts Lane, NW3. Now £2,850,000. 4 bed semi. 2,400 sqft. South facing garden. Good condition throughout. Motivated vendor.", classification: "Property for Sale", confidence: 0.97, actionable: true, retained: "Unknown" },
  { timestamp: "", sender: "Alex Main", platform: "WhatsApp", rawText: "Does anyone have a recommendation for a good structural engineer in the Highgate area? Client needs one for a basement extension project.", classification: "Service Request", confidence: 0.91, actionable: true, retained: "Unknown" },
  { timestamp: "", sender: "Natalie Malka", platform: "WhatsApp", rawText: "New search. Young professional couple. 2 bed flat with balcony or terrace. South Hampstead or West Hampstead. Up to £850k. First-time buyers. Need a fee.", classification: "Buyer Search", confidence: 0.95, actionable: true, retained: "Unknown" },
  { timestamp: "", sender: "Ok/Vita", platform: "WhatsApp", rawText: "Seller instruction. Off-market. Lyndhurst Gardens, NW3. 6 bed Victorian house. 4,500 sqft. Needs full refurbishment. Guide £6.5m. 1% fee.", classification: "Property for Sale", confidence: 0.97, actionable: true, retained: "Unknown" },
  { timestamp: "", sender: "Jamie Gallagher ADN", platform: "WhatsApp", rawText: "Anyone free for a coffee at Ginger & White tomorrow morning? Need to discuss a few deals.", classification: "Social", confidence: 0.93, actionable: false, retained: "Unknown" },
  { timestamp: "", sender: "Sam Buckwald", platform: "WhatsApp", rawText: "Buyer search. Family downsizing from large house. Want a lateral flat, minimum 1,800 sqft. Must have lift. Hampstead or St John's Wood. Up to £3.5m. Cash.", classification: "Buyer Search", confidence: 0.96, actionable: true, retained: "Unknown" },
  { timestamp: "", sender: "Kevin Dolly", platform: "WhatsApp", rawText: "Exchange confirmed on Netherhall Gardens. £5.7m. Completed in 6 weeks. Buyer came through the network. This is why we share.", classification: "Market Commentary", confidence: 0.88, actionable: false, retained: "Unknown" },
  { timestamp: "", sender: "Orly Lehman", platform: "WhatsApp", rawText: "Tenant search. Corporate let. 3 bed apartment in NW3 or NW8. Must have concierge and parking. Up to £5,000 per week. 12-month lease minimum. Fee required.", classification: "Tenant Search", confidence: 0.96, actionable: true, retained: "Unknown" },
  { timestamp: "", sender: "Josh C", platform: "WhatsApp", rawText: "New instruction coming next week. Wildwood Road, NW11. 5 bed detached. 3,200 sqft. Large plot. Needs modernisation. Guide around £3.8m. Will offer 0.5% + bonus.", classification: "Property for Sale", confidence: 0.96, actionable: true, retained: "Unknown" },
  { timestamp: "", sender: "Scott Bennett", platform: "WhatsApp", rawText: "Heads up — hearing rumours of a major development application on Finchley Road near Swiss Cottage. Could affect values in the area. Will share more when I know.", classification: "Market Commentary", confidence: 0.87, actionable: false, retained: "Unknown" },
  { timestamp: "", sender: "Robert Kramer Property Consultancy Ltd.", platform: "WhatsApp", rawText: "Retained buyer. International family. Budget £20m+. Must be one of the best houses in Hampstead. Minimum 8,000 sqft. Pool essential. Complete privacy. Will pay 1.5% fee.", classification: "Buyer Search", confidence: 0.99, actionable: true, retained: "Yes" },
  { timestamp: "", sender: "Lauren Christy", platform: "WhatsApp", rawText: "New search. Couple with two young children. 4 bed house with garden. Primrose Hill or Regent's Park area. Up to £6m. Turnkey. School catchment important. Fee required.", classification: "Buyer Search", confidence: 0.96, actionable: true, retained: "Unknown" },
  { timestamp: "", sender: "Katie Gee", platform: "WhatsApp", rawText: "Anyone know if the house on Winnington Road that was under offer has fallen through? My buyer would be very interested if it's back on.", classification: "Buyer Search", confidence: 0.82, actionable: true, retained: "Unknown" },
  { timestamp: "", sender: "Jack - SDRE", platform: "WhatsApp", rawText: "Rental listing. Belsize Crescent, NW3. 2 bed garden flat. 1,100 sqft. Beautifully renovated. Available now. £3,500 per week. Fee: 10% of annual rent.", classification: "Property for Rent", confidence: 0.97, actionable: true, retained: "Unknown" },
  { timestamp: "", sender: "Nouri @ Henry Alexander x Vita Properties", platform: "WhatsApp", rawText: "Super motivated buyer. Chain free. 3 bed minimum. Must have parking. Belsize Park or South Hampstead. Up to £3m. Will move fast for the right property. Fee needed.", classification: "Buyer Search", confidence: 0.97, actionable: true, retained: "Unknown" },
];

function generateSignalFromMessage(msg: RawMessage, id: string): Signal | null {
  if (!msg.actionable) return null;

  const areaPostcodeMap: Record<string, string> = {
    "Hampstead": "NW3", "Belsize Park": "NW3", "Primrose Hill": "NW1",
    "NW3": "NW3", "Highgate": "N6", "St John's Wood": "NW8",
    "Kenwood": "N6", "South Hampstead": "NW6", "West Hampstead": "NW6",
    "Bishops Avenue": "N2", "Regent's Park": "NW1", "NW8": "NW8",
    "NW11": "NW11", "Hampstead Garden Suburb": "NW11",
    "Dartmouth Park": "NW5", "Marylebone": "W1", "Tufnell Park": "N7",
    "Kentish Town": "NW5", "Kilburn": "NW6", "Queen's Park": "NW6",
    "Mill Hill": "NW7", "Finchley": "N3", "Golders Green": "NW11",
    "Temple Fortune": "NW11",
  };

  const locationPatterns: Record<string, string[]> = {
    "Hampstead": ["Hampstead"],
    "Belsize Park": ["Belsize Park", "Belsize"],
    "Primrose Hill": ["Primrose Hill"],
    "NW3": ["NW3"],
    "Highgate": ["Highgate"],
    "St John's Wood": ["St John's Wood", "SJW"],
    "Kenwood": ["Kenwood"],
    "South Hampstead": ["South Hampstead"],
    "West Hampstead": ["West Hampstead"],
    "Bishops Avenue": ["Bishops Avenue", "Bishops"],
    "Regent's Park": ["Regent's Park"],
    "NW8": ["NW8"],
    "NW11": ["NW11"],
  };

  const locations: string[] = [];
  Object.entries(locationPatterns).forEach(([area, patterns]) => {
    if (patterns.some(p => msg.rawText.includes(p))) locations.push(area);
  });
  if (locations.length === 0) locations.push("NW3");

  const postcodes = Array.from(new Set(locations.map(l => areaPostcodeMap[l] || "NW3")));

  const budgetMatch = msg.rawText.match(/£[\d,.]+[mk]?(?:\s*(?:per\s+(?:week|month)|pcm|pw))?/i);
  const bedsMatch = msg.rawText.match(/(\d+)\s*(?:bed|bedroom)/i);
  const sqftMatch = msg.rawText.match(/([\d,]+)\s*(?:sq\.?ft|sqft)/i);

  return {
    id,
    type: msg.classification as SignalType,
    location: locations,
    postcodes,
    budget: budgetMatch ? budgetMatch[0] : "-",
    propertyType: msg.rawText.toLowerCase().includes("house") ? "House" :
                  msg.rawText.toLowerCase().includes("flat") ? "Flat" :
                  msg.rawText.toLowerCase().includes("apartment") ? "Apartment" :
                  msg.rawText.toLowerCase().includes("maisonette") ? "Maisonette" : "Any",
    bedrooms: bedsMatch ? bedsMatch[1] + "+" : "-",
    bathrooms: "-",
    sqft: sqftMatch ? sqftMatch[1] : "-",
    outsideSpace: msg.rawText.toLowerCase().includes("garden") ? "Garden required" :
                  msg.rawText.toLowerCase().includes("outside space") ? "Required" :
                  msg.rawText.toLowerCase().includes("balcony") ? "Balcony" :
                  msg.rawText.toLowerCase().includes("terrace") ? "Terrace" : "-",
    parking: msg.rawText.toLowerCase().includes("parking") ? "Required" : "-",
    condition: msg.rawText.toLowerCase().includes("turnkey") ? "Turnkey" :
               msg.rawText.toLowerCase().includes("refurb") ? "Needs refurbishment" :
               msg.rawText.toLowerCase().includes("work") ? "Open to works" : "-",
    feeRequired: msg.rawText.toLowerCase().includes("fee") ? "Yes" : "Unknown",
    retained: msg.retained,
    agent: msg.sender,
    platform: msg.platform,
    timestamp: new Date().toISOString(),
    confidence: msg.confidence,
    summary: msg.rawText.substring(0, 120) + (msg.rawText.length > 120 ? "..." : ""),
    status: "New",
    messageId: msg.id,
  };
}

const SPEED_INTERVALS: Record<number, number> = { 1: 8000, 2: 4000, 3: 2000, 4: 1000, 5: 500 };
const CLASSIFY_DELAY: Record<number, number> = { 1: 3000, 2: 1500, 3: 800, 4: 400, 5: 200 };
const EXTRACT_DELAY: Record<number, number> = { 1: 2000, 2: 1000, 3: 600, 4: 300, 5: 150 };

export function useIngestionEngine() {
  const [ingestedMessages, setIngestedMessages] = useState<IngestedMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(2);

  // Use refs for mutable counters to avoid re-render dependency cascades
  const messageIndexRef = useRef(0);
  const counterRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef(speed);

  // Keep speedRef in sync
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const ingestMessage = useCallback((customMessage?: Omit<RawMessage, "id">) => {
    counterRef.current++;
    const idx = counterRef.current;
    const currentSpeed = speedRef.current;
    const msgTemplate = customMessage || simulatedNewMessages[messageIndexRef.current % simulatedNewMessages.length];
    if (!customMessage) messageIndexRef.current++;

    const newMsg: RawMessage = {
      ...msgTemplate,
      id: `LIVE-${String(idx).padStart(3, "0")}`,
      timestamp: new Date().toISOString(),
    };

    const ingestedId = `ING-${String(idx).padStart(3, "0")}`;

    const ingestedItem: IngestedMessage = {
      id: ingestedId,
      message: newMsg,
      signal: null,
      phase: "receiving",
      ingestedAt: Date.now(),
      classifiedAt: null,
      extractedAt: null,
    };

    setIngestedMessages(prev => [ingestedItem, ...prev]);

    // Phase 2: Classifying
    setTimeout(() => {
      setIngestedMessages(prev =>
        prev.map(m =>
          m.id === ingestedId
            ? { ...m, phase: "classifying" as IngestionPhase, classifiedAt: Date.now() }
            : m
        )
      );

      // Phase 3: Extracting
      setTimeout(() => {
        const signal = generateSignalFromMessage(newMsg, `LSIG-${String(idx).padStart(3, "0")}`);
        setIngestedMessages(prev =>
          prev.map(m =>
            m.id === ingestedId
              ? { ...m, phase: "extracting" as IngestionPhase, signal, extractedAt: Date.now() }
              : m
          )
        );

        // Phase 4: Complete
        setTimeout(() => {
          setIngestedMessages(prev =>
            prev.map(m =>
              m.id === ingestedId ? { ...m, phase: "complete" as IngestionPhase } : m
            )
          );
        }, EXTRACT_DELAY[currentSpeed] * 0.5);
      }, EXTRACT_DELAY[currentSpeed]);
    }, CLASSIFY_DELAY[currentSpeed]);
  }, []); // No dependencies — uses refs only

  const start = useCallback(() => setIsRunning(true), []);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    setIngestedMessages([]);
    messageIndexRef.current = 0;
    counterRef.current = 0;
  }, [stop]);

  // Auto-ingest loop — depends only on isRunning and speed
  useEffect(() => {
    if (!isRunning) return;

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      ingestMessage();
      timerRef.current = setTimeout(tick, SPEED_INTERVALS[speedRef.current]);
    };

    // First message immediately
    ingestMessage();
    timerRef.current = setTimeout(tick, SPEED_INTERVALS[speedRef.current]);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRunning, speed, ingestMessage]);

  const stats: IngestionStats = {
    totalIngested: ingestedMessages.length,
    totalClassified: ingestedMessages.filter(m => m.classifiedAt !== null).length,
    totalExtracted: ingestedMessages.filter(m => m.signal !== null).length,
    totalActionable: ingestedMessages.filter(m => m.message.actionable).length,
    totalNonActionable: ingestedMessages.filter(m => !m.message.actionable).length,
    avgClassificationTime: (() => {
      const classified = ingestedMessages.filter(m => m.classifiedAt);
      return classified.length > 0
        ? classified.reduce((a, m) => a + (m.classifiedAt! - m.ingestedAt), 0) / classified.length
        : 0;
    })(),
    avgExtractionTime: (() => {
      const extracted = ingestedMessages.filter(m => m.extractedAt);
      return extracted.length > 0
        ? extracted.reduce((a, m) => a + (m.extractedAt! - (m.classifiedAt || m.ingestedAt)), 0) / extracted.length
        : 0;
    })(),
    messagesPerMinute: 60000 / SPEED_INTERVALS[speed],
    isRunning,
    speed,
  };

  return {
    ingestedMessages,
    stats,
    isRunning,
    speed,
    setSpeed,
    start,
    stop,
    reset,
    ingestMessage,
  };
}
