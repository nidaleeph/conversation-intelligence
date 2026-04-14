import { query } from "../../db/connection.js";

export interface WhatsAppAccount {
  id: string;
  phone: string;
  pushname: string | null;
  platform: string | null;
  wwebVersion: string | null;
  firstConnectedAt: Date;
  lastConnectedAt: Date;
  lastDisconnectedAt: Date | null;
  isActive: boolean;
}

export interface MonitoredGroup {
  id: string;
  accountId: string;
  groupChatId: string;
  groupName: string;
  enabled: boolean;
  messageCount: number;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toAccount(row: any): WhatsAppAccount {
  return {
    id: row.id,
    phone: row.phone,
    pushname: row.pushname,
    platform: row.platform,
    wwebVersion: row.wweb_version,
    firstConnectedAt: row.first_connected_at,
    lastConnectedAt: row.last_connected_at,
    lastDisconnectedAt: row.last_disconnected_at,
    isActive: row.is_active,
  };
}

function toGroup(row: any): MonitoredGroup {
  return {
    id: row.id,
    accountId: row.account_id,
    groupChatId: row.group_chat_id,
    groupName: row.group_name,
    enabled: row.enabled,
    messageCount: row.message_count,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Upsert an account when it connects. Marks this account active and all others inactive.
 */
export async function upsertAccountOnConnect(input: {
  phone: string;
  pushname: string | null;
  platform: string | null;
  wwebVersion: string | null;
}): Promise<WhatsAppAccount> {
  await query(
    `UPDATE whatsapp_web_accounts SET is_active = false, updated_at = now()
     WHERE is_active = true AND phone <> $1`,
    [input.phone]
  );

  const result = await query(
    `INSERT INTO whatsapp_web_accounts (phone, pushname, platform, wweb_version, last_connected_at, is_active)
     VALUES ($1, $2, $3, $4, now(), true)
     ON CONFLICT (phone) DO UPDATE SET
       pushname = EXCLUDED.pushname,
       platform = EXCLUDED.platform,
       wweb_version = EXCLUDED.wweb_version,
       last_connected_at = now(),
       last_disconnected_at = NULL,
       is_active = true,
       updated_at = now()
     RETURNING *`,
    [input.phone, input.pushname, input.platform, input.wwebVersion]
  );

  return toAccount(result.rows[0]);
}

export async function markAccountDisconnected(phone: string): Promise<void> {
  await query(
    `UPDATE whatsapp_web_accounts
     SET is_active = false, last_disconnected_at = now(), updated_at = now()
     WHERE phone = $1`,
    [phone]
  );
}

export async function getActiveAccount(): Promise<WhatsAppAccount | null> {
  const result = await query(
    "SELECT * FROM whatsapp_web_accounts WHERE is_active = true ORDER BY last_connected_at DESC LIMIT 1"
  );
  return result.rows[0] ? toAccount(result.rows[0]) : null;
}

export async function listAccounts(): Promise<WhatsAppAccount[]> {
  const result = await query(
    "SELECT * FROM whatsapp_web_accounts ORDER BY last_connected_at DESC"
  );
  return result.rows.map(toAccount);
}

/**
 * Returns the list of groups to monitor for this account.
 * If no rows exist → returns null which means "monitor all groups".
 * If rows exist → returns only the enabled ones.
 */
export async function getEnabledGroupsForAccount(
  accountId: string
): Promise<MonitoredGroup[] | null> {
  const all = await query(
    "SELECT * FROM whatsapp_web_monitored_groups WHERE account_id = $1",
    [accountId]
  );
  if (all.rows.length === 0) return null; // permissive default
  return all.rows.filter((r: any) => r.enabled).map(toGroup);
}

export async function listMonitoredGroups(
  accountId: string
): Promise<MonitoredGroup[]> {
  const result = await query(
    "SELECT * FROM whatsapp_web_monitored_groups WHERE account_id = $1 ORDER BY created_at ASC",
    [accountId]
  );
  return result.rows.map(toGroup);
}

export async function addMonitoredGroup(input: {
  accountId: string;
  groupChatId: string;
  groupName: string;
  enabled?: boolean;
}): Promise<MonitoredGroup> {
  const result = await query(
    `INSERT INTO whatsapp_web_monitored_groups (account_id, group_chat_id, group_name, enabled)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (account_id, group_chat_id) DO UPDATE SET
       group_name = EXCLUDED.group_name,
       enabled = EXCLUDED.enabled,
       updated_at = now()
     RETURNING *`,
    [input.accountId, input.groupChatId, input.groupName, input.enabled ?? true]
  );
  return toGroup(result.rows[0]);
}

export async function updateMonitoredGroup(input: {
  id: string;
  enabled?: boolean;
  groupName?: string;
}): Promise<MonitoredGroup | null> {
  const sets: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (input.enabled !== undefined) {
    sets.push(`enabled = $${idx++}`);
    vals.push(input.enabled);
  }
  if (input.groupName !== undefined) {
    sets.push(`group_name = $${idx++}`);
    vals.push(input.groupName);
  }
  if (sets.length === 0) return null;

  sets.push(`updated_at = now()`);
  vals.push(input.id);

  const result = await query(
    `UPDATE whatsapp_web_monitored_groups SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    vals
  );
  return result.rows[0] ? toGroup(result.rows[0]) : null;
}

export async function deleteMonitoredGroup(id: string): Promise<boolean> {
  const result = await query(
    "DELETE FROM whatsapp_web_monitored_groups WHERE id = $1",
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Increments message_count + last_seen_at for existing monitored_groups rows only.
 * Does NOT create new rows — so accounts in "permissive (no rows = all groups)"
 * mode don't accidentally get rows auto-added for every group they're in.
 */
export async function recordGroupMessage(input: {
  accountId: string;
  groupChatId: string;
}): Promise<void> {
  await query(
    `UPDATE whatsapp_web_monitored_groups
     SET message_count = message_count + 1,
         last_seen_at = now(),
         updated_at = now()
     WHERE account_id = $1 AND group_chat_id = $2`,
    [input.accountId, input.groupChatId]
  );
}
