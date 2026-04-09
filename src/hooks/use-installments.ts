import { useQuery } from "@tanstack/react-query";

import { getInstallmentsOverview } from "@/lib/api";
import type { InstallmentsOverviewFilters } from "@/types/api";

export const installmentsOverviewQueryKey = (filters: Partial<InstallmentsOverviewFilters> = {}) =>
  [
    "installments",
    "overview",
    filters.cardId ?? "all",
    filters.categoryId ?? "all",
    filters.status ?? "all",
    filters.installmentAmountMin ?? "min:any",
    filters.installmentAmountMax ?? "max:any",
    filters.installmentCountMode ?? "count-mode:all",
    filters.installmentCountValue ?? "count-value:any",
    filters.purchaseStart ?? "start:any",
    filters.purchaseEnd ?? "end:any",
    filters.sortBy ?? "smart",
    filters.sortOrder ?? "desc",
  ] as const;

export function useInstallmentsOverview(filters: Partial<InstallmentsOverviewFilters>) {
  return useQuery({
    queryKey: installmentsOverviewQueryKey(filters),
    queryFn: () => getInstallmentsOverview(filters),
    staleTime: 30_000,
  });
}
