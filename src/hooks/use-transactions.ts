import { useQuery } from "@tanstack/react-query";

import { getTransactions } from "@/lib/api";

export const transactionsQueryKey = (limit = 50) => ["transactions", limit] as const;

export function useTransactions(limit = 50) {
  return useQuery({
    queryKey: transactionsQueryKey(limit),
    queryFn: () => getTransactions(limit),
    staleTime: 30_000,
  });
}
