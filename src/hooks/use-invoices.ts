import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getInvoices, markInvoicePaid, unmarkInvoicePaid, updateInvoiceSettings } from "@/lib/api";
import { banksQueryKey } from "@/hooks/use-banks";
import type { InvoiceFilters, InvoiceSettingsInput } from "@/types/api";

export const invoicesQueryKey = (filters: Partial<InvoiceFilters> = {}) =>
  [
    "invoices",
    filters.cardId ?? "all",
    filters.referenceStart ?? "start:any",
    filters.referenceEnd ?? "end:any",
    filters.status ?? "all",
    filters.categoryId ?? "all",
    filters.search?.trim() || "search:any",
  ] as const;

export function useInvoices(filters: Partial<InvoiceFilters>) {
  return useQuery({
    queryKey: invoicesQueryKey(filters),
    queryFn: () => getInvoices(filters),
    staleTime: 30_000,
  });
}

export function useUpdateInvoiceSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: InvoiceSettingsInput) => updateInvoiceSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: banksQueryKey });
    },
  });
}

export function useMarkInvoicePaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cardId, periodEnd }: { cardId: number | string; periodEnd: string }) =>
      markInvoicePaid(cardId, periodEnd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useUnmarkInvoicePaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cardId, periodEnd }: { cardId: number | string; periodEnd: string }) =>
      unmarkInvoicePaid(cardId, periodEnd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
