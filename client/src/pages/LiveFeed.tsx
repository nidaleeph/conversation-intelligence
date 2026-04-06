// ============================================================
// DDRE War Room — Live WhatsApp Ingestion Feed
// Real-time message simulation, auto-classification pipeline,
// signal extraction, speed controls, manual message input
// ============================================================

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, RotateCcw, Zap, MessageSquare, Radio, CheckCircle2,
  AlertCircle, Clock, ArrowRight, Send, Gauge, Activity, Eye,
  ChevronDown, ChevronUp, MapPin, TrendingUp, Users, Home,
  Sparkles, X, Loader2, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIngestionEngine, type IngestedMessage, type IngestionPhase } from "@/hooks/useIngestionEngine";
import { type SignalType } from "@shared/types";
import { ingestMessage as apiIngestMessage } from "@/api/messages";
import { useWebSocketEvent } from "@/hooks/useWebSocket";

const LONDON_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663265683302/Mchx73LWdrS7gUExt8LJHT/hero-london-aerial-Rg8Bq5mRbAGvYzNpjFLFJb.webp";

const phaseConfig: Record<IngestionPhase, { label: string; color: string; icon: React.ElementType; bgColor: string }> = {
  idle: { label: "Idle", color: "#6b7280", icon: Clock, bgColor: "#6b7280" },
  receiving: { label: "Receiving", color: "#3b82f6", icon: MessageSquare, bgColor: "#3b82f6" },
  classifying: { label: "Classifying", color: "#d4a843", icon: Sparkles, bgColor: "#d4a843" },
  extracting: { label: "Extracting", color: "#8b5cf6", icon: Zap, bgColor: "#8b5cf6" },
  complete: { label: "Complete", color: "#77d5c0", icon: CheckCircle2, bgColor: "#77d5c0" },
};

const classificationColors: Record<string, string> = {
  "Buyer Search": "#ef4444",     // RED
  "Tenant Search": "#3b82f6",    // BLUE
  "Property for Sale": "#d4a843", // GOLD
  "Property for Rent": "#f59e0b", // ORANGE
  "Service Request": "#8b5cf6",   // PURPLE
  "Market Commentary": "#6b7280", // GREY
  "Social": "#4b5563",            // DARK GREY
  "Irrelevant": "#374151",        // MUTED
  "Seller Signal": "#ec4899",     // PINK
  "Landlord Signal": "#f97316",   // DEEP ORANGE
};

function PipelineStage({ label, active, completed, color }: {
  label: string; active: boolean; completed: boolean; color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2.5 h-2.5 rounded-full border-2 transition-all duration-300 ${
          completed ? "scale-100" : active ? "scale-110 animate-pulse" : "scale-75 opacity-40"
        }`}
        style={{
          borderColor: completed || active ? color : "#3a3f45",
          backgroundColor: completed ? color : "transparent",
        }}
      />
      <span className={`text-[10px] font-medium transition-colors ${
        completed ? "text-[#c9cdd3]" : active ? "text-white" : "text-[#4a5060]"
      }`}>
        {label}
      </span>
    </div>
  );
}

function MessageCard({ item, expanded, onToggle }: {
  item: IngestedMessage; expanded: boolean; onToggle: () => void;
}) {
  const phase = phaseConfig[item.phase];
  const PhaseIcon = phase.icon;
  const classColor = classificationColors[item.message.classification] || "#6b7280";
  const isProcessing = item.phase === "receiving" || item.phase === "classifying" || item.phase === "extracting";

  return (
    <div
      className="bg-[#22272d] rounded-lg overflow-hidden transition-all duration-300"
      style={{
        borderLeft: `4px solid ${classColor}`,
        border: `1px solid ${classColor}30`,
        borderLeftWidth: "4px",
        borderLeftColor: classColor,
      }}
    >
      {/* Processing indicator bar */}
      {isProcessing && (
        <div className="h-0.5 w-full overflow-hidden">
          <div
            className="h-full animate-pulse"
            style={{
              backgroundColor: phase.bgColor,
              width: item.phase === "receiving" ? "33%" : item.phase === "classifying" ? "66%" : "90%",
              transition: "width 0.5s ease",
            }}
          />
        </div>
      )}

      <div className="p-3.5">
        {/* Header: Sender + Date/Time + Classification badge + Phase */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-md flex items-center justify-center ${isProcessing ? "animate-pulse" : ""}`}
              style={{ backgroundColor: `${phase.bgColor}20` }}
            >
              <PhaseIcon className="w-3 h-3" style={{ color: phase.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">{item.message.sender}</span>
                <span className="flex items-center gap-1 text-[9px] text-[#6b7280]">
                  <Calendar className="w-2.5 h-2.5" />
                  {new Date(item.message.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, {new Date(item.message.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] text-[#6b7280]">{item.message.id}</span>
                <span className="text-[9px] text-[#4a5060]">|</span>
                <span className="text-[9px]" style={{ color: phase.color }}>{phase.label}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {item.phase !== "receiving" && (
              <span
                className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide"
                style={{ backgroundColor: `${classColor}25`, color: classColor }}
              >
                {item.message.classification}
              </span>
            )}
            <button onClick={onToggle} className="text-[#6b7280] hover:text-[#9ca3af] transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* EXTRACTED DATA — prominent when signal is available */}
        {item.signal && (item.phase === "complete" || item.phase === "extracting") ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-2">
            <div className="col-span-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: classColor }} />
                <span className="text-sm font-semibold text-white">{item.signal.location.join(", ")}</span>
                {Array.from(new Set(item.signal.postcodes)).map((pc: string) => (
                  <span key={pc} className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wide" style={{ backgroundColor: `${classColor}20`, color: classColor }}>{pc}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.1em] text-[#6b7280] mb-0.5">Budget</div>
              <span className="text-[13px] font-bold text-white">{item.signal.budget !== "-" ? item.signal.budget : "—"}</span>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.1em] text-[#6b7280] mb-0.5">Beds</div>
              <span className="text-[13px] font-bold text-white">{item.signal.bedrooms !== "-" ? item.signal.bedrooms : "—"}</span>
            </div>
          </div>
        ) : null}

        {/* Raw message text — demoted, small, muted, italic */}
        <p className={`text-[10px] text-[#6b7280] leading-relaxed italic ${expanded ? "" : "line-clamp-2"}`}>
          "{item.message.rawText}"
        </p>

        {/* Pipeline visualization */}
        <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-[#3a3f45]/30">
          <PipelineStage
            label="Received"
            active={item.phase === "receiving"}
            completed={item.phase !== "receiving"}
            color="#3b82f6"
          />
          <ArrowRight className="w-3 h-3 text-[#3a3f45]" />
          <PipelineStage
            label="Classified"
            active={item.phase === "classifying"}
            completed={item.phase === "extracting" || item.phase === "complete"}
            color="#d4a843"
          />
          <ArrowRight className="w-3 h-3 text-[#3a3f45]" />
          <PipelineStage
            label="Extracted"
            active={item.phase === "extracting"}
            completed={item.phase === "complete"}
            color="#8b5cf6"
          />
          <ArrowRight className="w-3 h-3 text-[#3a3f45]" />
          <PipelineStage
            label="Done"
            active={false}
            completed={item.phase === "complete"}
            color="#77d5c0"
          />
        </div>

        {/* Expanded: full signal details */}
        {expanded && item.signal && item.phase === "complete" && (
          <div className="mt-3 pt-3 border-t border-[#3a3f45]/30 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#77d5c0] mb-1.5">
              Full Extracted Signal
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-[#6b7280]" />
                <span className="text-[#c9cdd3]">{item.signal.location.join(", ")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-[#6b7280]" />
                <span className="text-[#c9cdd3]">{item.signal.budget}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Home className="w-3 h-3 text-[#6b7280]" />
                <span className="text-[#c9cdd3]">{item.signal.propertyType}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 text-[#6b7280]" />
                <span className="text-[#c9cdd3]">{item.signal.bedrooms !== "-" ? `${item.signal.bedrooms} bed` : "Unspecified"}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] text-[#6b7280]">Confidence</span>
              <div className="w-20 h-1 bg-[#3a3f45] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${item.signal.confidence * 100}%`, backgroundColor: classColor }} />
              </div>
              <span className="text-[10px] text-[#9ca3af]">{Math.round(item.signal.confidence * 100)}%</span>
            </div>
          </div>
        )}

        {expanded && !item.signal && item.phase === "complete" && !item.message.actionable && (
          <div className="mt-3 pt-3 border-t border-[#3a3f45]/30">
            <div className="flex items-center gap-2 text-[11px] text-[#6b7280]">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Non-actionable — classified as {item.message.classification}. No signal extracted.</span>
            </div>
          </div>
        )}

        {/* Timestamp */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px] text-[#4a5060]">
            {new Date(item.ingestedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          {item.classifiedAt && (
            <span className="text-[9px] text-[#4a5060]">
              Classified in {item.classifiedAt - item.ingestedAt}ms
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LiveFeed() {
  const {
    ingestedMessages,
    stats,
    isRunning,
    speed,
    setSpeed,
    start,
    stop,
    reset,
    ingestMessage,
  } = useIngestionEngine();

  const [realTimeMessages, setRealTimeMessages] = useState<any[]>([]);

  useWebSocketEvent("livefeed:message", useCallback((data: any) => {
    setRealTimeMessages((prev) => [
      {
        id: data.messageId,
        senderName: data.senderName,
        rawText: data.rawText,
        sourceGroup: data.sourceGroup,
        timestamp: data.timestamp,
        phase: "receiving",
        classification: null,
      },
      ...prev,
    ].slice(0, 50));
  }, []));

  useWebSocketEvent("livefeed:classified", useCallback((data: any) => {
    setRealTimeMessages((prev) =>
      prev.map((msg) =>
        msg.id === data.messageId
          ? {
              ...msg,
              phase: "complete",
              classification: data.type,
              confidence: data.confidence,
              actionable: data.actionable,
            }
          : msg
      )
    );
  }, []));

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [manualSender, setManualSender] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    ingestMessage({
      timestamp: new Date().toISOString(),
      sender: manualSender.trim() || "Manual Input",
      platform: "WhatsApp",
      rawText: manualInput.trim(),
      classification: "Buyer Search" as any, // Will be auto-classified
      confidence: 0.85,
      actionable: true,
      retained: "Unknown",
    });
    // Send to real backend (fire-and-forget, don't block the simulation UI)
    apiIngestMessage({
      sourceGroup: "Manual Input",
      senderName: manualSender || "Manual Test",
      rawText: manualInput,
    }).catch((err) => console.error("Failed to ingest to backend:", err));
    setManualInput("");
    setManualSender("");
    setShowCompose(false);
  };

  const speedLabels: Record<number, string> = {
    1: "Slow",
    2: "Normal",
    3: "Fast",
    4: "Rapid",
    5: "Burst",
  };

  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <div className="relative h-32 overflow-hidden">
        <img src={LONDON_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1e23] via-[#1a1e23]/80 to-transparent" />
        <div className="relative z-10 h-full flex items-center px-6 pl-12 md:pl-6">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Live Ingestion Feed</h1>
            <p className="text-[0.8rem] text-[#9ca3af] mt-0.5">Real-time WhatsApp message classification pipeline</p>
          </div>
          <div className="ml-auto shrink-0 flex items-center gap-3">
            {isRunning && (
              <div className="flex items-center gap-1.5 bg-[#2ecc71]/10 backdrop-blur px-3 py-1.5 rounded-md border border-[#2ecc71]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2ecc71] animate-live-pulse" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#2ecc71]">Ingesting</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Control Panel */}
        <section className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                {!isRunning ? (
                  <Button
                    onClick={start}
                    size="sm"
                    className="h-8 px-4 bg-[#77d5c0] hover:bg-[#5bc4ad] text-[#1a1e23] font-semibold text-xs gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Start Feed
                  </Button>
                ) : (
                  <Button
                    onClick={stop}
                    size="sm"
                    variant="outline"
                    className="h-8 px-4 border-[#d4a843]/50 text-[#d4a843] hover:bg-[#d4a843]/10 font-semibold text-xs gap-1.5"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    Pause
                  </Button>
                )}
                <Button
                  onClick={reset}
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 border-[#3a3f45]/50 text-[#6b7280] hover:text-[#9ca3af] hover:bg-[#2a2f35] text-xs gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </Button>
              </div>

              {/* Speed Control */}
              <div className="flex items-center gap-2 md:ml-2 md:pl-3 md:border-l border-[#3a3f45]/40">
                <Gauge className="w-3.5 h-3.5 text-[#6b7280]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Speed</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      className={`w-7 h-6 rounded text-[10px] font-semibold transition-all ${
                        speed === s
                          ? "bg-[#77d5c0]/20 text-[#77d5c0] border border-[#77d5c0]/40"
                          : "text-[#6b7280] hover:text-[#9ca3af] border border-transparent hover:border-[#3a3f45]"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
                <span className="text-[9px] text-[#4a5060] ml-1">{speedLabels[speed]}</span>
              </div>

              {/* Manual compose */}
              <div className="md:ml-2 md:pl-3 md:border-l border-[#3a3f45]/40">
                <Button
                  onClick={() => setShowCompose(!showCompose)}
                  size="sm"
                  variant="outline"
                  className={`h-8 px-3 text-xs gap-1.5 ${
                    showCompose
                      ? "border-[#77d5c0]/50 text-[#77d5c0] bg-[#77d5c0]/10"
                      : "border-[#3a3f45]/50 text-[#6b7280] hover:text-[#9ca3af]"
                  }`}
                >
                  <Send className="w-3 h-3" />
                  Compose
                </Button>
              </div>
            </div>

            {/* Live Stats */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="text-center">
                <div className="text-lg font-bold text-white">{stats.totalIngested}</div>
                <div className="text-[9px] text-[#6b7280] uppercase tracking-wider">Ingested</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-[#77d5c0]">{stats.totalExtracted}</div>
                <div className="text-[9px] text-[#6b7280] uppercase tracking-wider">Signals</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-[#d4a843]">{stats.totalActionable}</div>
                <div className="text-[9px] text-[#6b7280] uppercase tracking-wider">Actionable</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-[#6b7280]">{stats.totalNonActionable}</div>
                <div className="text-[9px] text-[#6b7280] uppercase tracking-wider">Filtered</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-[#3b82f6]">{stats.messagesPerMinute.toFixed(0)}</div>
                <div className="text-[9px] text-[#6b7280] uppercase tracking-wider">msg/min</div>
              </div>
            </div>
          </div>

          {/* Compose Panel */}
          {showCompose && (
            <div className="mt-4 pt-4 border-t border-[#3a3f45]/40">
              <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#77d5c0] mb-2">
                Manual Message Ingestion
              </div>
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={manualSender}
                    onChange={e => setManualSender(e.target.value)}
                    placeholder="Sender name (e.g. Scott Bennett)"
                    className="w-full h-8 px-3 text-xs bg-[#1a1e23] border border-[#3a3f45]/50 rounded-md text-[#c9cdd3] placeholder:text-[#4a5060] focus:border-[#77d5c0]/50 focus:outline-none transition-colors"
                  />
                  <textarea
                    ref={inputRef}
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleManualSubmit();
                    }}
                    placeholder="Paste or type a WhatsApp message to classify..."
                    rows={3}
                    className="w-full px-3 py-2 text-xs bg-[#1a1e23] border border-[#3a3f45]/50 rounded-md text-[#c9cdd3] placeholder:text-[#4a5060] focus:border-[#77d5c0]/50 focus:outline-none transition-colors resize-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleManualSubmit}
                    disabled={!manualInput.trim()}
                    size="sm"
                    className="h-8 px-4 bg-[#77d5c0] hover:bg-[#5bc4ad] text-[#1a1e23] font-semibold text-xs gap-1.5 disabled:opacity-30"
                  >
                    <Zap className="w-3 h-3" />
                    Ingest
                  </Button>
                  <Button
                    onClick={() => { setShowCompose(false); setManualInput(""); setManualSender(""); }}
                    size="sm"
                    variant="outline"
                    className="h-8 px-4 border-[#3a3f45]/50 text-[#6b7280] hover:text-[#9ca3af] text-xs"
                  >
                    Cancel
                  </Button>
                  <span className="text-[9px] text-[#4a5060] mt-auto">Ctrl+Enter to send</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Live from Backend */}
        {realTimeMessages.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs uppercase tracking-wider text-[#77d5c0] mb-2 font-semibold">
              Live from Backend ({realTimeMessages.length})
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {realTimeMessages.slice(0, 10).map((msg: any) => (
                <div key={msg.id} className="bg-[#22272d] rounded-lg p-3 border border-[#2a2f35]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white">{msg.senderName}</span>
                    {msg.classification ? (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#77d5c0]/20 text-[#77d5c0]">
                        {msg.classification}
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3b82f6]/20 text-[#3b82f6] animate-pulse">
                        classifying...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#9ca3af] line-clamp-2">{msg.rawText}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Message Stream */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#77d5c0]">
                Message Stream
              </h2>
              <span className="text-[10px] text-[#6b7280]">
                {ingestedMessages.length} messages
              </span>
            </div>

            {ingestedMessages.length === 0 ? (
              <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#77d5c0]/10 flex items-center justify-center mb-4">
                  <Activity className="w-7 h-7 text-[#77d5c0]" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">No messages yet</h3>
                <p className="text-xs text-[#6b7280] max-w-sm">
                  Click "Start Feed" to begin simulating real-time WhatsApp message ingestion, or use "Compose" to manually input a message for classification.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-340px)]">
                <div className="space-y-2.5 pr-3">
                  {ingestedMessages.map(item => (
                    <MessageCard
                      key={item.id}
                      item={item}
                      expanded={expandedId === item.id}
                      onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Sidebar Stats */}
          <div className="space-y-4">
            {/* Pipeline Health */}
            <div>
              <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#77d5c0] mb-3">
                Pipeline Health
              </h2>
              <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#6b7280] uppercase tracking-wider">Status</span>
                  <Badge className={`text-[10px] px-1.5 py-0 h-5 border-0 font-medium ${
                    isRunning ? "bg-[#2ecc71]/20 text-[#2ecc71]" : "bg-[#6b7280]/20 text-[#6b7280]"
                  }`}>
                    {isRunning ? "Active" : "Paused"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#6b7280] uppercase tracking-wider">Throughput</span>
                  <span className="text-xs font-semibold text-white">{stats.messagesPerMinute.toFixed(0)} msg/min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#6b7280] uppercase tracking-wider">Avg Classify</span>
                  <span className="text-xs font-semibold text-[#d4a843]">{Math.round(stats.avgClassificationTime)}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#6b7280] uppercase tracking-wider">Avg Extract</span>
                  <span className="text-xs font-semibold text-[#8b5cf6]">{Math.round(stats.avgExtractionTime)}ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#6b7280] uppercase tracking-wider">Speed</span>
                  <span className="text-xs font-semibold text-white">{speed}x ({speedLabels[speed]})</span>
                </div>
              </div>
            </div>

            {/* Classification Breakdown */}
            <div>
              <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#77d5c0] mb-3">
                Classification Breakdown
              </h2>
              <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-4 space-y-2">
                {(() => {
                  const counts: Record<string, number> = {};
                  ingestedMessages
                    .filter(m => m.phase === "complete" || m.phase === "extracting")
                    .forEach(m => {
                      const cls = m.message.classification;
                      counts[cls] = (counts[cls] || 0) + 1;
                    });
                  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                  if (entries.length === 0) {
                    return (
                      <div className="text-[11px] text-[#4a5060] text-center py-4">
                        No classifications yet
                      </div>
                    );
                  }
                  const maxCount = entries[0]?.[1] || 1;
                  return entries.map(([cls, count]) => (
                    <div key={cls}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] text-[#c9cdd3]">{cls}</span>
                        <span className="text-[10px] text-[#9ca3af]">{count}</span>
                      </div>
                      <div className="h-1 bg-[#3a3f45]/50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(count / maxCount) * 100}%`,
                            backgroundColor: classificationColors[cls] || "#6b7280",
                          }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Recent Signals */}
            <div>
              <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#77d5c0] mb-3">
                Latest Signals
              </h2>
              <div className="space-y-2">
                {ingestedMessages
                  .filter(m => m.signal && m.phase === "complete")
                  .slice(0, 5)
                  .map(m => {
                    const sigColor = classificationColors[m.signal!.type] || "#6b7280";
                    return (
                      <div
                        key={m.id}
                        className="bg-[#22272d] rounded-lg p-3"
                        style={{ borderLeft: `3px solid ${sigColor}`, border: `1px solid ${sigColor}30`, borderLeftWidth: "3px", borderLeftColor: sigColor }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: sigColor }}>{m.signal!.type}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <MapPin className="w-3 h-3 shrink-0" style={{ color: sigColor }} />
                          <span className="text-xs font-semibold text-white">{m.signal!.location.join(", ")}</span>
                          {Array.from(new Set(m.signal!.postcodes)).map((pc: string) => (
                            <span key={pc} className="text-[8px] px-1 py-0.5 rounded font-bold" style={{ backgroundColor: `${sigColor}20`, color: sigColor }}>{pc}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="text-[11px] font-bold text-white">{m.signal!.budget}</span>
                          {m.signal!.bedrooms !== "-" && (
                            <span className="text-[10px] text-[#9ca3af]">{m.signal!.bedrooms} bed</span>
                          )}
                        </div>
                        <p className="text-[9px] text-[#6b7280] italic line-clamp-1">"{m.signal!.summary}"</p>
                      </div>
                    );
                  })}
                {ingestedMessages.filter(m => m.signal && m.phase === "complete").length === 0 && (
                  <div className="bg-[#22272d] border border-[#3a3f45]/50 rounded-lg p-6 text-center">
                    <span className="text-[11px] text-[#4a5060]">No signals extracted yet</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
