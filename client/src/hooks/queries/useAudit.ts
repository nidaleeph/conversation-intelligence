import { useQuery } from "@tanstack/react-query";
import { getAuditLog, type AuditFilters } from "@/api/audit";

export function useAuditLog(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: ["audit", filters],
    queryFn: () => getAuditLog(filters),
  });
}
