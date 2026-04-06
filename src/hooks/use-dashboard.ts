import { useQuery } from "@tanstack/react-query";

import { getDashboard } from "@/lib/api";

export const dashboardQueryKey = ["dashboard"] as const;

export function useDashboard() {
  return useQuery({
    queryKey: dashboardQueryKey,
    queryFn: getDashboard,
    staleTime: 30_000,
  });
}
