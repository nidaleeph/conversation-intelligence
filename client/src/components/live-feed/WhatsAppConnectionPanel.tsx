import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  RefreshCw,
  Activity,
  Inbox,
  Clock,
  Filter,
  FolderOpen,
  Heart,
  User,
  LogOut,
  RotateCw,
} from "lucide-react";
import {
  getWhatsAppWebStatus,
  logoutWhatsAppWeb,
  reconnectWhatsAppWeb,
  type WhatsAppWebStatus,
} from "@/api/whatsappWeb";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocketEvent } from "@/hooks/useWebSocket";

const POLL_INTERVAL_MS = 3000;

function formatUptime(ms: number | null): string {
  if (ms == null || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function StatusBadge({ state }: { state: WhatsAppWebStatus["state"] }) {
  const map: Record<WhatsAppWebStatus["state"], { label: string; color: string; dot: string }> = {
    ready: { label: "CONNECTED", color: "#77d5c0", dot: "animate-live-pulse" },
    initializing: { label: "STARTING", color: "#d4a843", dot: "animate-pulse" },
    qr: { label: "AWAITING SCAN", color: "#d4a843", dot: "animate-pulse" },
    disconnected: { label: "RECONNECTING", color: "#f97316", dot: "animate-pulse" },
    error: { label: "ERROR", color: "#ef4444", dot: "" },
  };
  const s = map[state];
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded border"
      style={{
        backgroundColor: `${s.color}1a`,
        borderColor: `${s.color}4d`,
      }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${s.dot}`}
        style={{ backgroundColor: s.color }}
      />
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: s.color }}
      >
        {s.label}
      </span>
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneColor =
    tone === "good" ? "#77d5c0" : tone === "warn" ? "#d4a843" : tone === "bad" ? "#ef4444" : "#c9cdd3";
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-2 text-[11px] text-[#9ca3af] uppercase tracking-[0.08em]">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-xs font-mono" style={{ color: toneColor }}>
        {value}
      </div>
    </div>
  );
}

export function WhatsAppConnectionPanel() {
  const { agent } = useAuth();
  const isAdmin = agent?.role === "admin";

  const [status, setStatus] = useState<WhatsAppWebStatus | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [actionBusy, setActionBusy] = useState<"logout" | "reconnect" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  async function handleReconnect() {
    if (actionBusy) return;
    setActionBusy("reconnect");
    setActionError(null);
    try {
      await reconnectWhatsAppWeb();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || "Reconnect failed");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleLogout() {
    setActionBusy("logout");
    setActionError(null);
    try {
      await logoutWhatsAppWeb();
    } catch (err: any) {
      setActionError(err?.response?.data?.error || err?.message || "Logout failed");
    } finally {
      setActionBusy(null);
      setLogoutDialogOpen(false);
    }
  }

  // Tick once per second so "Xs ago" labels refresh smoothly
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await getWhatsAppWebStatus();
      setStatus(data);
      setError(null);

      if (data.qr) {
        const url = await QRCode.toDataURL(data.qr, {
          width: 280,
          margin: 2,
          color: { dark: "#1a1e23", light: "#ffffff" },
        });
        setQrDataUrl(url);
      } else {
        setQrDataUrl(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unknown error");
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Real-time updates pushed by server on every state change
  useWebSocketEvent(
    "whatsapp:status",
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  if (error) {
    return (
      <div className="bg-[#22272d] border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
        <div>
          <div className="text-sm font-medium text-white">WhatsApp Connection — Status Unavailable</div>
          <div className="text-xs text-[#9ca3af] mt-0.5">{error}</div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-[#9ca3af] animate-spin shrink-0" />
        <div className="text-sm text-[#9ca3af]">Checking WhatsApp connection…</div>
      </div>
    );
  }

  if (!status.enabled) {
    return (
      <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-4 flex items-center gap-3 opacity-60">
        <AlertCircle className="w-5 h-5 text-[#9ca3af] shrink-0" />
        <div>
          <div className="text-sm font-medium text-[#c9cdd3]">WhatsApp Web Integration Disabled</div>
          <div className="text-xs text-[#9ca3af] mt-0.5">
            Set <code className="text-[#d4a843]">WHATSAPP_WEB_ENABLED=true</code> in .env to enable
          </div>
        </div>
      </div>
    );
  }

  const heartbeatTone =
    status.heartbeat.ok === true ? "good" : status.heartbeat.ok === false ? "bad" : "default";

  const heartbeatLabel =
    status.heartbeat.lastCheckAt == null
      ? "not yet checked"
      : `${formatTimeAgo(status.heartbeat.lastCheckAt)} · ${status.heartbeat.state || "—"}`;

  // Non-QR states render the detailed panel. QR state shows QR + minimal stats.

  if (status.state === "qr" && qrDataUrl) {
    return (
      <div className="bg-[#22272d] border border-[#d4a843]/30 rounded-lg p-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Smartphone className="w-4 h-4 text-[#d4a843] shrink-0" />
            <div className="text-sm font-semibold text-white truncate">
              WhatsApp Connection
            </div>
          </div>
          <StatusBadge state={status.state} />
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] w-full md:w-auto md:ml-auto"
              onClick={handleReconnect}
              disabled={actionBusy !== null}
            >
              {actionBusy === "reconnect" ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <RotateCw className="w-3 h-3 mr-1" />
              )}
              Restart
            </Button>
          )}
        </div>
        <div className="flex flex-col md:flex-row items-start gap-5">
          <div className="bg-white rounded-lg p-2 shrink-0">
            <img src={qrDataUrl} alt="WhatsApp QR Code" className="block" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-white mb-2">Scan to connect</div>
            <ol className="text-xs text-[#c9cdd3] space-y-1.5 list-decimal list-inside">
              <li>Open WhatsApp on the phone you want to monitor groups with</li>
              <li>Tap <span className="text-white">Settings &gt; Linked Devices</span></li>
              <li>Tap <span className="text-white">Link a Device</span></li>
              <li>Point your camera at this QR code</li>
            </ol>
            <div className="mt-3 text-[11px] text-[#9ca3af] flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3" />
              QR refreshes automatically every few seconds
            </div>

            {status.config.allowlist.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#3a3f45]">
                <div className="text-[11px] text-[#d4a843] uppercase tracking-[0.08em] mb-1">
                  Env Allowlist Override
                </div>
                <div className="text-xs text-[#c9cdd3]">
                  {status.config.allowlist.join(", ")}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Detailed panel for ready / disconnected / initializing / error
  const isReady = status.state === "ready";

  return (
    <div
      className="bg-[#22272d] border rounded-lg p-5"
      style={{
        borderColor: isReady ? "rgba(119, 213, 192, 0.3)" : "rgba(249, 115, 22, 0.3)",
      }}
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isReady ? (
            <CheckCircle2 className="w-4 h-4 text-[#77d5c0] shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 text-orange-400 animate-spin shrink-0" />
          )}
          <div className="text-sm font-semibold text-white truncate">
            WhatsApp Web Connection
          </div>
        </div>
        <StatusBadge state={status.state} />
        {isAdmin && (
          <div className="flex items-center gap-2 w-full md:w-auto md:ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] flex-1 md:flex-none"
              onClick={handleReconnect}
              disabled={actionBusy !== null}
              title="Restart the browser session without re-scanning the QR"
            >
              {actionBusy === "reconnect" ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <RotateCw className="w-3 h-3 mr-1" />
              )}
              Restart
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] flex-1 md:flex-none border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={() => setLogoutDialogOpen(true)}
              disabled={actionBusy !== null}
              title="Log out and wipe session — requires a new QR scan"
            >
              {actionBusy === "logout" ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <LogOut className="w-3 h-3 mr-1" />
              )}
              Log out
            </Button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0">
        {/* Left column — account + heartbeat */}
        <div className="border-b md:border-b-0 md:border-r border-[#3a3f45]/60 pb-3 md:pb-0 md:pr-6">
          <div className="text-[11px] text-[#9ca3af] uppercase tracking-[0.08em] mb-2">
            Account
          </div>
          <StatRow
            icon={User}
            label="Name"
            value={status.account.pushname || "—"}
          />
          <StatRow
            icon={Smartphone}
            label="Phone"
            value={status.account.phone ? `+${status.account.phone}` : "—"}
          />
          <StatRow
            icon={Activity}
            label="Platform"
            value={status.account.platform || "—"}
          />

          <div className="text-[11px] text-[#9ca3af] uppercase tracking-[0.08em] mb-2 mt-4">
            Heartbeat
          </div>
          <StatRow
            icon={Heart}
            label="Last Check"
            value={heartbeatLabel}
            tone={heartbeatTone}
          />
          <StatRow
            icon={Clock}
            label="Interval"
            value={`${Math.round(status.heartbeat.intervalMs / 1000)}s`}
          />
          <StatRow
            icon={Clock}
            label="Uptime"
            value={formatUptime(status.uptimeMs)}
          />
          {status.reconnectAttempts > 0 && (
            <StatRow
              icon={RefreshCw}
              label="Reconnects"
              value={status.reconnectAttempts}
              tone="warn"
            />
          )}
        </div>

        {/* Right column — stats + config */}
        <div className="pt-3 md:pt-0 md:pl-6">
          <div className="text-[11px] text-[#9ca3af] uppercase tracking-[0.08em] mb-2">
            Message Stats
          </div>
          <StatRow
            icon={Inbox}
            label="Received"
            value={status.stats.received.toLocaleString()}
          />
          <StatRow
            icon={CheckCircle2}
            label="Ingested"
            value={status.stats.ingested.toLocaleString()}
            tone="good"
          />
          {status.config.allowlist.length > 0 && (
            <StatRow
              icon={Filter}
              label="Filtered"
              value={status.stats.filteredByAllowlist.toLocaleString()}
            />
          )}
          <StatRow
            icon={Clock}
            label="Last Msg"
            value={status.stats.lastMessageAt ? formatTimeAgo(status.stats.lastMessageAt) : "none yet"}
          />

          <div className="text-[11px] text-[#9ca3af] uppercase tracking-[0.08em] mb-2 mt-4">
            Config
          </div>
          <StatRow
            icon={FolderOpen}
            label="Session"
            value={
              <span className="truncate max-w-[200px] inline-block" title={status.config.sessionPath}>
                {status.config.sessionPath.split(/[\\/]/).pop() || status.config.sessionPath}
              </span>
            }
          />
          {status.config.allowlist.length > 0 && (
            <StatRow
              icon={Filter}
              label="Env Filter"
              value={status.config.allowlist.join(", ")}
              tone="warn"
            />
          )}
        </div>
      </div>

      {status.lastError && !isReady && (
        <div className="mt-4 pt-3 border-t border-[#3a3f45]/60 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
          <div className="text-xs text-[#c9cdd3]">
            <span className="text-[#9ca3af]">Last error: </span>
            {status.lastError}
          </div>
        </div>
      )}

      {/* Hidden tick to force re-render for time-ago labels */}
      <span className="hidden">{tick}</span>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out WhatsApp session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will wipe the stored credentials and require a new QR scan on
              the phone to reconnect. Use this when switching to a different
              WhatsApp account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy === "logout"}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={actionBusy === "logout"}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {actionBusy === "logout" ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Logging out…
                </>
              ) : (
                "Log out"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
