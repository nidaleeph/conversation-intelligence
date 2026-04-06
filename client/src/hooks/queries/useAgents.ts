import { useQuery } from "@tanstack/react-query";
import { getAgents, getAgentById } from "@/api/agents";

export function useAgents(page = 1, limit = 100) {
  return useQuery({
    queryKey: ["agents", page, limit],
    queryFn: () => getAgents(page, limit),
  });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ["agents", id],
    queryFn: () => getAgentById(id),
    enabled: !!id,
  });
}
