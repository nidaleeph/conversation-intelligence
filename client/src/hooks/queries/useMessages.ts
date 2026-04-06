import { useQuery } from "@tanstack/react-query";
import { getMessages, type MessageFilters } from "@/api/messages";

export function useMessages(filters: MessageFilters = {}) {
  return useQuery({
    queryKey: ["messages", filters],
    queryFn: () => getMessages(filters),
  });
}
