import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  applyPlanRecommendation,
  confirmPlanDraftSession,
  createPlanDraftSession,
  deletePlan,
  dismissPlanDraftSession,
  evaluatePlan,
  generatePlanDraft,
  getChatSummary,
  getPlan,
  getPlanDraftSession,
  getPlanRecommendations,
  getPlans,
  linkChatToPlan,
  patchPlanDraftSession,
  patchPlan,
  postChatSummary,
  postPlan,
  revisePlanDraft,
  revisePlanDraftSession,
  suggestPlanLink,
  unlinkChatFromPlan,
} from "@/lib/api";
import type {
  CreatePlanInput,
  Plan,
  PlanDraft,
  RevisePlanDraftInput,
  RevisePlanDraftSessionInput,
  UpdatePlanInput,
} from "@/types/api";
import { chatConversationMessagesQueryKey, chatConversationsQueryKey, DEFAULT_CHAT_LIMIT } from "@/hooks/use-chat";

export const plansQueryKey = ["plans"] as const;
export const planQueryKey = (planId: string) => ["plans", planId] as const;
export const planRecommendationsQueryKey = (planId: string) => ["plans", planId, "recommendations"] as const;
export const chatSummaryQueryKey = (chatId: string) => ["chats", chatId, "summary"] as const;
export const planDraftSessionQueryKey = (draftId: string) => ["planDrafts", draftId] as const;

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

export function useEvaluatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => evaluatePlan(planId),
    onSuccess: (plan) => {
      queryClient.setQueryData(plansQueryKey, (currentPlans = []) => {
        const plans = Array.isArray(currentPlans) ? currentPlans : [];
        return upsertPlan(plans, plan);
      });
      queryClient.setQueryData(planQueryKey(plan.id), plan);
      queryClient.invalidateQueries({ queryKey: planRecommendationsQueryKey(plan.id) });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function usePlanRecommendations(planId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: planRecommendationsQueryKey(planId ?? ""),
    queryFn: () => getPlanRecommendations(planId ?? ""),
    enabled: Boolean(planId) && (options.enabled ?? true),
    staleTime: 10_000,
  });
}

export function useApplyPlanRecommendation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, recommendationId }: { planId: string; recommendationId: number | string }) =>
      applyPlanRecommendation(planId, recommendationId),
    onSuccess: (plan) => {
      queryClient.setQueryData(plansQueryKey, (currentPlans = []) => {
        const plans = Array.isArray(currentPlans) ? currentPlans : [];
        return upsertPlan(plans, plan);
      });
      queryClient.setQueryData(planQueryKey(plan.id), plan);
      queryClient.invalidateQueries({ queryKey: planRecommendationsQueryKey(plan.id) });
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

export function useCreatePlanDraftSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPlanDraftSession,
    onSuccess: (draftSession) => {
      queryClient.setQueryData(planDraftSessionQueryKey(draftSession.id), draftSession);
      queryClient.invalidateQueries({
        queryKey: chatConversationMessagesQueryKey(draftSession.chatId, DEFAULT_CHAT_LIMIT),
      });
      queryClient.invalidateQueries({ queryKey: chatConversationsQueryKey });
    },
  });
}

export function usePlanDraftSession(draftId: string | undefined) {
  return useQuery({
    queryKey: planDraftSessionQueryKey(draftId ?? ""),
    queryFn: () => getPlanDraftSession(draftId ?? ""),
    enabled: Boolean(draftId),
    staleTime: 10_000,
  });
}

export function useUpdatePlanDraftSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draftId, draft }: { draftId: string; draft: PlanDraft }) => patchPlanDraftSession(draftId, draft),
    onSuccess: (draftSession) => {
      queryClient.setQueryData(planDraftSessionQueryKey(draftSession.id), draftSession);
    },
  });
}

export function useRevisePlanDraftSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RevisePlanDraftSessionInput) => revisePlanDraftSession(input),
    onSuccess: (draftSession) => {
      queryClient.setQueryData(planDraftSessionQueryKey(draftSession.id), draftSession);
    },
  });
}

export function useConfirmPlanDraftSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: confirmPlanDraftSession,
    onSuccess: (plan, draftId) => {
      queryClient.setQueryData(plansQueryKey, (currentPlans = []) => {
        const plans = Array.isArray(currentPlans) ? currentPlans : [];
        return upsertPlan(plans, plan);
      });
      queryClient.setQueryData(planQueryKey(plan.id), plan);
      queryClient.invalidateQueries({ queryKey: planDraftSessionQueryKey(draftId) });
      queryClient.invalidateQueries({ queryKey: chatConversationsQueryKey });
      plan.chats.forEach((chat) => {
        queryClient.invalidateQueries({ queryKey: chatConversationMessagesQueryKey(chat.id, DEFAULT_CHAT_LIMIT) });
      });
    },
  });
}

export function useDismissPlanDraftSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissPlanDraftSession,
    onSuccess: (draftSession) => {
      queryClient.setQueryData(planDraftSessionQueryKey(draftSession.id), draftSession);
      queryClient.invalidateQueries({
        queryKey: chatConversationMessagesQueryKey(draftSession.chatId, DEFAULT_CHAT_LIMIT),
      });
      queryClient.invalidateQueries({ queryKey: chatConversationsQueryKey });
    },
  });
}

export function useRevisePlanDraft() {
  return useMutation({
    mutationFn: (input: RevisePlanDraftInput) => revisePlanDraft(input),
  });
}

export function useSuggestPlanLink() {
  return useMutation({
    mutationFn: suggestPlanLink,
  });
}

export function useChatSummary(chatId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: chatSummaryQueryKey(chatId ?? ""),
    queryFn: () => getChatSummary(chatId ?? ""),
    enabled: Boolean(chatId) && (options.enabled ?? true),
    staleTime: 10_000,
  });
}

export function useGenerateChatSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chatId: string) => postChatSummary(chatId),
    onSuccess: (summary) => {
      queryClient.setQueryData(chatSummaryQueryKey(summary.chatId), summary);
    },
  });
}
