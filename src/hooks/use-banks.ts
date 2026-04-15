import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteBank, getBanks, patchBank, postBank } from "@/lib/api";
import { dashboardQueryKey } from "@/hooks/use-dashboard";
import type { BankItem, CreateBankConnectionInput, UpdateBankConnectionInput } from "@/types/api";

export const banksQueryKey = ["banks"] as const;

export function useBanks(enabled = true) {
  return useQuery({
    queryKey: banksQueryKey,
    queryFn: getBanks,
    staleTime: 30_000,
    enabled,
  });
}

function upsertBank(items: BankItem[], bank: BankItem) {
  const nextItems = items.filter((item) => String(item.id) !== String(bank.id));
  nextItems.push(bank);

  return nextItems.sort((left, right) => {
    const parentDiff = String(left.parentBankConnectionId ?? left.id).localeCompare(String(right.parentBankConnectionId ?? right.id), undefined, {
      numeric: true,
    });

    if (parentDiff !== 0) {
      return parentDiff;
    }

    if (left.accountType !== right.accountType) {
      return left.accountType === "credit_card" ? 1 : -1;
    }

    return String(left.name).localeCompare(String(right.name), "pt-BR");
  });
}

export function useCreateBankConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBankConnectionInput) => postBank(input),
    onSuccess: (bank) => {
      queryClient.setQueryData<BankItem[]>(banksQueryKey, (items = []) => upsertBank(items, bank));
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
    },
  });
}

export function useUpdateBankConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateBankConnectionInput) => patchBank(input),
    onSuccess: (bank) => {
      queryClient.setQueryData<BankItem[]>(banksQueryKey, (items = []) => upsertBank(items, bank));
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
    },
  });
}

export function useDeleteBankConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number | string) => deleteBank(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<BankItem[]>(banksQueryKey, (items = []) =>
        items.filter((item) => String(item.id) !== String(id)),
      );
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
    },
  });
}
