// ============================================================
// DDRE War Room — Agents Directory Page
// Lists all agents with signal counts, areas, and links to profiles
// ============================================================

import { useMemo } from "react";
import { Link } from "wouter";
import {
  User, MapPin, Radio, Bell, Search, ChevronRight,
  Shield, TrendingUp, Activity
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgents } from "@/hooks/queries/useAgents";

const HERO_IMAGE = "https://d2xsxph8kpxj0f.cloudfront.net/310519663265683302/Mchx73LWdrS7gUExt8LJHT/hero-dark-network-jWoKoERoTMuRyKq9Q6VWGu.webp";

const signalTypeColors: Record<string, string> = {
  "Buyer Search": "#ef4444",
  "Tenant Search": "#3b82f6",
  "Property for Sale": "#d4a843",
  "Property for Rent": "#f59e0b",
  "Service Request": "#8b5cf6",
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#77d5c0] mb-3">
      {children}
    </h2>
  );
}

interface AgentSummary {
  name: string;
  email: string;
  areas: string[];
  isActive: boolean;
  totalSignals: number;
  buyerSearches: number;
  tenantSearches: number;
  listings: number;
  alertCount: number;
  retainedCount: number;
  lastActive: string;
}

export default function Agents() {
  const { data: agentsData, isLoading } = useAgents();
  const agents = agentsData?.agents ?? [];

  const agentSummaries = useMemo<AgentSummary[]>(() => {
    return agents.map((agent: any) => ({
      name: agent.name,
      email: agent.email,
      areas: agent.coverageAreas ?? [],
      isActive: agent.isActive,
      totalSignals: 0,
      buyerSearches: 0,
      tenantSearches: 0,
      listings: 0,
      alertCount: 0,
      retainedCount: 0,
      lastActive: "",
    }));
  }, [agents]);

  const totalAgents = agents.length;
  const totalSignals = 0;
  const totalAlerts = 0;
  const activeAgents = agents.filter((a: any) => a.isActive).length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[#6b7280]">Loading agents…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <div className="relative h-32 overflow-hidden">
        <img src={HERO_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1e23] via-[#1a1e23]/80 to-transparent" />
        <div className="relative z-10 h-full flex items-center px-6">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Agent Network</h1>
            <p className="text-[0.8rem] text-[#9ca3af] mt-0.5">Hampstead agent directory — {totalAgents} agents tracked</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-[#22272d] border border-[#3a3f45]/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Total Agents</span>
              <User className="w-3.5 h-3.5 text-[#4a5060]" />
            </div>
            <span className="text-xl font-bold text-[#77d5c0]">{totalAgents}</span>
          </div>
          <div className="bg-[#22272d] border border-[#3a3f45]/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Active Agents</span>
              <Activity className="w-3.5 h-3.5 text-[#4a5060]" />
            </div>
            <span className="text-xl font-bold text-white">{activeAgents}</span>
          </div>
          <div className="bg-[#22272d] border border-[#3a3f45]/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Total Signals</span>
              <Radio className="w-3.5 h-3.5 text-[#4a5060]" />
            </div>
            <span className="text-xl font-bold text-white">{totalSignals}</span>
          </div>
          <div className="bg-[#22272d] border border-[#3a3f45]/30 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Total Alerts</span>
              <Bell className="w-3.5 h-3.5 text-[#4a5060]" />
            </div>
            <span className="text-xl font-bold text-white">{totalAlerts}</span>
          </div>
        </div>

        {/* Agent Table */}
        <section>
          <SectionHeader>Agent Directory</SectionHeader>
          <div className="bg-[#22272d]/50 border border-[#3a3f45]/30 rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-[#3a3f45]/30 bg-[#1a1e23]/50">
              <span className="col-span-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Agent</span>
              <span className="col-span-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]">Areas</span>
              <span className="col-span-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6b7280] text-center">Signals</span>
              <span className="col-span-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6b7280] text-center">Buyers</span>
              <span className="col-span-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6b7280] text-center">Listings</span>
              <span className="col-span-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6b7280] text-center">Alerts</span>
              <span className="col-span-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6b7280] text-center">Retained</span>
              <span className="col-span-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6b7280] text-center"></span>
            </div>

            <ScrollArea className="h-[600px]">
              <div className="divide-y divide-[#3a3f45]/20">
                {agentSummaries.map((agent, i) => (
                  <Link
                    key={agent.name}
                    href={`/agents/${encodeURIComponent(agent.name)}`}
                    className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-[#22272d] transition-colors group items-center"
                  >
                    <div className="col-span-3 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#22272d] border border-[#3a3f45]/50 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-[#77d5c0]" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-white group-hover:text-[#77d5c0] transition-colors block">{agent.name}</span>
                        {agent.lastActive && (
                          <span className="text-[9px] text-[#6b7280]">
                            Last: {new Date(agent.lastActive).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-3 flex flex-wrap gap-1">
                      {agent.areas.slice(0, 3).map(area => (
                        <span key={area} className="text-[9px] px-1.5 py-0.5 rounded bg-[#3a3f45]/40 text-[#9ca3af]">{area}</span>
                      ))}
                      {agent.areas.length > 3 && (
                        <span className="text-[9px] text-[#6b7280]">+{agent.areas.length - 3}</span>
                      )}
                    </div>
                    <span className="col-span-1 text-center text-sm font-bold text-[#77d5c0]">{agent.totalSignals}</span>
                    <span className="col-span-1 text-center text-sm font-medium text-[#ef4444]">{agent.buyerSearches}</span>
                    <span className="col-span-1 text-center text-sm font-medium text-[#d4a843]">{agent.listings}</span>
                    <span className="col-span-1 text-center text-sm font-medium text-white">{agent.alertCount}</span>
                    <span className="col-span-1 text-center">
                      {agent.retainedCount > 0 ? (
                        <span className="text-sm font-bold text-[#d4a843]">{agent.retainedCount}</span>
                      ) : (
                        <span className="text-[10px] text-[#4a5060]">—</span>
                      )}
                    </span>
                    <span className="col-span-1 flex justify-center">
                      <ChevronRight className="w-4 h-4 text-[#4a5060] group-hover:text-[#77d5c0] transition-colors" />
                    </span>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          </div>
        </section>
      </div>
    </div>
  );
}
