// ============================================================
// DDRE War Room — Shared Type Definitions
// Used by both server and client via @shared/* alias
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

export const SIGNAL_TYPES: SignalType[] = [
  "Buyer Search",
  "Tenant Search",
  "Seller Signal",
  "Landlord Signal",
  "Property for Sale",
  "Property for Rent",
  "Service Request",
  "Service Reply",
  "Contextual Reply",
  "Social",
  "Irrelevant",
  "Market Commentary",
];

export type SignalStatus = "new" | "reviewed" | "alerted" | "matched";

export type AgentRole = "agent" | "admin";

export type AlertType = "new_signal" | "match_found" | "review_needed";

export type AlertPriority = "high" | "medium" | "low";

export type MatchStatus = "pending" | "confirmed" | "dismissed";

export type ClassificationMethod = "rules" | "llm";

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: AgentRole;
  coverageAreas: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  agentId: string;
  token: string;
  expiresAt: string;
  verified: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  sourceGroup: string;
  senderName: string;
  senderPhone: string;
  rawText: string;
  platform: string;
  receivedAt: string;
  fingerprint: string;
  classified: boolean;
  createdAt: string;
}

export interface Signal {
  id: string;
  messageId: string;
  type: SignalType;
  classificationMethod: ClassificationMethod;
  confidence: number;
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
  summary: string;
  status: SignalStatus;
  reviewedBy: string | null;
  actionable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Match {
  id: string;
  signalAId: string;
  signalBId: string;
  matchScore: number;
  matchReasons: string[];
  status: MatchStatus;
  confirmedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  agentId: string;
  signalId: string;
  matchId: string | null;
  type: AlertType;
  priority: AlertPriority;
  summary: string;
  read: boolean;
  readAt: string | null;
  deliveredVia: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferences {
  id: string;
  agentId: string;
  inApp: boolean;
  email: boolean;
  whatsapp: boolean;
  push: boolean;
  signalTypes: SignalType[] | null;
  minPriority: AlertPriority;
  dailyDigest: boolean;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  agentId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
