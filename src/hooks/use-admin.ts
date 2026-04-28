import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getAdminNotificationTargets,
  getAdminNotifications,
  getAdminActivity,
  getAdminAiUsage,
  getAdminFinancialMetrics,
  getAdminOverview,
  getAdminSubscriptionMetrics,
  getAdminUsers,
  postAdminNotification,
} from "@/lib/api";
import type { CreateAdminNotificationInput } from "@/types/api";

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => getAdminOverview(),
    staleTime: 30_000,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => getAdminUsers(),
    staleTime: 30_000,
  });
}

export function useAdminFinancialMetrics() {
  return useQuery({
    queryKey: ["admin", "financial-metrics"],
    queryFn: () => getAdminFinancialMetrics(),
    staleTime: 30_000,
  });
}

export function useAdminSubscriptionMetrics() {
  return useQuery({
    queryKey: ["admin", "subscription-metrics"],
    queryFn: () => getAdminSubscriptionMetrics(),
    staleTime: 30_000,
  });
}

export function useAdminActivity() {
  return useQuery({
    queryKey: ["admin", "activity"],
    queryFn: () => getAdminActivity(20),
    staleTime: 30_000,
  });
}

export function useAdminAiUsage(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["admin", "ai-usage", startDate ?? "", endDate ?? ""],
    queryFn: () => getAdminAiUsage(startDate, endDate),
    staleTime: 30_000,
  });
}

export function useAdminNotificationTargets() {
  return useQuery({
    queryKey: ["admin", "notification-targets"],
    queryFn: getAdminNotificationTargets,
    staleTime: 30_000,
  });
}

export function useAdminNotifications() {
  return useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: () => getAdminNotifications(50),
    staleTime: 30_000,
  });
}

export function useCreateAdminNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAdminNotificationInput) => postAdminNotification(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
  });
}
