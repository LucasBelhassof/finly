import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getChatMessages, postChatMessage } from "@/lib/api";
import type { ChatMessage, ChatReply } from "@/types/api";
import { dashboardQueryKey } from "@/hooks/use-dashboard";

export const DEFAULT_CHAT_LIMIT = 20;

export const chatMessagesQueryKey = (limit = DEFAULT_CHAT_LIMIT) => ["chatMessages", limit] as const;

function compareMessages(left: ChatMessage, right: ChatMessage) {
  const dateDifference = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

  if (dateDifference !== 0) {
    return dateDifference;
  }

  return String(left.id).localeCompare(String(right.id), undefined, { numeric: true });
}

function mergeChatMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const merged = new Map<string, ChatMessage>();

  [...existing, ...incoming].forEach((message) => {
    merged.set(String(message.id), message);
  });

  return Array.from(merged.values()).sort(compareMessages);
}

export function appendChatReply(existing: ChatMessage[], reply: ChatReply) {
  return mergeChatMessages(existing, [reply.userMessage, reply.assistantMessage]);
}

export function useChatMessages(limit = DEFAULT_CHAT_LIMIT, initialData?: ChatMessage[]) {
  return useQuery({
    queryKey: chatMessagesQueryKey(limit),
    queryFn: () => getChatMessages(limit),
    placeholderData: initialData,
    staleTime: 10_000,
  });
}

export function useSendChatMessage(limit = DEFAULT_CHAT_LIMIT) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postChatMessage,
    onSuccess: (reply) => {
      queryClient.setQueryData<ChatMessage[]>(chatMessagesQueryKey(limit), (currentMessages = []) =>
        appendChatReply(currentMessages, reply),
      );

      queryClient.invalidateQueries({
        queryKey: dashboardQueryKey,
      });
    },
  });
}
