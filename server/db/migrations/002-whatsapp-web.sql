-- ============================================================
-- WhatsApp Web accounts and monitored groups (allowlist)
-- ============================================================

-- One row per WhatsApp phone number that has been linked
CREATE TABLE whatsapp_web_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  pushname TEXT,
  platform TEXT,
  wweb_version TEXT,
  first_connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_disconnected_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wweb_accounts_active ON whatsapp_web_accounts(is_active) WHERE is_active = true;

-- Allowlist of groups to monitor for each account
-- If an account has ZERO rows here, monitor ALL groups (permissive default).
-- If any rows exist, only ingest messages from enabled=true entries.
CREATE TABLE whatsapp_web_monitored_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES whatsapp_web_accounts(id) ON DELETE CASCADE,
  group_chat_id TEXT NOT NULL,
  group_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, group_chat_id)
);

CREATE INDEX idx_wweb_monitored_groups_account ON whatsapp_web_monitored_groups(account_id);
CREATE INDEX idx_wweb_monitored_groups_enabled ON whatsapp_web_monitored_groups(account_id, enabled) WHERE enabled = true;
