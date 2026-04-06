import { useState } from "react";
import { Bell, Check, CheckCheck, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAlerts, useMarkAlertRead, useMarkAllRead } from "@/hooks/queries/useAlerts";

const priorityColors: Record<string, string> = {
  high: "bg-red-500/20 text-red-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low: "bg-green-500/20 text-green-400",
};

export default function Alerts() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { data, isLoading } = useAlerts({
    read: filter === "unread" ? false : undefined,
    limit: 50,
  });
  const markRead = useMarkAlertRead();
  const markAllRead = useMarkAllRead();

  const alerts = data?.alerts ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#f1f2f7]">Alerts</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">{total} total alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#1a1e23] rounded-lg p-0.5">
            <button
              onClick={() => setFilter("all")}
              className={`text-xs px-3 py-1.5 rounded-md transition-all ${
                filter === "all" ? "bg-[#22272d] text-[#f1f2f7]" : "text-[#6b7280]"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`text-xs px-3 py-1.5 rounded-md transition-all ${
                filter === "unread" ? "bg-[#22272d] text-[#f1f2f7]" : "text-[#6b7280]"
              }`}
            >
              Unread
            </button>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-[#3a3f45] text-[#9ca3af] hover:text-white"
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" />
            Mark all read
          </Button>
        </div>
      </div>

      {/* Alert list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#77d5c0] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#6b7280]">
            <Bell className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No alerts yet</p>
            <p className="text-xs mt-1">Ingest matching messages to generate alerts</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert: any) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-4 rounded-lg border transition-all cursor-pointer ${
                  alert.read
                    ? "bg-[#22272d] border-[#2a2f35] opacity-70"
                    : "bg-[#22272d] border-[#3a3f45] hover:border-[#77d5c0]/30"
                }`}
                onClick={() => {
                  if (!alert.read) markRead.mutate(alert.id);
                }}
              >
                {/* Unread dot */}
                <div className="pt-1">
                  {!alert.read ? (
                    <div className="w-2 h-2 rounded-full bg-[#77d5c0]" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-transparent" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-[10px] px-1.5 py-0 h-4 font-bold border-0 uppercase ${priorityColors[alert.priority] || ""}`}>
                      {alert.priority}
                    </Badge>
                    <span className="text-[10px] text-[#6b7280] uppercase">{alert.type.replace("_", " ")}</span>
                  </div>
                  <p className="text-sm text-[#f1f2f7]">{alert.summary}</p>
                  <p className="text-[10px] text-[#6b7280] mt-1">
                    {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>

                {/* Read indicator */}
                {alert.read && (
                  <Check className="w-4 h-4 text-[#6b7280] shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
