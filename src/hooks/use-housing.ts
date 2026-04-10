import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteHousing, getHousing, patchHousing, postHousing } from "@/lib/api";
import { dashboardQueryKey } from "@/hooks/use-dashboard";
import { spendingQueryKey } from "@/hooks/use-insights";
import { transactionsQueryKey } from "@/hooks/use-transactions";
import type { CreateHousingInput, HousingItem, UpdateHousingInput } from "@/types/api";

export const housingQueryKey = ["housing"] as const;

function upsertHousing(items: HousingItem[], housing: HousingItem) {
  const nextItems = items.filter((item) => String(item.id) !== String(housing.id));
  nextItems.push(housing);

  return nextItems.sort((left, right) => String(right.id).localeCompare(String(left.id), undefined, { numeric: true }));
}

export function useHousing() {
  return useQuery({
    queryKey: housingQueryKey,
    queryFn: getHousing,
    staleTime: 30_000,
  });
}

export function useCreateHousing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateHousingInput) => postHousing(input),
    onSuccess: (housing) => {
      queryClient.setQueryData<HousingItem[]>(housingQueryKey, (items = []) => upsertHousing(items, housing));
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: spendingQueryKey });
    },
  });
}

export function useUpdateHousing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateHousingInput) => patchHousing(input),
    onSuccess: (housing) => {
      queryClient.setQueryData<HousingItem[]>(housingQueryKey, (items = []) => upsertHousing(items, housing));
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: spendingQueryKey });
    },
  });
}

export function useDeleteHousing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number | string) => deleteHousing(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<HousingItem[]>(housingQueryKey, (items = []) =>
        items.filter((item) => String(item.id) !== String(id)),
      );
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: spendingQueryKey });
    },
  });
}
