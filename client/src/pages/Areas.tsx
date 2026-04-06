import { MapPin } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDistributions } from "@/hooks/queries/useAnalytics";

export default function Areas() {
  const { data, isLoading } = useDistributions();
  const areaStats = data?.areaStats ?? [];
  const maxCount = Math.max(...areaStats.map((a: any) => a.count), 1);

  return (
    <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-[#f1f2f7]">Areas</h1>
        <p className="text-xs text-[#6b7280] mt-0.5">Signal concentration by area</p>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#77d5c0] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : areaStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#6b7280]">
            <MapPin className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No area data yet</p>
            <p className="text-xs mt-1">Ingest messages to see area demand</p>
          </div>
        ) : (
          <div className="space-y-3">
            {areaStats.map((area: any) => (
              <div key={area.area} className="bg-[#22272d] rounded-lg p-4 border border-[#2a2f35]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#77d5c0]" />
                    <span className="text-sm font-semibold text-[#f1f2f7]">{area.area}</span>
                  </div>
                  <span className="text-sm font-bold text-[#77d5c0]">{area.count} signals</span>
                </div>
                {/* Bar */}
                <div className="w-full h-2 bg-[#1a1e23] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#77d5c0] rounded-full transition-all duration-500"
                    style={{ width: `${(area.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
