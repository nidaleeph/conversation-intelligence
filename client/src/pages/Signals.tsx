import { useState } from "react";
import { Radio, Search, MapPin, Banknote, BedDouble } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSignals } from "@/hooks/queries/useSignals";

const signalTypeColors: Record<string, string> = {
  "Buyer Search": "#ef4444",
  "Tenant Search": "#3b82f6",
  "Property for Sale": "#d4a843",
  "Property for Rent": "#f59e0b",
  "Service Request": "#8b5cf6",
  "Seller Signal": "#ec4899",
  "Landlord Signal": "#f97316",
  "Market Commentary": "#6b7280",
  "Social": "#4b5563",
};

function formatBudget(min: number | null, max: number | null): string {
  if (!max && !min) return "—";
  const fmt = (n: number) =>
    n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(1)}m` : `£${(n / 1_000).toFixed(0)}k`;
  if (max && !min) return `Up to ${fmt(max)}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt(min || max || 0);
}

export default function Signals() {
  const [typeFilter, setTypeFilter] = useState<string>("");
  const { data, isLoading } = useSignals({
    type: typeFilter || undefined,
    limit: 100,
  });

  const signals = data?.signals ?? [];
  const total = data?.total ?? 0;

  const types = [
    "Buyer Search", "Tenant Search", "Property for Sale", "Property for Rent",
    "Service Request", "Landlord Signal", "Seller Signal",
  ];

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-[#f1f2f7]">Signals</h1>
        <p className="text-xs text-[#6b7280] mt-0.5">{total} classified signals</p>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setTypeFilter("")}
          className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full transition-all ${
            !typeFilter ? "bg-[#77d5c0]/20 text-[#77d5c0]" : "bg-[#22272d] text-[#6b7280] hover:text-[#9ca3af]"
          }`}
        >
          All
        </button>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t === typeFilter ? "" : t)}
            className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full transition-all`}
            style={{
              backgroundColor: typeFilter === t ? `${signalTypeColors[t]}20` : "#22272d",
              color: typeFilter === t ? signalTypeColors[t] : "#6b7280",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Signal cards */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#77d5c0] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#6b7280]">
            <Radio className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No signals yet</p>
            <p className="text-xs mt-1">Ingest messages to generate signals</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {signals.map((signal: any) => {
              const color = signalTypeColors[signal.type] || "#6b7280";
              return (
                <div
                  key={signal.id}
                  className="bg-[#22272d] rounded-lg p-4 border hover:brightness-110 transition-all"
                  style={{ borderColor: `${color}30`, borderLeftWidth: "4px", borderLeftColor: color }}
                >
                  {/* Type badge + confidence */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {signal.type}
                    </span>
                    <span className="text-[10px] text-[#6b7280]">
                      {Math.round(signal.confidence * 100)}% · {signal.classificationMethod}
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="text-xs text-[#f1f2f7] mb-3 line-clamp-2">{signal.summary}</p>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {signal.location?.length > 0 && (
                      <div className="col-span-2 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#6b7280]" />
                        <span className="text-[11px] text-[#9ca3af]">{signal.location.join(", ")}</span>
                      </div>
                    )}
                    {(signal.budgetMin || signal.budgetMax) && (
                      <div className="flex items-center gap-1">
                        <Banknote className="w-3 h-3 text-[#6b7280]" />
                        <span className="text-[11px] text-white font-semibold">
                          {formatBudget(signal.budgetMin, signal.budgetMax)}
                        </span>
                      </div>
                    )}
                    {signal.bedrooms && (
                      <div className="flex items-center gap-1">
                        <BedDouble className="w-3 h-3 text-[#6b7280]" />
                        <span className="text-[11px] text-white font-semibold">{signal.bedrooms} bed</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#2a2f35]">
                    <span className="text-[10px] text-[#6b7280]">
                      {new Date(signal.createdAt).toLocaleString()}
                    </span>
                    <Badge className={`text-[9px] px-1.5 py-0 h-4 border-0 ${
                      signal.status === "new" ? "bg-[#77d5c0]/20 text-[#77d5c0]" :
                      signal.status === "reviewed" ? "bg-[#3b82f6]/20 text-[#3b82f6]" :
                      signal.status === "matched" ? "bg-[#d4a843]/20 text-[#d4a843]" :
                      "bg-[#6b7280]/20 text-[#6b7280]"
                    }`}>
                      {signal.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
