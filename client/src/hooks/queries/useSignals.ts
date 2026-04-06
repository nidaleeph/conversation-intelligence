import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSignals, reviewSignal, type SignalFilters } from "@/api/signals";

export function useSignals(filters: SignalFilters = {}) {
  return useQuery({
    queryKey: ["signals", filters],
    queryFn: () => getSignals(filters),
  });
}

export function useReviewSignal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      review,
    }: {
      id: string;
      review: { approved: boolean; reviewedType?: string };
    }) => reviewSignal(id, review),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
