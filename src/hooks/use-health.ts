import { useQuery } from "@tanstack/react-query";

import { getHealth } from "@/lib/api";

export const healthQueryKey = ["health"] as const;

export function useHealth() {
  return useQuery({
    queryKey: healthQueryKey,
    queryFn: getHealth,
    staleTime: 30_000,
  });
}
