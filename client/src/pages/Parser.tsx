// ============================================================
// DDRE War Room — Parser Page
// Raw message viewer, classification engine, review queue,
// signal extraction, confidence scoring
// ============================================================

import { useState, useMemo } from "react";
import {
  Search, CheckCircle2, XCircle, AlertCircle,
  Zap, ArrowRight, Clock, Sparkles,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useMessages } from "@/hooks/queries/useMessages";
import { useSignals, useReviewSignal } from "@/hooks/queries/useSignals";
import { toast } from "sonner";

const SIGNAL_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663265683302/Mchx73LWdrS7gUExt8LJHT/hero-signal-flow-NJjFpRVPF2sCqBjyqVXHwV.webp";

const classificationColors: Record<string, string> = {
  "Buyer Search": "#77d5c0",
  "Tenant Search": "#3b82f6",
  "Property for Sale": "#d4a843",
  "Property for Rent": "#f59e0b",
  "Service Request": "#8b5cf6",
  "Service Reply": "#a78bfa",
  "Contextual Reply": "#6366f1",
  "Social": "#6b7280",
  "Irrelevant": "#4b5563",
  "Market Commentary": "#ec4899",
  "Seller Signal": "#ef4444",
  "Landlord Signal": "#f97316",
};

// Enriched message shape combining API message + matched signal fields
interface EnrichedMessage {
  id: string;
  senderName: string;
  platform: string;
  createdAt: string;
  rawText: string;
  classification: string;
  confidence: number;
  actionable: boolean;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#77d5c0] mb-3">
      {children}
    </h2>
  );
}

function RawMessageRow({ msg, matchedSignal, isExpanded, onToggle }: {
  msg: EnrichedMessage;
  matchedSignal: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const color = classificationColors[msg.classification] || "#6b7280";

  return (
    <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg overflow-hidden hover:border-[#3a3f45] transition-colors">
      {/* Header Row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-white">{msg.senderName}</span>
            <span className="text-[10px] text-[#6b7280]">{msg.platform}</span>
            <span className="text-[10px] text-[#6b7280]">
              {new Date(msg.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} {new Date(msg.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p className="text-[11px] text-[#9ca3af] truncate">{msg.rawText}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[10px] px-2 py-0.5 rounded font-medium"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {msg.classification}
          </span>
          <div className="flex items-center gap-1">
            <div className="w-10 h-1 bg-[#3a3f45] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${msg.confidence * 100}%`, backgroundColor: color }} />
            </div>
            <span className="text-[10px] text-[#6b7280]">{Math.round(msg.confidence * 100)}%</span>
          </div>
          {msg.actionable ? (
            <Zap className="w-3.5 h-3.5 text-[#77d5c0]" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-[#4b5563]" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-[#6b7280]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#6b7280]" />
          )}
        </div>
      </button>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[#3a3f45]/30">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
            {/* Raw Text */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280] mb-1.5">Raw Message</div>
              <div className="bg-[#1a1e23] rounded-md p-3 text-[12px] text-[#c9cdd3] leading-relaxed whitespace-pre-wrap font-mono">
                {msg.rawText}
              </div>
            </div>

            {/* Extracted Signal */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280] mb-1.5">Extracted Signal</div>
              {matchedSignal ? (
                <div className="bg-[#1a1e23] rounded-md p-3 space-y-1.5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2ecc71]" />
                    <span className="text-[11px] font-semibold text-[#2ecc71]">Signal Extracted</span>
                  </div>
                  <Row label="Type" value={matchedSignal.type ?? "-"} />
                  <Row label="Location" value={matchedSignal.location?.join(", ") ?? "-"} />
                  <Row label="Budget Min" value={matchedSignal.budgetMin != null ? `£${matchedSignal.budgetMin.toLocaleString()}` : "-"} />
                  <Row label="Budget Max" value={matchedSignal.budgetMax != null ? `£${matchedSignal.budgetMax.toLocaleString()}` : "-"} />
                  <Row label="Property" value={matchedSignal.propertyType ?? "-"} />
                  <Row label="Bedrooms" value={matchedSignal.bedrooms != null ? String(matchedSignal.bedrooms) : "-"} />
                  <Row label="Sqft" value={matchedSignal.sqft != null ? String(matchedSignal.sqft) : "-"} />
                  <Row label="Outside Space" value={matchedSignal.outsideSpace != null ? (matchedSignal.outsideSpace ? "Yes" : "No") : "-"} />
                  <Row label="Condition" value={matchedSignal.condition ?? "-"} />
                  <Row label="Status" value={matchedSignal.status ?? "-"} />
                  {matchedSignal.summary && (
                    <Row label="Summary" value={matchedSignal.summary} />
                  )}
                </div>
              ) : (
                <div className="bg-[#1a1e23] rounded-md p-3 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-[#6b7280]" />
                  <span className="text-[11px] text-[#6b7280]">
                    {msg.actionable ? "Signal pending extraction" : "Non-actionable — no signal generated"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (value === "-" || value === "") return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] text-[#6b7280] w-20 shrink-0">{label}</span>
      <span className="text-[11px] text-[#c9cdd3]">{value}</span>
    </div>
  );
}

function ReviewCard({ item, onAction }: {
  item: any;
  onAction: (id: string, action: "approve" | "reject") => void;
}) {
  const suggestedClassification = item.type ?? "Unclassified";
  const color = classificationColors[suggestedClassification] || "#6b7280";
  const confidence = typeof item.confidence === "number" ? item.confidence : 0;
  const displayText = item.summary || "(no summary available)";
  const reasonFlagged = confidence < 0.85
    ? `Low confidence score (${Math.round(confidence * 100)}%) — manual review required`
    : "Flagged for manual review";

  return (
    <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-4 hover:border-[#d4a843]/30 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-[#d4a843]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#d4a843]">Needs Review</span>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded font-medium"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {suggestedClassification}
        </span>
      </div>
      <p className="text-[12px] text-[#c9cdd3] leading-relaxed mb-2">{displayText}</p>
      <div className="bg-[#1a1e23] rounded px-2.5 py-1.5 mb-3">
        <span className="text-[10px] text-[#6b7280]">Reason flagged: </span>
        <span className="text-[10px] text-[#d4a843]">{reasonFlagged}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[#6b7280]">Confidence</span>
          <div className="w-14 h-1 bg-[#3a3f45] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#d4a843]" style={{ width: `${confidence * 100}%` }} />
          </div>
          <span className="text-[10px] text-[#9ca3af]">{Math.round(confidence * 100)}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-[#2ecc71] hover:bg-[#2ecc71]/10 hover:text-[#2ecc71]"
            onClick={() => onAction(item.id, "approve")}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-[#e74c3c] hover:bg-[#e74c3c]/10 hover:text-[#e74c3c]"
            onClick={() => onAction(item.id, "reject")}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Parser() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: messagesData, isLoading: messagesLoading } = useMessages({
    search: searchQuery || undefined,
    page: 1,
    limit: 100,
  });
  const { data: signalsData } = useSignals({ limit: 100 });
  const { data: reviewData } = useSignals({ needsReview: true, limit: 50 });
  const reviewMutation = useReviewSignal();

  const rawMessages = messagesData?.messages ?? [];
  const allSignals = signalsData?.signals ?? [];
  const reviewQueue = reviewData?.signals ?? [];

  // Join messages with their classification data from signals
  const messagesWithClassification = useMemo<EnrichedMessage[]>(() => {
    return rawMessages.map((msg: any) => {
      const signal = allSignals.find((s: any) => s.messageId === msg.id);
      return {
        id: msg.id,
        senderName: msg.senderName,
        platform: msg.platform,
        createdAt: msg.createdAt,
        rawText: msg.rawText,
        classification: signal?.type ?? "Unclassified",
        confidence: signal?.confidence ?? 0,
        actionable: signal?.actionable ?? false,
      };
    });
  }, [rawMessages, allSignals]);

  const filteredMessages = useMemo(() => {
    return messagesWithClassification.filter(msg => {
      if (classFilter !== "all" && msg.classification !== classFilter) return false;
      // Search is already applied server-side via the API query, but also filter locally
      // for classification filter changes without re-fetching
      return true;
    });
  }, [messagesWithClassification, classFilter]);

  const classificationStats = useMemo(() => {
    const stats: Record<string, number> = {};
    messagesWithClassification.forEach(msg => {
      stats[msg.classification] = (stats[msg.classification] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([classification, count]) => ({ classification, count }))
      .sort((a, b) => b.count - a.count);
  }, [messagesWithClassification]);

  const handleReviewAction = (id: string, action: "approve" | "reject") => {
    reviewMutation.mutate(
      { id, review: { approved: action === "approve" } },
      {
        onSuccess: () => {
          toast.success(
            action === "approve"
              ? "Classification approved — signal will be extracted"
              : "Classification rejected — message reclassified",
            {
              style: { backgroundColor: "#22272d", border: "1px solid #3a3f45", color: "#c9cdd3" },
            }
          );
        },
      }
    );
  };

  const actionableCount = messagesWithClassification.filter(m => m.actionable).length;
  const avgConfidence = messagesWithClassification.length > 0
    ? Math.round(messagesWithClassification.reduce((a, m) => a + m.confidence, 0) / messagesWithClassification.length * 100)
    : 0;
  const extractionRate = actionableCount > 0
    ? Math.round((allSignals.length / actionableCount) * 100)
    : 0;

  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <div className="relative h-28 overflow-hidden">
        <img src={SIGNAL_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1e23] via-[#1a1e23]/80 to-transparent" />
        <div className="relative z-10 h-full flex items-center px-6">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Signal Parser</h1>
            <p className="text-[0.8rem] text-[#9ca3af] mt-0.5">Raw message classification and signal extraction engine</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Stats Bar */}
        <section>
          <SectionHeader>Classification Engine</SectionHeader>
          {messagesLoading ? (
            <div className="text-[11px] text-[#6b7280] py-4">Loading classifications...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {classificationStats.map(stat => {
                const color = classificationColors[stat.classification] || "#6b7280";
                return (
                  <button
                    key={stat.classification}
                    onClick={() => setClassFilter(classFilter === stat.classification ? "all" : stat.classification)}
                    className={`bg-[#22272d] border rounded-lg p-3 text-left transition-all ${
                      classFilter === stat.classification
                        ? "border-[#77d5c0]/50"
                        : "border-[#3a3f45]/50 hover:border-[#3a3f45]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-[10px] text-[#6b7280] truncate">{stat.classification}</span>
                    </div>
                    <span className="text-lg font-bold" style={{ color }}>{stat.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Search & Filters */}
        <section className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b7280]" />
            <input
              type="text"
              placeholder="Search messages or agents..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-[#22272d] border border-[#3a3f45]/50 rounded-md text-[#c9cdd3] placeholder:text-[#6b7280] focus:border-[#77d5c0]/50 focus:outline-none transition-colors"
            />
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-44 h-8 text-xs bg-[#22272d] border-[#3a3f45]/50 text-[#c9cdd3]">
              <SelectValue placeholder="All Classifications" />
            </SelectTrigger>
            <SelectContent className="bg-[#22272d] border-[#3a3f45]">
              <SelectItem value="all" className="text-xs text-[#c9cdd3]">All Classifications</SelectItem>
              {classificationStats.map(s => (
                <SelectItem key={s.classification} value={s.classification} className="text-xs text-[#c9cdd3]">{s.classification}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[10px] text-[#6b7280] ml-auto">{filteredMessages.length} messages</span>
        </section>

        {/* Main Grid: Message Feed + Review Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Message Feed */}
          <div className="lg:col-span-2">
            <SectionHeader>Raw Message Feed</SectionHeader>
            {messagesLoading ? (
              <div className="flex items-center justify-center h-40 text-[11px] text-[#6b7280]">
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Loading messages...
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 pr-3">
                  {filteredMessages.length > 0 ? (
                    filteredMessages.map(msg => {
                      const matchedSignal = allSignals.find((s: any) => s.messageId === msg.id);
                      return (
                        <RawMessageRow
                          key={msg.id}
                          msg={msg}
                          matchedSignal={matchedSignal}
                          isExpanded={expandedId === msg.id}
                          onToggle={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
                        />
                      );
                    })
                  ) : (
                    <div className="flex items-center justify-center h-40 text-[11px] text-[#6b7280]">
                      No messages found
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Review Queue */}
          <div>
            <SectionHeader>Human Review Queue</SectionHeader>
            <div className="space-y-3">
              {reviewQueue.length > 0 ? (
                reviewQueue.map((item: any) => (
                  <ReviewCard key={item.id} item={item} onAction={handleReviewAction} />
                ))
              ) : (
                <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[#2ecc71] mx-auto mb-2" />
                  <p className="text-xs text-[#9ca3af]">All items reviewed</p>
                  <p className="text-[10px] text-[#6b7280] mt-1">Queue is clear — no pending classifications</p>
                </div>
              )}
            </div>

            {/* Parser Stats */}
            <div className="mt-5">
              <SectionHeader>Parser Performance</SectionHeader>
              <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-4 space-y-3">
                <StatRow label="Total Processed" value={messagesWithClassification.length.toString()} />
                <StatRow label="Actionable" value={actionableCount.toString()} accent />
                <StatRow label="Non-Actionable" value={(messagesWithClassification.length - actionableCount).toString()} />
                <StatRow label="Signals Extracted" value={allSignals.length.toString()} accent />
                <StatRow label="Avg. Confidence" value={`${avgConfidence}%`} />
                <StatRow label="Pending Review" value={reviewQueue.length.toString()} />
                <div className="pt-2 border-t border-[#3a3f45]/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#6b7280]">Extraction Rate</span>
                    <span className="text-[10px] text-[#77d5c0] font-semibold">
                      {extractionRate}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#3a3f45]/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#77d5c0] rounded-full"
                      style={{ width: `${Math.min(extractionRate, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Classification Rules */}
            <div className="mt-5">
              <SectionHeader>Classification Rules</SectionHeader>
              <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-4 space-y-2">
                <RuleRow
                  trigger="Budget + Beds + Location"
                  result="Buyer Search"
                  color="#77d5c0"
                />
                <RuleRow
                  trigger="Rental + PCM + Location"
                  result="Tenant Search"
                  color="#3b82f6"
                />
                <RuleRow
                  trigger="Address + Price + Sqft"
                  result="Property for Sale"
                  color="#d4a843"
                />
                <RuleRow
                  trigger="Architect / Surveyor / Service"
                  result="Service Request"
                  color="#8b5cf6"
                />
                <RuleRow
                  trigger="No property keywords"
                  result="Social / Irrelevant"
                  color="#6b7280"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-[#6b7280]">{label}</span>
      <span className={`text-[11px] font-semibold ${accent ? "text-[#77d5c0]" : "text-[#c9cdd3]"}`}>{value}</span>
    </div>
  );
}

function RuleRow({ trigger, result, color }: { trigger: string; result: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Sparkles className="w-3 h-3 text-[#6b7280] shrink-0" />
      <span className="text-[10px] text-[#9ca3af] flex-1">{trigger}</span>
      <ArrowRight className="w-3 h-3 text-[#4b5563]" />
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}20`, color }}>
        {result}
      </span>
    </div>
  );
}
