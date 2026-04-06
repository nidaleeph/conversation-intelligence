import { useState } from "react";
import { Shield, Clock, User, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuditLog } from "@/hooks/queries/useAudit";
import { useAuth } from "@/hooks/useAuth";

const actionColors: Record<string, string> = {
  message_received: "bg-blue-500/20 text-blue-400",
  signal_classified: "bg-purple-500/20 text-purple-400",
  signal_reviewed: "bg-green-500/20 text-green-400",
  alert_created: "bg-yellow-500/20 text-yellow-400",
  alert_read: "bg-gray-500/20 text-gray-400",
  match_found: "bg-teal-500/20 text-teal-400",
  match_confirmed: "bg-emerald-500/20 text-emerald-400",
  match_dismissed: "bg-red-500/20 text-red-400",
  agent_invited: "bg-indigo-500/20 text-indigo-400",
  agent_deactivated: "bg-red-500/20 text-red-400",
  login: "bg-sky-500/20 text-sky-400",
};

export default function Admin() {
  const { agent } = useAuth();
  const [actionFilter, setActionFilter] = useState<string>("");
  const { data, isLoading } = useAuditLog({
    action: actionFilter || undefined,
    limit: 100,
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;

  if (agent?.role !== "admin") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-[#6b7280]">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Admin access required</p>
        </div>
      </div>
    );
  }

  const actions = [
    "message_received", "signal_classified", "signal_reviewed",
    "alert_created", "alert_read", "match_found", "match_confirmed",
    "match_dismissed", "agent_invited", "login",
  ];

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
      <div>
        <h1 className="text-lg font-semibold text-[#f1f2f7]">Admin — Audit Log</h1>
        <p className="text-xs text-[#6b7280] mt-0.5">{total} total entries</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActionFilter("")}
          className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full transition-all ${
            !actionFilter ? "bg-[#77d5c0]/20 text-[#77d5c0]" : "bg-[#22272d] text-[#6b7280]"
          }`}
        >All</button>
        {actions.map((a) => (
          <button
            key={a}
            onClick={() => setActionFilter(a === actionFilter ? "" : a)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all ${
              actionFilter === a ? "bg-[#77d5c0]/20 text-[#77d5c0]" : "bg-[#22272d] text-[#6b7280]"
            }`}
          >{a.replace(/_/g, " ")}</button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#77d5c0] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#6b7280]">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No audit entries yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((entry: any) => (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-3 bg-[#22272d] rounded-lg border border-[#2a2f35]">
                <Clock className="w-3.5 h-3.5 text-[#6b7280] shrink-0" />
                <span className="text-[10px] text-[#6b7280] w-36 shrink-0">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
                <Badge className={`text-[9px] px-1.5 py-0 h-4 border-0 font-bold shrink-0 ${actionColors[entry.action] || "bg-gray-500/20 text-gray-400"}`}>
                  {entry.action.replace(/_/g, " ")}
                </Badge>
                <span className="text-xs text-[#9ca3af] truncate flex-1">
                  {entry.entityType}:{entry.entityId?.slice(0, 8)}
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <span className="text-[#6b7280]"> — {JSON.stringify(entry.metadata).slice(0, 60)}</span>
                  )}
                </span>
                {entry.agentId && <User className="w-3 h-3 text-[#6b7280] shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
