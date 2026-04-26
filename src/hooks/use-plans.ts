import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deletePlan,
  generatePlanDraft,
  getPlan,
  getPlans,
  linkChatToPlan,
  patchPlan,
  postPlan,
  suggestPlanLink,
  unlinkChatFromPlan,
} from "@/lib/api";
import type { CreatePlanInput, Plan, UpdatePlanInput } from "@/types/api";
import { chatConversationsQueryKey } from "@/hooks/use-chat";

export const plansQueryKey = ["plans"] as const;
export const planQueryKey = (planId: string) => ["plans", planId] as const;

function sortPlans(plans: Plan[]) {
  return [...plans].sort((left, right) => {
    const dateDifference = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return String(right.id).localeCompare(String(left.id), undefined, { numeric: true });
  });
}

function upsertPlan(plans: Plan[], plan: Plan) {
  return sortPlans([plan, ...plans.filter((item) => item.id !== plan.id)]);
}

export function usePlans() {
  return useQuery({
    queryKey: plansQueryKey,
    queryFn: getPlans,
    staleTime: 10_000,
  });
}

export function usePlan(planId: string | undefined) {
  return useQuery({
    queryKey: planQueryKey(planId ?? ""),
    queryFn: () => getPlan(planId ?? ""),
    enabled: Boolean(planId),
    staleTime: 10_000,
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePlanInput) => postPlan(input),
    onSuccess: (plan) => {
      queryClient.setQueryData(plansQueryKey, (currentPlans = []) => {
        const plans = Array.isArray(currentPlans) ? currentPlans : [];
        return upsertPlan(plans, plan);
      });
      queryClient.setQueryData(planQueryKey(plan.id), plan);
      queryClient.invalidateQueries({ queryKey: chatConversationsQueryKey });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePlanInput) => patchPlan(input),
    onSuccess: (plan) => {
      queryClient.setQueryData(plansQueryKey, (currentPlans = []) => {
        const plans = Array.isArray(currentPlans) ? currentPlans : [];
        return upsertPlan(plans, plan);
      });
      queryClient.setQueryData(planQueryKey(plan.id), plan);
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePlan,
    onSuccess: (_result, planId) => {
      queryClient.setQueryData(plansQueryKey, (currentPlans = []) => {
        const plans = Array.isArray(currentPlans) ? currentPlans : [];
        return plans.filter((plan) => plan.id !== planId);
      });
      queryClient.removeQueries({ queryKey: planQueryKey(planId) });
      queryClient.invalidateQueries({ queryKey: chatConversationsQueryKey });
    },
  });
}

export function useLinkChatToPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, chatId }: { planId: string; chatId: string }) => linkChatToPlan(planId, chatId),
    onSuccess: (plan) => {
      queryClient.setQueryData(plansQueryKey, (currentPlans = []) => {
        const plans = Array.isArray(currentPlans) ? currentPlans : [];
        return upsertPlan(plans, plan);
      });
      queryClient.setQueryData(planQueryKey(plan.id), plan);
      queryClient.invalidateQueries({ queryKey: chatConversationsQueryKey });
    },
  });
}

export function useUnlinkChatFromPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, chatId }: { planId: string; chatId: string }) => unlinkChatFromPlan(planId, chatId),
    onSuccess: (plan) => {
      queryClient.setQueryData(plansQueryKey, (currentPlans = []) => {
        const plans = Array.isArray(currentPlans) ? currentPlans : [];
        return upsertPlan(plans, plan);
      });
      queryClient.setQueryData(planQueryKey(plan.id), plan);
      queryClient.invalidateQueries({ queryKey: chatConversationsQueryKey });
    },
  });
}

export function useGeneratePlanDraft() {
  return useMutation({
    mutationFn: generatePlanDraft,
  });
}

export function useSuggestPlanLink() {
  return useMutation({
    mutationFn: suggestPlanLink,
  });
}
