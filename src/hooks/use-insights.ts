import { useQuery } from "@tanstack/react-query";

import { getInsights, getSpending } from "@/lib/api";

export const insightsQueryKey = ["insights"] as const;
export const spendingQueryKey = ["spending"] as const;

export function useInsights() {
  return useQuery({
    queryKey: insightsQueryKey,
    queryFn: getInsights,
    staleTime: 30_000,
  });
}

export function useSpending() {
  return useQuery({
    queryKey: spendingQueryKey,
    queryFn: getSpending,
    staleTime: 30_000,
  });
}
