// ============================================================
// DDRE War Room — Dashboard Page
// Colour-coded signal cards: parsed data prominent, raw text demoted
// Red = Buyer, Blue = Tenant, Gold = For Sale, Orange = For Rent, Purple = Service
// ============================================================

import { useState, useMemo } from "react";
import {
  MessageSquare, Radio, Search, Home,
  AlertTriangle, TrendingUp, Users, MapPin,
  Filter, Bookmark, ArrowUpRight, X, Banknote, BedDouble,
  User, Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { useKPIs, useDistributions } from "@/hooks/queries/useAnalytics";
import { useSignals } from "@/hooks/queries/useSignals";
import { useAlerts } from "@/hooks/queries/useAlerts";

// Local type definitions (replaces mock Signal type)
type SignalStatus = "new" | "reviewed" | "alerted" | "matched" | "New" | "Reviewed" | "Alerted" | "Matched";

interface ApiSignal {
  id: string;
  messageId: string;
  type: string;
  classificationMethod: string;
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
  status: string;
  reviewedBy: string | null;
  actionable: boolean;
  createdAt: string;
  updatedAt: string;
}

const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663265683302/Mchx73LWdrS7gUExt8LJHT/hero-dark-network-jWoKoERoTMuRyKq9Q6VWGu.webp";

const statusColors: Record<string, string> = {
  New: "bg-[#77d5c0]/20 text-[#77d5c0]",
  new: "bg-[#77d5c0]/20 text-[#77d5c0]",
  Reviewed: "bg-[#3b82f6]/20 text-[#3b82f6]",
  reviewed: "bg-[#3b82f6]/20 text-[#3b82f6]",
  Alerted: "bg-[#d4a843]/20 text-[#d4a843]",
  alerted: "bg-[#d4a843]/20 text-[#d4a843]",
  Matched: "bg-[#2ecc71]/20 text-[#2ecc71]",
  matched: "bg-[#2ecc71]/20 text-[#2ecc71]",
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

function formatBudget(budgetMin: number | null, budgetMax: number | null): string {
  if (budgetMax === null && budgetMin === null) return "—";
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}m`;
    if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}k`;
    return `£${n}`;
  };
  if (budgetMax !== null && budgetMin !== null && budgetMin > 0) return `${fmt(budgetMin)}–${fmt(budgetMax)}`;
  if (budgetMax !== null) return `Up to ${fmt(budgetMax)}`;
  if (budgetMin !== null) return `From ${fmt(budgetMin)}`;
  return "—";
}

function SignalCard({ signal }: { signal: ApiSignal }) {
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
              {formatSignalDate(signal.createdAt)}
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
              <span className="text-[13px] font-bold text-white">{formatBudget(signal.budgetMin, signal.budgetMax)}</span>
            </div>
          </div>

          {/* Bedrooms */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.1em] text-[#6b7280] mb-0.5">Beds</div>
            <div className="flex items-center gap-1">
              <BedDouble className="w-3.5 h-3.5 text-[#6b7280]" />
              <span className="text-[13px] font-bold text-white">{signal.bedrooms !== null ? signal.bedrooms : "—"}</span>
            </div>
          </div>

          {/* Property Type */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.1em] text-[#6b7280] mb-0.5">Type</div>
            <div className="flex items-center gap-1">
              <Home className="w-3.5 h-3.5 text-[#6b7280]" />
              <span className="text-xs font-medium text-[#c9cdd3]">{signal.propertyType ?? "—"}</span>
            </div>
          </div>

          {/* Reviewed By */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.1em] text-[#6b7280] mb-0.5">Reviewed By</div>
            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-[#6b7280]" />
              <span className="text-xs font-medium text-[#c9cdd3] truncate">{signal.reviewedBy ?? "—"}</span>
            </div>
          </div>
        </div>

        {/* Extra tags row */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {signal.outsideSpace === true && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3a3f45]/50 text-[#9ca3af]">Outside Space</span>
          )}
          {signal.condition && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3a3f45]/50 text-[#9ca3af]">{signal.condition}</span>
          )}
          {signal.parking === true && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3a3f45]/50 text-[#9ca3af]">Parking</span>
          )}
          {signal.sqft !== null && (
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
  const { data: kpiData } = useKPIs();
  const { data: distData } = useDistributions();
  const { data: signalsData } = useSignals({ limit: 100 });
  const { data: alertsData } = useAlerts({ limit: 10 });
  const recentAlerts = alertsData?.alerts ?? [];

  // Default values while loading
  const kpis = kpiData ?? {
    totalMessages: 0,
    totalSignals: 0,
    actionableSignals: 0,
    buyerSearches: 0,
    tenantSearches: 0,
    propertiesForSale: 0,
    propertiesForRent: 0,
    pendingReview: 0,
    totalAgents: 0,
  };

  // Map API distribution shapes to what the charts expect
  const areaStats: { area: string; total: number; buyers: number; tenants: number; sales: number; rentals: number }[] =
    ((distData?.areaStats ?? []) as { area: string; count: number }[]).map(r => ({
      area: r.area,
      total: r.count,
      buyers: 0,
      tenants: 0,
      sales: 0,
      rentals: 0,
    }));
  const budgetDist: { label: string; count: number }[] =
    ((distData?.budgetDistribution ?? []) as { range: string; count: number }[]).map(r => ({
      label: r.range,
      count: r.count,
    }));
  const bedroomDist: { beds: string; count: number }[] =
    ((distData?.bedroomDistribution ?? []) as { bedrooms: number; count: number }[]).map(r => ({
      beds: String(r.bedrooms),
      count: r.count,
    }));
  const propertyTypes: { type: string; count: number }[] = (distData?.typeDistribution ?? []) as { type: string; count: number }[];

  const allSignals: ApiSignal[] = signalsData?.signals ?? [];

  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [selectedPostcodes, setSelectedPostcodes] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [budgetRange, setBudgetRange] = useState<{ min: number; max: number }>({ min: 0, max: Infinity });

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
    return allSignals.filter(s => {
      if (selectedAreas.size > 0 && !s.location.some(l => selectedAreas.has(l))) return false;
      if (selectedPostcodes.size > 0 && !s.postcodes.some(pc => selectedPostcodes.has(pc))) return false;
      if (selectedTypes.size > 0 && !selectedTypes.has(s.type)) return false;
      if (budgetRange.min > 0 || budgetRange.max < Infinity) {
        // Use budgetMax for filtering; skip signals with no budget data
        const val = s.budgetMax ?? s.budgetMin;
        if (val === null) return false;
        if (val < budgetRange.min || val > budgetRange.max) return false;
      }
      // API signals don't have retained/feeRequired fields; skip those filters
      return true;
    });
  }, [allSignals, selectedAreas, selectedPostcodes, selectedTypes, budgetRange]);

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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 gap-2 stagger-children">
            <MetricCard label="Messages" value={kpis.totalMessages} icon={MessageSquare} />
            <MetricCard label="Signals" value={kpis.actionableSignals} icon={Radio} accent />
            <MetricCard label="Buyer Searches" value={kpis.buyerSearches} icon={Search} accent />
            <MetricCard label="Tenant Searches" value={kpis.tenantSearches} icon={Home} />
            <MetricCard label="For Sale" value={kpis.propertiesForSale} icon={ArrowUpRight} />
            <MetricCard label="For Rent" value={kpis.propertiesForRent} icon={Home} />
            <MetricCard label="Pending Review" value={kpis.pendingReview} icon={AlertTriangle} accent />
            <MetricCard label="Total Signals" value={kpis.totalSignals} icon={TrendingUp} />
            <MetricCard label="Agents" value={kpis.totalAgents} icon={Users} />
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
              {(selectedAreas.size > 0 || selectedPostcodes.size > 0 || selectedTypes.size > 0 || budgetRange.min > 0 || budgetRange.max < Infinity) && (
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
                  {recentAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[10px] text-[#6b7280]">
                        No alerts yet — ingest matching messages to generate alerts
                      </td>
                    </tr>
                  ) : (
                    recentAlerts.map((alert: any) => (
                      <tr key={alert.id} className="border-b border-[#3a3f45]/20 hover:bg-[#1a1e23]/40 transition-colors">
                        <td className="py-2 px-3 text-[#c9cdd3] truncate max-w-[120px]">{alert.recipientName ?? "—"}</td>
                        <td className="py-2 px-3 text-[#c9cdd3] truncate max-w-[100px]">{alert.area ?? "—"}</td>
                        <td className="py-2 px-3 text-[#c9cdd3]">{alert.type ?? "—"}</td>
                        <td className="py-2 px-3 text-[#9ca3af] truncate max-w-[200px]">{alert.summary ?? "—"}</td>
                        <td className="py-2 px-3 text-[#6b7280] whitespace-nowrap">
                          {new Date(alert.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            alert.priority === "high" ? "bg-red-500/20 text-red-400" :
                            alert.priority === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-green-500/20 text-green-400"
                          }`}>{alert.priority ?? "—"}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Watchlists */}
        <section className="pb-8">
          <SectionHeader>Saved Watchlists</SectionHeader>
          <div className="flex items-center justify-center py-8 text-[#6b7280]">
            <Bookmark className="w-5 h-5 mr-2 opacity-40" />
            <span className="text-sm">Watchlists coming soon</span>
          </div>
        </section>
      </div>
    </div>
  );
}
