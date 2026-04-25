import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createChatConversation,
  deleteChatConversation,
  getChatConversationMessages,
  getChatConversations,
  getChatMessages,
  postChatConversationMessage,
  postChatMessage,
} from "@/lib/api";
import type { ChatMessage, ChatReply } from "@/types/api";
import { dashboardQueryKey } from "@/hooks/use-dashboard";

export const DEFAULT_CHAT_LIMIT = 20;

export const chatMessagesQueryKey = (limit = DEFAULT_CHAT_LIMIT) => ["chatMessages", limit] as const;
export const chatConversationsQueryKey = ["chatConversations"] as const;
export const chatConversationMessagesQueryKey = (chatId: string, limit = DEFAULT_CHAT_LIMIT) =>
  ["chatConversationMessages", chatId, limit] as const;

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

export function useChatConversations() {
  return useQuery({
    queryKey: chatConversationsQueryKey,
    queryFn: getChatConversations,
    staleTime: 10_000,
  });
}

export function useCreateChatConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createChatConversation,
    onSuccess: (chat) => {
      queryClient.setQueryData(chatConversationsQueryKey, (currentChats = []) => {
        const chats = Array.isArray(currentChats) ? currentChats : [];
        return [chat, ...chats.filter((item) => item.id !== chat.id)];
      });
    },
  });
}

export function useDeleteChatConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteChatConversation,
    onSuccess: (_result, chatId) => {
      queryClient.setQueryData(chatConversationsQueryKey, (currentChats = []) => {
        const chats = Array.isArray(currentChats) ? currentChats : [];
        return chats.filter((chat) => chat.id !== chatId);
      });
      queryClient.removeQueries({
        queryKey: ["chatConversationMessages", chatId],
      });
      queryClient.invalidateQueries({
        queryKey: dashboardQueryKey,
      });
    },
  });
}

export function useChatConversationMessages(chatId: string | undefined, limit = DEFAULT_CHAT_LIMIT) {
  return useQuery({
    queryKey: chatConversationMessagesQueryKey(chatId ?? "", limit),
    queryFn: () => getChatConversationMessages(chatId ?? "", limit),
    enabled: Boolean(chatId),
    staleTime: 10_000,
  });
}

export function useSendChatConversationMessage(chatId: string | undefined, limit = DEFAULT_CHAT_LIMIT) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) => postChatConversationMessage(chatId ?? "", message),
    onSuccess: (reply) => {
      if (!chatId) {
        return;
      }

      queryClient.setQueryData<ChatMessage[]>(
        chatConversationMessagesQueryKey(chatId, limit),
        (currentMessages = []) => appendChatReply(currentMessages, reply),
      );

      if (reply.chat) {
        queryClient.setQueryData(chatConversationsQueryKey, (currentChats = []) => {
          const chats = Array.isArray(currentChats) ? currentChats : [];
          return [reply.chat, ...chats.filter((chat) => chat.id !== reply.chat?.id)];
        });
      } else {
        queryClient.invalidateQueries({
          queryKey: chatConversationsQueryKey,
        });
      }

      queryClient.invalidateQueries({
        queryKey: dashboardQueryKey,
      });
    },
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
