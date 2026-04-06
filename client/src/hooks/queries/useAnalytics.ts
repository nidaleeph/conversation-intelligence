import { useQuery } from "@tanstack/react-query";
import { getKPIs, getDistributions, getClassificationHealth, getAgentActivity, getSignalVolume } from "@/api/analytics";

export function useKPIs() {
  return useQuery({
    queryKey: ["analytics", "kpis"],
    queryFn: getKPIs,
    refetchInterval: 30 * 1000,
  });
}

export function useDistributions() {
  return useQuery({
    queryKey: ["analytics", "distributions"],
    queryFn: getDistributions,
    refetchInterval: 60 * 1000,
  });
}

export function useClassificationHealth() {
  return useQuery({
    queryKey: ["analytics", "classification-health"],
    queryFn: getClassificationHealth,
    refetchInterval: 60 * 1000,
  });
}

export function useAgentActivity() {
  return useQuery({
    queryKey: ["analytics", "agent-activity"],
    queryFn: getAgentActivity,
  });
}

export function useSignalVolume() {
  return useQuery({
    queryKey: ["analytics", "signal-volume"],
    queryFn: getSignalVolume,
    refetchInterval: 60 * 1000,
  });
}
