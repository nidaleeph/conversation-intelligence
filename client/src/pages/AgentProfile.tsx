// ============================================================
// DDRE War Room — Agent Profile Page
// Shows individual agent's active searches, listings, match history,
// and performance stats derived from the Hampstead dataset
// Colour-coded signal cards, same War Room aesthetic
// ============================================================

import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import {
  MapPin, Banknote, BedDouble, Home, User, ArrowLeft,
  Radio, Bell, TrendingUp, Calendar, Search, Activity,
  Building, ChevronRight, Bookmark, Eye, Shield, Clock,
  BarChart3, Target, Zap, Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  signals, alerts, agentProfiles, rawMessages,
  type Signal, type Alert, type SignalType,
} from "@/lib/data";

const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663265683302/Mchx73LWdrS7gUExt8LJHT/hero-signal-flow-NJjFpRVPF2sCqBjyqVXHwV.webp";

const signalTypeColors: Record<string, string> = {
  "Buyer Search": "#ef4444",
  "Tenant Search": "#3b82f6",
  "Property for Sale": "#d4a843",
  "Property for Rent": "#f59e0b",
  "Service Request": "#8b5cf6",
  "Seller Signal": "#ec4899",
  "Landlord Signal": "#f97316",
};

const statusColors: Record<string, string> = {
  New: "bg-[#3b82f6]/20 text-[#3b82f6]",
  Reviewed: "bg-[#8b5cf6]/20 text-[#8b5cf6]",
  Alerted: "bg-[#2ecc71]/20 text-[#2ecc71]",
  Matched: "bg-[#d4a843]/20 text-[#d4a843]",
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#77d5c0] mb-3">
      {children}
    </h2>
  );
}

function formatDate(ts: string) {
  const d = new Date(ts);
  return `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })} ${d.getFullYear()}, ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: React.ElementType; accent?: boolean }) {
  return (
    <div className="bg-[#22272d] border border-[#3a3f45]/30 rounded-lg p-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">{label}</span>
        <Icon className="w-3.5 h-3.5 text-[#4a5060]" strokeWidth={1.5} />
      </div>
      <span className={`text-xl font-bold ${accent ? "text-[#77d5c0]" : "text-white"}`}>{value}</span>
    </div>
  );
}

function MiniSignalCard({ signal }: { signal: Signal }) {
  const typeColor = signalTypeColors[signal.type] || "#6b7280";
  const uniquePostcodes = Array.from(new Set(signal.postcodes));
  return (
    <div
      className="bg-[#22272d] rounded-lg overflow-hidden hover:brightness-110 transition-all"
      style={{ borderLeft: `4px solid ${typeColor}`, border: `1px solid ${typeColor}30`, borderLeftWidth: "4px", borderLeftColor: typeColor }}
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${typeColor}25`, color: typeColor }}
            >
              {signal.type}
            </span>
            <span className="flex items-center gap-1 text-[9px] text-[#6b7280]">
              <Calendar className="w-2.5 h-2.5" />
              {formatDate(signal.timestamp)}
            </span>
          </div>
          <Badge className={`text-[9px] px-1.5 py-0 h-4 font-medium border-0 ${statusColors[signal.status]}`}>
            {signal.status}
          </Badge>
        </div>

        {/* Data grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <div className="col-span-2 flex items-center gap-1.5 flex-wrap">
            <MapPin className="w-3 h-3 shrink-0" style={{ color: typeColor }} />
            <span className="text-xs font-semibold text-white">{signal.location.join(", ")}</span>
            {uniquePostcodes.map(pc => (
              <span key={pc} className="text-[8px] px-1 py-0.5 rounded font-bold" style={{ backgroundColor: `${typeColor}20`, color: typeColor }}>{pc}</span>
            ))}
          </div>
          <div>
            <span className="text-[9px] text-[#6b7280]">Budget: </span>
            <span className="text-[11px] font-bold text-white">{signal.budget !== "-" ? signal.budget : "—"}</span>
          </div>
          <div>
            <span className="text-[9px] text-[#6b7280]">Beds: </span>
            <span className="text-[11px] font-bold text-white">{signal.bedrooms !== "-" ? signal.bedrooms : "—"}</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {signal.retained === "Yes" && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-[#d4a843]/15 text-[#d4a843] font-medium">Retained</span>
          )}
          {signal.feeRequired === "Yes" && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-[#77d5c0]/15 text-[#77d5c0] font-medium">Fee</span>
          )}
          {signal.condition !== "-" && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-[#3a3f45]/50 text-[#9ca3af]">{signal.condition}</span>
          )}
        </div>

        {/* Summary */}
        <p className="text-[9px] text-[#6b7280] italic mt-2 line-clamp-1">"{signal.summary}"</p>
      </div>
    </div>
  );
}

export default function AgentProfile() {
  const params = useParams<{ name: string }>();
  const agentName = decodeURIComponent(params.name || "");
  const [activeTab, setActiveTab] = useState<"all" | "searches" | "listings" | "alerts">("all");

  const profile = useMemo(() => agentProfiles.find(a => a.name === agentName), [agentName]);

  // All signals originated by this agent
  const agentSignals = useMemo(() =>
    signals.filter(s => s.agent === agentName).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [agentName]
  );

  // Searches (Buyer + Tenant)
  const searches = useMemo(() =>
    agentSignals.filter(s => s.type === "Buyer Search" || s.type === "Tenant Search"),
    [agentSignals]
  );

  // Listings (For Sale + For Rent)
  const listings = useMemo(() =>
    agentSignals.filter(s => s.type === "Property for Sale" || s.type === "Property for Rent"),
    [agentSignals]
  );

  // Alerts where this agent is either originator or recipient
  const agentAlerts = useMemo(() =>
    alerts.filter(a => a.originatingAgent === agentName || a.recipientAgent === agentName)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [agentName]
  );

  // Raw messages from this agent
  const agentMessages = useMemo(() =>
    rawMessages.filter(m => m.sender === agentName),
    [agentName]
  );

  // Derived stats
  const retainedCount = agentSignals.filter(s => s.retained === "Yes").length;
  const highPriorityAlerts = agentAlerts.filter(a => a.priority === "High").length;
  const avgConfidence = agentSignals.length > 0
    ? Math.round(agentSignals.reduce((sum, s) => sum + s.confidence, 0) / agentSignals.length * 100)
    : 0;

  // Areas this agent operates in (from signals)
  const activeAreas = useMemo(() => {
    const areaMap: Record<string, number> = {};
    agentSignals.forEach(s => s.location.forEach(l => { areaMap[l] = (areaMap[l] || 0) + 1; }));
    return Object.entries(areaMap).sort((a, b) => b[1] - a[1]);
  }, [agentSignals]);

  // Signal type breakdown
  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    agentSignals.forEach(s => { map[s.type] = (map[s.type] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [agentSignals]);

  const filteredSignals = useMemo(() => {
    switch (activeTab) {
      case "searches": return searches;
      case "listings": return listings;
      case "all": return agentSignals;
      default: return agentSignals;
    }
  }, [activeTab, agentSignals, searches, listings]);

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <User className="w-12 h-12 text-[#4a5060]" />
        <h2 className="text-lg font-semibold text-white">Agent not found</h2>
        <p className="text-sm text-[#6b7280]">No profile found for "{agentName}"</p>
        <Link href="/" className="text-[#77d5c0] text-sm hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <div className="relative h-36 overflow-hidden">
        <img src={HERO_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1e23] via-[#1a1e23]/80 to-transparent" />
        <div className="relative z-10 h-full flex items-center px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[#6b7280] hover:text-[#9ca3af] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-14 h-14 rounded-xl bg-[#22272d] border border-[#3a3f45]/50 flex items-center justify-center">
              <User className="w-7 h-7 text-[#77d5c0]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">{agentName}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[11px] text-[#9ca3af]">
                  {profile.areas.slice(0, 3).join(", ")}{profile.areas.length > 3 ? ` +${profile.areas.length - 3}` : ""}
                </span>
                <span className="text-[9px] text-[#4a5060]">|</span>
                <span className="text-[11px] text-[#6b7280]">{agentSignals.length} signals</span>
                <span className="text-[9px] text-[#4a5060]">|</span>
                <span className="text-[11px] text-[#6b7280]">{agentAlerts.length} alerts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <StatCard label="Total Signals" value={agentSignals.length} icon={Radio} accent />
          <StatCard label="Searches" value={searches.length} icon={Search} />
          <StatCard label="Listings" value={listings.length} icon={Building} />
          <StatCard label="Alerts" value={agentAlerts.length} icon={Bell} />
          <StatCard label="Retained" value={retainedCount} icon={Shield} accent />
          <StatCard label="High Priority" value={highPriorityAlerts} icon={Zap} />
          <StatCard label="Avg Confidence" value={`${avgConfidence}%`} icon={Target} />
        </div>

        {/* Main Grid: Signals + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Signal Feed */}
          <div className="lg:col-span-2">
            {/* Tab Filters */}
            <div className="flex items-center gap-1.5 mb-3">
              {(["all", "searches", "listings"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-[11px] px-3 py-1.5 rounded-md border transition-all font-medium capitalize ${
                    activeTab === tab
                      ? "border-[#77d5c0]/50 bg-[#77d5c0]/15 text-[#77d5c0]"
                      : "border-[#3a3f45]/50 text-[#6b7280] hover:text-[#9ca3af] hover:border-[#3a3f45]"
                  }`}
                >
                  {tab === "all" ? `All Signals (${agentSignals.length})` : tab === "searches" ? `Searches (${searches.length})` : `Listings (${listings.length})`}
                </button>
              ))}
            </div>

            <ScrollArea className="h-[600px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pr-3">
                {filteredSignals.map((signal, i) => (
                  <div key={signal.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                    <MiniSignalCard signal={signal} />
                  </div>
                ))}
                {filteredSignals.length === 0 && (
                  <div className="col-span-2 flex flex-col items-center justify-center py-16 text-[#6b7280]">
                    <Search className="w-8 h-8 mb-3 opacity-40" />
                    <p className="text-sm">No signals in this category</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* Active Areas */}
            <div className="bg-[#22272d]/50 border border-[#3a3f45]/30 rounded-lg p-4">
              <SectionHeader>Active Areas</SectionHeader>
              <div className="space-y-2">
                {activeAreas.map(([area, count]) => (
                  <div key={area} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-[#6b7280]" />
                      <span className="text-xs text-[#c9cdd3]">{area}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-[#3a3f45] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#77d5c0]"
                          style={{ width: `${(count / (activeAreas[0]?.[1] || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[#6b7280] w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
                {activeAreas.length === 0 && (
                  <span className="text-[11px] text-[#4a5060]">No area data</span>
                )}
              </div>
            </div>

            {/* Signal Type Breakdown */}
            <div className="bg-[#22272d]/50 border border-[#3a3f45]/30 rounded-lg p-4">
              <SectionHeader>Signal Breakdown</SectionHeader>
              <div className="space-y-2">
                {typeBreakdown.map(([type, count]) => {
                  const color = signalTypeColors[type] || "#6b7280";
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                        <span className="text-[11px] text-[#c9cdd3]">{type}</span>
                      </div>
                      <span className="text-[11px] font-bold" style={{ color }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Match History (Alerts) */}
            <div className="bg-[#22272d]/50 border border-[#3a3f45]/30 rounded-lg p-4">
              <SectionHeader>Match History</SectionHeader>
              <ScrollArea className="h-[280px]">
                <div className="space-y-2 pr-2">
                  {agentAlerts.map(alert => {
                    const isOriginator = alert.originatingAgent === agentName;
                    return (
                      <div
                        key={alert.id}
                        className="bg-[#1a1e23] border border-[#3a3f45]/30 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Bell className="w-3 h-3 text-[#6b7280]" />
                            <span className="text-[10px] font-medium text-[#9ca3af]">{alert.id}</span>
                          </div>
                          <Badge className={`text-[8px] px-1 py-0 h-4 border-0 ${
                            alert.priority === "High" ? "bg-[#ef4444]/20 text-[#ef4444]" : "bg-[#d4a843]/20 text-[#d4a843]"
                          }`}>
                            {alert.priority}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-white font-medium mb-1 line-clamp-2">{alert.summary}</p>
                        <div className="flex items-center gap-2 text-[9px] text-[#6b7280]">
                          <span>{isOriginator ? "Sent to" : "From"}: <span className="text-[#9ca3af]">{isOriginator ? alert.recipientAgent : alert.originatingAgent}</span></span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[9px] text-[#6b7280]">
                          <MapPin className="w-2.5 h-2.5" />
                          <span>{alert.matchingArea}</span>
                          <span className="text-[#4a5060]">|</span>
                          <Calendar className="w-2.5 h-2.5" />
                          <span>{formatDate(alert.timestamp)}</span>
                        </div>
                      </div>
                    );
                  })}
                  {agentAlerts.length === 0 && (
                    <div className="text-center py-8">
                      <span className="text-[11px] text-[#4a5060]">No alerts for this agent</span>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
