import { z } from "zod/v4";

// ============================================================
// Auth schemas
// ============================================================

export const loginSchema = z.object({
  email: z.email(),
});

export const verifyTokenSchema = z.object({
  token: z.string().min(1),
});

// ============================================================
// Agent schemas
// ============================================================

export const createAgentSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(["agent", "admin"]).default("agent"),
  coverageAreas: z.array(z.string()),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.email().optional(),
  role: z.enum(["agent", "admin"]).optional(),
  coverageAreas: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================
// Signal schemas (used in Phase 2)
// ============================================================

export const SIGNAL_TYPE_VALUES = [
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
] as const;

export const signalTypeSchema = z.enum(SIGNAL_TYPE_VALUES);

// ============================================================
// Pagination
// ============================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// Notification preferences
// ============================================================

export const updateNotificationPrefsSchema = z.object({
  inApp: z.boolean().optional(),
  email: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
  push: z.boolean().optional(),
  signalTypes: z.array(signalTypeSchema).nullable().optional(),
  minPriority: z.enum(["high", "medium", "low"]).optional(),
  dailyDigest: z.boolean().optional(),
});

// ============================================================
// Ingestion schemas (Phase 2)
// ============================================================

export const ingestMessageSchema = z.object({
  sourceGroup: z.string().min(1),
  senderName: z.string().min(1),
  senderPhone: z.string().optional().default(""),
  rawText: z.string().min(1),
  platform: z.string().optional().default("whatsapp"),
});

export const ingestBatchSchema = z.object({
  messages: z.array(ingestMessageSchema).min(1).max(100),
});

// ============================================================
// Signal filter & review schemas (Phase 2)
// ============================================================

export const signalFilterSchema = z.object({
  type: signalTypeSchema.optional(),
  status: z.enum(["new", "reviewed", "alerted", "matched"]).optional(),
  needsReview: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reviewSignalSchema = z.object({
  approved: z.boolean(),
  reviewedType: signalTypeSchema.optional(),
});

// ============================================================
// Message filter schemas (Phase 5)
// ============================================================

export const messageFilterSchema = z.object({
  classification: signalTypeSchema.optional(),
  search: z.string().optional(),
  classified: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ============================================================
// Alert schemas (Phase 3)
// ============================================================

export const alertFilterSchema = z.object({
  read: z.coerce.boolean().optional(),
  type: z.enum(["new_signal", "match_found", "review_needed"]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateAlertSchema = z.object({
  read: z.boolean(),
});

export const updateMatchSchema = z.object({
  status: z.enum(["confirmed", "dismissed"]),
});

// ============================================================
// Audit schemas (Phase 6)
// ============================================================

export const auditFilterSchema = z.object({
  entityType: z.string().optional(),
  action: z.string().optional(),
  agentId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
