import { useQuery } from "@tanstack/react-query";

import { getBanks } from "@/lib/api";

export const banksQueryKey = ["banks"] as const;

export function useBanks() {
  return useQuery({
    queryKey: banksQueryKey,
    queryFn: getBanks,
    staleTime: 30_000,
  });
}
