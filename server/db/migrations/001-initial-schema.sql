-- ============================================================
-- DDRE War Room — Initial Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Agents
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('agent', 'admin')),
  coverage_areas TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions (magic link auth)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_agent_id ON sessions(agent_id);

-- Messages (raw WhatsApp messages)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_group TEXT,
  sender_name TEXT,
  sender_phone TEXT,
  raw_text TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'whatsapp',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fingerprint TEXT UNIQUE,
  classified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_fingerprint ON messages(fingerprint);
CREATE INDEX idx_messages_classified ON messages(classified) WHERE classified = false;

-- Signals (classified from messages)
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  classification_method TEXT NOT NULL CHECK (classification_method IN ('rules', 'llm')),
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0,
  location TEXT[] NOT NULL DEFAULT '{}',
  postcodes TEXT[] NOT NULL DEFAULT '{}',
  budget_min INTEGER,
  budget_max INTEGER,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  sqft INTEGER,
  outside_space BOOLEAN,
  parking BOOLEAN,
  condition TEXT,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'alerted', 'matched')),
  reviewed_by UUID REFERENCES agents(id) ON DELETE SET NULL,
  actionable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signals_type_status ON signals(type, status);
CREATE INDEX idx_signals_location ON signals USING GIN(location);
CREATE INDEX idx_signals_created_at ON signals(created_at);
CREATE INDEX idx_signals_status ON signals(status) WHERE status = 'new';

-- Matches (buyer ↔ listing)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_a_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  signal_b_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  match_score DECIMAL(3,2) NOT NULL DEFAULT 0,
  match_reasons TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  confirmed_by UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(signal_a_id, signal_b_id)
);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('new_signal', 'match_found', 'review_needed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  summary TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  delivered_via TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_agent_read ON alerts(agent_id, read);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);

-- Notification preferences
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID UNIQUE NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  in_app BOOLEAN NOT NULL DEFAULT true,
  email BOOLEAN NOT NULL DEFAULT true,
  whatsapp BOOLEAN NOT NULL DEFAULT false,
  push BOOLEAN NOT NULL DEFAULT false,
  signal_types TEXT[],
  min_priority TEXT NOT NULL DEFAULT 'low' CHECK (min_priority IN ('high', 'medium', 'low')),
  daily_digest BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Push subscriptions (Web Push API)
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_agent ON push_subscriptions(agent_id);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);

-- Migration tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
