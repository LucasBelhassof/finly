import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { dashboardQueryKey } from "@/hooks/use-dashboard";
import { getInvestments, postInvestment, patchInvestment, deleteInvestment } from "@/lib/api";
import { plansQueryKey } from "@/hooks/use-plans";
import type { CreateInvestmentInput, InvestmentItem, UpdateInvestmentInput } from "@/types/api";

export const investmentsQueryKey = ["investments"] as const;

function upsertInvestment(items: InvestmentItem[], investment: InvestmentItem) {
  const nextItems = items.filter((item) => String(item.id) !== String(investment.id));
  nextItems.push(investment);

  return nextItems.sort((left, right) => String(right.id).localeCompare(String(left.id), undefined, { numeric: true }));
}

export function useInvestments(enabled = true) {
  return useQuery({
    queryKey: investmentsQueryKey,
    queryFn: getInvestments,
    staleTime: 30_000,
    enabled,
  });
}

export function useCreateInvestment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInvestmentInput) => postInvestment(input),
    onSuccess: (investment) => {
      queryClient.setQueryData<InvestmentItem[]>(investmentsQueryKey, (items = []) => upsertInvestment(items, investment));
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: plansQueryKey });
    },
  });
}

export function useUpdateInvestment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateInvestmentInput) => patchInvestment(input),
    onSuccess: (investment) => {
      queryClient.setQueryData<InvestmentItem[]>(investmentsQueryKey, (items = []) => upsertInvestment(items, investment));
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: plansQueryKey });
    },
  });
}

export function useDeleteInvestment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number | string) => deleteInvestment(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<InvestmentItem[]>(investmentsQueryKey, (items = []) =>
        items.filter((item) => String(item.id) !== String(id)),
      );
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: plansQueryKey });
    },
  });
}