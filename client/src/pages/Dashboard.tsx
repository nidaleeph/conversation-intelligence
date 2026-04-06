// ============================================================
// DDRE War Room — Dashboard Page
// Colour-coded signal cards: parsed data prominent, raw text demoted
// Red = Buyer, Blue = Tenant, Gold = For Sale, Orange = For Rent, Purple = Service
// ============================================================

import { useState, useMemo, useCallback } from "react";
import { Link } from "wouter";
import {
  MessageSquare, Radio, Search, Home, Building, Wrench, Bell,
  AlertTriangle, TrendingUp, Users, MapPin, Eye, ChevronDown,
  Filter, Bookmark, ArrowUpRight, Clock, X, Banknote, BedDouble,
  User, Calendar, Shield
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import {
  getKPIs, getAreaStats, getBudgetDistribution, getBedroomDistribution,
  getPropertyTypeDistribution, signals, alerts, watchlists,
  type Signal, type SignalStatus,
} from "@/lib/data";

const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663265683302/Mchx73LWdrS7gUExt8LJHT/hero-dark-network-jWoKoERoTMuRyKq9Q6VWGu.webp";

const statusColors: Record<SignalStatus, string> = {
  New: "bg-[#77d5c0]/20 text-[#77d5c0]",
  Reviewed: "bg-[#3b82f6]/20 text-[#3b82f6]",
  Alerted: "bg-[#d4a843]/20 text-[#d4a843]",
  Matched: "bg-[#2ecc71]/20 text-[#2ecc71]",
};

// Strong, distinct colours per signal type for instant recognition
const signalTypeColors: Record<string, string> = {
  "Buyer Search": "#ef4444",    // RED
  "Tenant Search": "#3b82f6",   // BLUE
  "Property for Sale": "#d4a843", // GOLD
  "Property for Rent": "#f59e0b", // ORANGE
  "Service Request": "#8b5cf6",  // PURPLE
  "Seller Signal": "#ec4899",    // PINK
  "Landlord Signal": "#f97316",  // DEEP ORANGE
  "Market Commentary": "#6b7280", // GREY
  "Social": "#4b5563",           // DARK GREY
};

const CHART_COLORS = ["#ef4444", "#3b82f6", "#d4a843", "#8b5cf6", "#f59e0b", "#ec4899", "#2ecc71", "#f97316"];

const ALL_AREAS = ["Hampstead", "Belsize Park", "Primrose Hill", "Highgate", "St John's Wood", "NW3", "Kenwood", "West Hampstead", "South Hampstead", "Hampstead Garden Suburb", "Dartmouth Park", "Marylebone"];
const ALL_POSTCODES = ["NW3", "NW1", "NW6", "NW8", "NW5", "NW7", "NW11", "N6", "N7", "N3", "N2", "W1", "W9"];
const ALL_TYPES = ["Buyer Search", "Tenant Search", "Property for Sale", "Property for Rent", "Service Request"];

const BUDGET_PRESETS = [
  { label: "Any", min: 0, max: Infinity },
  { label: "Under £2m", min: 0, max: 2_000_000 },
  { label: "£2m–£4m", min: 2_000_000, max: 4_000_000 },
  { label: "£4m–£6m", min: 4_000_000, max: 6_000_000 },
  { label: "£6m–£10m", min: 6_000_000, max: 10_000_000 },
  { label: "£10m+", min: 10_000_000, max: Infinity },
];

function parseBudgetValue(budget: string): number | null {
  if (!budget || budget === "-" || budget === "\u2014" || budget.toLowerCase() === "flexible") return null;
  if (budget.toLowerCase().includes("pcm") || budget.toLowerCase().includes("pw")) return null;
  const cleaned = budget.replace(/,/g, "").replace(/\u00a3/g, "");
  const nums = cleaned.match(/[\d.]+/g);
  if (!nums) return null;
  const raw = parseFloat(nums[nums.length - 1]);
  if (isNaN(raw)) return null;
  const lc = budget.toLowerCase();
  if (lc.includes("k")) return raw * 1000;
  if (lc.includes("m")) return raw * 1_000_000;
  if (raw >= 100000) return raw;
  if (raw < 100) return raw * 1_000_000;
  return raw * 1000;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#77d5c0] mb-3">
      {children}
    </h2>
  );
}

function MetricCard({ label, value, icon: Icon, accent = false }: {
  label: string; value: string | number; icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-3 hover:border-[#3a3f45] transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.1em] text-[#6b7280]">{label}</span>
        <Icon className={`w-3.5 h-3.5 ${accent ? "text-[#77d5c0]" : "text-[#4a5060]"}`} strokeWidth={1.5} />
      </div>
      <span className={`text-xl font-bold ${accent ? "text-[#77d5c0]" : "text-white"}`}>{value}</span>
    </div>
  );
}

// ============================================================
// REDESIGNED SIGNAL CARD
// Bold colour-coded left border, structured data grid prominent,
// raw text small and muted underneath
// ============================================================
function formatSignalDate(ts: string) {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${mins}`;
}

function SignalCard({ signal }: { signal: Signal }) {
  const typeColor = signalTypeColors[signal.type] || "#6b7280";
  const uniquePostcodes = Array.from(new Set(signal.postcodes));
  return (
    <div
      className="bg-[#22272d] rounded-lg overflow-hidden hover:brightness-110 transition-all group"
      style={{ borderLeft: `4px solid ${typeColor}`, border: `1px solid ${typeColor}30`, borderLeftWidth: "4px", borderLeftColor: typeColor }}
    >
      <div className="p-3.5">
        {/* Header: Type badge + Date/Time + Status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded"
              style={{ backgroundColor: `${typeColor}25`, color: typeColor }}
            >
              {signal.type}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[#6b7280]">
              <Calendar className="w-3 h-3" />
              {formatSignalDate(signal.timestamp)}
            </span>
          </div>
          <Badge className={`text-[10px] px-1.5 py-0 h-5 font-medium border-0 ${statusColors[signal.status]}`}>
            {signal.status}
          </Badge>
        </div>

        {/* PRIMARY DATA GRID — the scannable part */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-3">
          {/* Location + Postcodes */}
          <div className="col-span-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: typeColor }} />
              <span className="text-sm font-semibold text-white leading-tight">{signal.location.join(", ")}</span>
              {uniquePostcodes.length > 0 && uniquePostcodes.map(pc => (
                <span key={pc} className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wide" style={{ backgroundColor: `${typeColor}20`, color: typeColor }}>{pc}</span>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.1em] text-[#6b7280] mb-0.5">Budget</div>
            <div className="flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5 text-[#6b7280]" />
              <span className="text-[13px] font-bold text-white">{signal.budget !== "-" ? signal.budget : "—"}</span>
            </div>
          </div>

          {/* Bedrooms */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.1em] text-[#6b7280] mb-0.5">Beds</div>
            <div className="flex items-center gap-1">
              <BedDouble className="w-3.5 h-3.5 text-[#6b7280]" />
              <span className="text-[13px] font-bold text-white">{signal.bedrooms !== "-" ? signal.bedrooms : "—"}</span>
            </div>
          </div>

          {/* Property Type */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.1em] text-[#6b7280] mb-0.5">Type</div>
            <div className="flex items-center gap-1">
              <Home className="w-3.5 h-3.5 text-[#6b7280]" />
              <span className="text-xs font-medium text-[#c9cdd3]">{signal.propertyType !== "Any" ? signal.propertyType : "—"}</span>
            </div>
          </div>

          {/* Agent */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.1em] text-[#6b7280] mb-0.5">Agent</div>
            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-[#6b7280]" />
              <Link href={`/agents/${encodeURIComponent(signal.agent)}`} className="text-xs font-medium text-[#c9cdd3] truncate hover:text-[#77d5c0] transition-colors underline-offset-2 hover:underline">{signal.agent}</Link>
            </div>
          </div>
        </div>

        {/* Extra tags row */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {signal.retained === "Yes" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#d4a843]/20 text-[#d4a843] font-bold uppercase tracking-wider border border-[#d4a843]/30 flex items-center gap-1">
              <Shield className="w-2.5 h-2.5" />
              Retained
            </span>
          )}
          {signal.feeRequired === "Yes" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#77d5c0]/20 text-[#77d5c0] font-bold uppercase tracking-wider border border-[#77d5c0]/30 flex items-center gap-1">
              <Banknote className="w-2.5 h-2.5" />
              Fee
            </span>
          )}
          {signal.outsideSpace !== "-" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3a3f45]/50 text-[#9ca3af]">{signal.outsideSpace}</span>
          )}
          {signal.condition !== "-" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3a3f45]/50 text-[#9ca3af]">{signal.condition}</span>
          )}
          {signal.parking === "Required" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3a3f45]/50 text-[#9ca3af]">Parking</span>
          )}
          {signal.sqft !== "-" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3a3f45]/50 text-[#9ca3af]">{signal.sqft} sqft</span>
          )}
        </div>

        {/* RAW TEXT — demoted, small, muted */}
        <p className="text-[10px] text-[#6b7280] leading-relaxed line-clamp-2 italic">
          "{signal.summary}"
        </p>

        {/* Footer: confidence + platform */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#3a3f45]/30">
          <div className="flex items-center gap-1.5">
            <div className="w-14 h-1 bg-[#3a3f45] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${signal.confidence * 100}%`, backgroundColor: typeColor }} />
            </div>
            <span className="text-[9px] text-[#6b7280]">{Math.round(signal.confidence * 100)}%</span>
          </div>
          <span className="text-[9px] text-[#4a5060]">WhatsApp</span>
        </div>
      </div>
    </div>
  );
}

// Multi-select toggle chip component
function MultiSelectChips({
  label, options, selected, onToggle, onClear, colorMap,
}: {
  label: string; options: string[]; selected: Set<string>;
  onToggle: (value: string) => void; onClear: () => void;
  colorMap?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">{label}</span>
        {selected.size > 0 && (
          <button onClick={onClear} className="flex items-center gap-0.5 text-[9px] text-[#77d5c0] hover:text-[#5bc4ad] transition-colors">
            <X className="w-2.5 h-2.5" />Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(option => {
          const isActive = selected.has(option);
          const accentColor = colorMap?.[option];
          return (
            <button
              key={option}
              onClick={() => onToggle(option)}
              className={`text-[11px] px-2.5 py-1 rounded-md border transition-all duration-150 font-medium ${
                isActive
                  ? "border-[#77d5c0]/50 text-white"
                  : "border-[#3a3f45]/50 text-[#6b7280] hover:text-[#9ca3af] hover:border-[#3a3f45]"
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: accentColor ? `${accentColor}20` : "rgba(119, 213, 192, 0.15)",
                      borderColor: accentColor ? `${accentColor}60` : "rgba(119, 213, 192, 0.4)",
                      color: accentColor || "#77d5c0",
                    }
                  : {}
              }
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const kpis = useMemo(() => getKPIs(), []);
  const areaStats = useMemo(() => getAreaStats(), []);
  const budgetDist = useMemo(() => getBudgetDistribution(), []);
  const bedroomDist = useMemo(() => getBedroomDistribution(), []);
  const propertyTypes = useMemo(() => getPropertyTypeDistribution(), []);
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [selectedPostcodes, setSelectedPostcodes] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [budgetRange, setBudgetRange] = useState<{ min: number; max: number }>({ min: 0, max: Infinity });
  const [retainedOnly, setRetainedOnly] = useState(false);
  const [feeOnly, setFeeOnly] = useState(false);
  const budgetLabel = BUDGET_PRESETS.find(p => p.min === budgetRange.min && p.max === budgetRange.max)?.label || "Custom";

  const toggleArea = (area: string) => {
    setSelectedAreas(prev => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area); else next.add(area);
      return next;
    });
  };

  const togglePostcode = (pc: string) => {
    setSelectedPostcodes(prev => {
      const next = new Set(prev);
      if (next.has(pc)) next.delete(pc); else next.add(pc);
      return next;
    });
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const filteredSignals = useMemo(() => {
    return signals.filter(s => {
      if (selectedAreas.size > 0 && !s.location.some(l => selectedAreas.has(l))) return false;
      if (selectedPostcodes.size > 0 && !s.postcodes.some(pc => selectedPostcodes.has(pc))) return false;
      if (selectedTypes.size > 0 && !selectedTypes.has(s.type)) return false;
      if (budgetRange.min > 0 || budgetRange.max < Infinity) {
        const val = parseBudgetValue(s.budget);
        if (val === null) return false;
        if (val < budgetRange.min || val > budgetRange.max) return false;
      }
      if (retainedOnly && s.retained !== "Yes") return false;
      if (feeOnly && s.feeRequired !== "Yes") return false;
      return true;
    });
  }, [selectedAreas, selectedPostcodes, selectedTypes, budgetRange, retainedOnly, feeOnly]);

  const topAreas = areaStats.slice(0, 10);

  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <div className="relative h-32 overflow-hidden">
        <img src={HERO_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1e23] via-[#1a1e23]/80 to-transparent" />
        <div className="relative z-10 h-full flex items-center px-6">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Conversation Intelligence</h1>
            <p className="text-[0.8rem] text-[#9ca3af] mt-0.5">Live command centre — Hampstead agent network</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-[#22272d]/80 backdrop-blur px-3 py-1.5 rounded-md border border-[#3a3f45]/50">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2ecc71] animate-live-pulse" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9ca3af]">Live Feed</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* KPI Bar */}
        <section>
          <SectionHeader>Executive Snapshot</SectionHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2 stagger-children">
            <MetricCard label="Messages" value={kpis.totalMessages} icon={MessageSquare} />
            <MetricCard label="Signals" value={kpis.actionableSignals} icon={Radio} accent />
            <MetricCard label="Buyer Searches" value={kpis.buyerSearches} icon={Search} accent />
            <MetricCard label="Tenant Searches" value={kpis.tenantSearches} icon={Home} />
            <MetricCard label="Seller Signals" value={kpis.sellerSignals} icon={TrendingUp} />
            <MetricCard label="Landlord Signals" value={kpis.landlordSignals} icon={Building} />
            <MetricCard label="For Sale" value={kpis.propertiesForSale} icon={ArrowUpRight} />
            <MetricCard label="For Rent" value={kpis.propertiesForRent} icon={Home} />
            <MetricCard label="Services" value={kpis.serviceRequests} icon={Wrench} />
            <MetricCard label="Alerts Sent" value={kpis.alertsSent} icon={Bell} accent />
            <MetricCard label="High Priority" value={kpis.highPriorityMatches} icon={AlertTriangle} accent />
          </div>
        </section>

        {/* Colour Legend */}
        <div className="flex flex-wrap items-center gap-4 px-1">
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">Signal Key:</span>
          {[
            { label: "Buyer", color: "#ef4444" },
            { label: "Tenant", color: "#3b82f6" },
            { label: "For Sale", color: "#d4a843" },
            { label: "For Rent", color: "#f59e0b" },
            { label: "Service", color: "#8b5cf6" },
          ].map(item => (
            <span key={item.label} className="flex items-center gap-1.5 text-[10px] text-[#9ca3af]">
              <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>

        {/* Multi-Select Filters */}
        <section className="bg-[#22272d]/50 border border-[#3a3f45]/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[#6b7280]">
              <Filter className="w-3.5 h-3.5" />
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em]">Filters</span>
            </div>
            <span className="text-[10px] text-[#6b7280]">
              {filteredSignals.length} signal{filteredSignals.length !== 1 ? "s" : ""}
              {(selectedAreas.size > 0 || selectedPostcodes.size > 0 || selectedTypes.size > 0 || budgetRange.min > 0 || budgetRange.max < Infinity || retainedOnly || feeOnly) && (
                <span className="text-[#77d5c0] ml-1">(active)</span>
              )}
            </span>
          </div>
          <MultiSelectChips label="Areas" options={ALL_AREAS} selected={selectedAreas} onToggle={toggleArea} onClear={() => setSelectedAreas(new Set())} />
          <MultiSelectChips label="Postcodes" options={ALL_POSTCODES} selected={selectedPostcodes} onToggle={togglePostcode} onClear={() => setSelectedPostcodes(new Set())} />
          <MultiSelectChips label="Signal Types" options={ALL_TYPES} selected={selectedTypes} onToggle={toggleType} onClear={() => setSelectedTypes(new Set())} colorMap={signalTypeColors} />

          {/* Budget Range Filter */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Budget Range</span>
              {(budgetRange.min > 0 || budgetRange.max < Infinity) && (
                <button onClick={() => setBudgetRange({ min: 0, max: Infinity })} className="flex items-center gap-0.5 text-[9px] text-[#77d5c0] hover:text-[#5bc4ad] transition-colors">
                  <X className="w-2.5 h-2.5" />Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BUDGET_PRESETS.map(preset => {
                const isActive = preset.min === budgetRange.min && preset.max === budgetRange.max;
                return (
                  <button
                    key={preset.label}
                    onClick={() => setBudgetRange({ min: preset.min, max: preset.max })}
                    className={`text-[11px] px-2.5 py-1 rounded-md border transition-all duration-150 font-medium ${
                      isActive
                        ? "border-[#77d5c0]/50 bg-[#77d5c0]/15 text-[#77d5c0]"
                        : "border-[#3a3f45]/50 text-[#6b7280] hover:text-[#9ca3af] hover:border-[#3a3f45]"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Retained & Fee Required Filters */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Quick Filters</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setRetainedOnly(!retainedOnly)}
                className={`text-[11px] px-2.5 py-1 rounded-md border transition-all duration-150 font-medium flex items-center gap-1.5 ${
                  retainedOnly
                    ? "border-[#d4a843]/50 bg-[#d4a843]/15 text-[#d4a843]"
                    : "border-[#3a3f45]/50 text-[#6b7280] hover:text-[#9ca3af] hover:border-[#3a3f45]"
                }`}
              >
                <Shield className="w-3 h-3" />
                Retained Only
              </button>
              <button
                onClick={() => setFeeOnly(!feeOnly)}
                className={`text-[11px] px-2.5 py-1 rounded-md border transition-all duration-150 font-medium flex items-center gap-1.5 ${
                  feeOnly
                    ? "border-[#77d5c0]/50 bg-[#77d5c0]/15 text-[#77d5c0]"
                    : "border-[#3a3f45]/50 text-[#6b7280] hover:text-[#9ca3af] hover:border-[#3a3f45]"
                }`}
              >
                <Banknote className="w-3 h-3" />
                Fee Required
              </button>
            </div>
          </div>
        </section>

        {/* Main Grid: Signal Feed + Geographic Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Signal Feed */}
          <div className="lg:col-span-2">
            <SectionHeader>Live Signal Feed</SectionHeader>
            <ScrollArea className="h-[520px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pr-3">
                {filteredSignals.map((signal, i) => (
                  <div key={signal.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <SignalCard signal={signal} />
                  </div>
                ))}
                {filteredSignals.length === 0 && (
                  <div className="col-span-2 flex flex-col items-center justify-center py-16 text-[#6b7280]">
                    <Search className="w-8 h-8 mb-3 opacity-40" />
                    <p className="text-sm">No signals match the selected filters</p>
                    <p className="text-xs mt-1">Try adjusting your area or type selections</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Geographic Intelligence */}
          <div>
            <SectionHeader>Geographic Intelligence</SectionHeader>
            <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-4 mb-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280] mb-3">Signal Concentration by Area</div>
              <div className="space-y-2.5">
                {topAreas.map((area) => {
                  const maxTotal = topAreas[0]?.total || 1;
                  return (
                    <div key={area.area}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-[#c9cdd3] truncate max-w-[140px]">{area.area}</span>
                        <span className="text-[10px] text-[#9ca3af]">{area.total} signals</span>
                      </div>
                      <div className="h-1.5 bg-[#3a3f45]/50 rounded-full overflow-hidden flex">
                        <div className="h-full bg-[#ef4444]" style={{ width: `${(area.buyers / maxTotal) * 100}%` }} />
                        <div className="h-full bg-[#3b82f6]" style={{ width: `${(area.tenants / maxTotal) * 100}%` }} />
                        <div className="h-full bg-[#d4a843]" style={{ width: `${(area.sales / maxTotal) * 100}%` }} />
                        <div className="h-full bg-[#f59e0b]" style={{ width: `${(area.rentals / maxTotal) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 mt-3 pt-2 border-t border-[#3a3f45]/40">
                <span className="flex items-center gap-1 text-[9px] text-[#9ca3af]"><span className="w-2 h-2 rounded-sm bg-[#ef4444]" />Buyers</span>
                <span className="flex items-center gap-1 text-[9px] text-[#9ca3af]"><span className="w-2 h-2 rounded-sm bg-[#3b82f6]" />Tenants</span>
                <span className="flex items-center gap-1 text-[9px] text-[#9ca3af]"><span className="w-2 h-2 rounded-sm bg-[#d4a843]" />Sales</span>
                <span className="flex items-center gap-1 text-[9px] text-[#9ca3af]"><span className="w-2 h-2 rounded-sm bg-[#f59e0b]" />Rentals</span>
              </div>
            </div>

            {/* Demand vs Supply */}
            <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280] mb-3">Demand vs Supply</div>
              <div className="space-y-2">
                {topAreas.slice(0, 6).map(area => (
                  <div key={area.area} className="flex items-center gap-2">
                    <span className="text-[11px] text-[#9ca3af] w-24 truncate">{area.area}</span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="flex-1 h-3 bg-[#3a3f45]/30 rounded overflow-hidden flex justify-end">
                        <div className="h-full bg-[#ef4444]/60 rounded-l" style={{ width: `${Math.min((area.buyers + area.tenants) * 12, 100)}%` }} />
                      </div>
                      <div className="w-px h-3 bg-[#6b7280]" />
                      <div className="flex-1 h-3 bg-[#3a3f45]/30 rounded overflow-hidden">
                        <div className="h-full bg-[#d4a843]/60 rounded-r" style={{ width: `${Math.min((area.sales + area.rentals) * 20, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-[#ef4444]">Demand</span>
                  <span className="text-[9px] text-[#d4a843]">Supply</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Opportunity Breakdown */}
        <section>
          <SectionHeader>Opportunity Breakdown</SectionHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Budget Distribution */}
            <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280] mb-3">Budget Distribution</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={budgetDist} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3f45" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: "#22272d", border: "1px solid #3a3f45", borderRadius: 6, fontSize: 11 }} labelStyle={{ color: "#9ca3af" }} itemStyle={{ color: "#77d5c0" }} />
                  <Bar dataKey="count" fill="#77d5c0" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Bedroom Distribution */}
            <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280] mb-3">Bedroom Demand</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={bedroomDist} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3a3f45" vertical={false} />
                  <XAxis dataKey="beds" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ backgroundColor: "#22272d", border: "1px solid #3a3f45", borderRadius: 6, fontSize: 11 }} labelStyle={{ color: "#9ca3af" }} itemStyle={{ color: "#d4a843" }} />
                  <Bar dataKey="count" fill="#d4a843" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Property Type Distribution */}
            <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280] mb-3">Property Types</div>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={propertyTypes} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="count" nameKey="type">
                    {propertyTypes.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: "#22272d", border: "1px solid #3a3f45", borderRadius: 6, fontSize: 11 }} labelStyle={{ color: "#9ca3af" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {propertyTypes.slice(0, 5).map((pt, i) => (
                  <span key={pt.type} className="flex items-center gap-1 text-[9px] text-[#9ca3af]">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: CHART_COLORS[i] }} />{pt.type}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Alert Activity */}
        <section>
          <SectionHeader>Alert Activity</SectionHeader>
          <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#3a3f45]/40">
                    <th className="text-left py-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Recipient</th>
                    <th className="text-left py-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Area</th>
                    <th className="text-left py-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Type</th>
                    <th className="text-left py-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Summary</th>
                    <th className="text-left py-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">From</th>
                    <th className="text-left py-2.5 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.slice(0, 12).map(alert => (
                    <tr key={alert.id} className="border-b border-[#3a3f45]/20 hover:bg-[#2a2f35]/50 transition-colors">
                      <td className="py-2 px-3 text-[#c9cdd3]">{alert.recipientAgent}</td>
                      <td className="py-2 px-3 text-[#9ca3af]">{alert.matchingArea}</td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: `${signalTypeColors[alert.signalType] || "#6b7280"}20`, color: signalTypeColors[alert.signalType] || "#6b7280" }}>
                          {alert.signalType}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[#9ca3af] max-w-[280px] truncate">{alert.summary}</td>
                      <td className="py-2 px-3 text-[#9ca3af]">{alert.originatingAgent}</td>
                      <td className="py-2 px-3">
                        <Badge className={`text-[10px] px-1.5 py-0 h-5 border-0 font-medium ${
                          alert.priority === "High" ? "bg-[#e74c3c]/20 text-[#e74c3c]" :
                          alert.priority === "Medium" ? "bg-[#d4a843]/20 text-[#d4a843]" :
                          "bg-[#6b7280]/20 text-[#6b7280]"
                        }`}>
                          {alert.priority}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Watchlists */}
        <section className="pb-8">
          <SectionHeader>Saved Watchlists</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {watchlists.map(wl => (
              <div key={wl.id} className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-3.5 hover:border-[#77d5c0]/30 transition-colors cursor-pointer group">
                <div className="flex items-center justify-between mb-2">
                  <Bookmark className="w-3.5 h-3.5 text-[#77d5c0] group-hover:scale-110 transition-transform" />
                  <span className="text-lg font-bold text-[#77d5c0]">{wl.matchCount}</span>
                </div>
                <h3 className="text-xs font-semibold text-white mb-1">{wl.name}</h3>
                <p className="text-[10px] text-[#6b7280]">{wl.areas.join(", ")}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {wl.signalTypes.map(st => (
                    <span key={st} className="text-[9px] px-1.5 py-0.5 rounded bg-[#3a3f45]/50 text-[#9ca3af]">{st}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
