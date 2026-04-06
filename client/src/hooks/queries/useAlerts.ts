import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAlerts, getUnreadCount, markAlertRead, markAllAlertsRead,
  updateMatchStatus, type AlertFilters,
} from "@/api/alerts";

export function useAlerts(filters: AlertFilters = {}) {
  return useQuery({
    queryKey: ["alerts", filters],
    queryFn: () => getAlerts(filters),
  });
}

export function useUnreadAlertCount() {
  return useQuery({
    queryKey: ["alerts", "unread-count"],
    queryFn: getUnreadCount,
    refetchInterval: 15 * 1000,
  });
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markAlertRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllAlertsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useUpdateMatchStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, status }: { matchId: string; status: "confirmed" | "dismissed" }) =>
      updateMatchStatus(matchId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
