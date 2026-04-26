import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createChatConversation,
  deleteChatConversation,
  getChatConversationMessages,
  getChatConversations,
  getChatMessages,
  patchChatConversation,
  postChatConversationMessage,
  postChatConversationMessages,
  postChatMessage,
  searchChatConversations,
} from "@/lib/api";
import type { ChatConversation, ChatMessage, ChatReply } from "@/types/api";
import { dashboardQueryKey } from "@/hooks/use-dashboard";

export const DEFAULT_CHAT_LIMIT = 20;

export const chatMessagesQueryKey = (limit = DEFAULT_CHAT_LIMIT) => ["chatMessages", limit] as const;
export const chatConversationsQueryKey = ["chatConversations"] as const;
export const chatConversationMessagesQueryKey = (chatId: string, limit = DEFAULT_CHAT_LIMIT) =>
  ["chatConversationMessages", chatId, limit] as const;
export const chatSearchQueryKey = (query: string) => ["chatSearch", query] as const;

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

function sortChatConversations(chats: ChatConversation[]) {
  return [...chats].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }

    const dateDifference = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return String(right.id).localeCompare(String(left.id), undefined, { numeric: true });
  });
}

function upsertChatConversation(existing: ChatConversation[], chat: ChatConversation) {
  return sortChatConversations([chat, ...existing.filter((item) => item.id !== chat.id)]);
}

export function appendChatReply(existing: ChatMessage[], reply: ChatReply) {
  return mergeChatMessages(existing, [...reply.userMessages, reply.assistantMessage]);
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

export function useSearchChatConversations(query: string) {
  const normalizedQuery = query.trim();

  return useQuery({
    queryKey: chatSearchQueryKey(normalizedQuery),
    queryFn: () => searchChatConversations(normalizedQuery),
    enabled: Boolean(normalizedQuery),
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
        return upsertChatConversation(chats, chat);
      });
    },
  });
}

export function useUpdateChatConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ chatId, input }: { chatId: string; input: { title?: string; pinned?: boolean } }) =>
      patchChatConversation(chatId, input),
    onSuccess: (chat) => {
      queryClient.setQueryData(chatConversationsQueryKey, (currentChats = []) => {
        const chats = Array.isArray(currentChats) ? currentChats : [];
        return upsertChatConversation(chats, chat);
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
          return upsertChatConversation(chats, reply.chat);
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

export function useSendChatConversationMessages(chatId: string | undefined, limit = DEFAULT_CHAT_LIMIT) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messages: string[]) => postChatConversationMessages(chatId ?? "", messages),
    onMutate: async (messages) => {
      if (!chatId) {
        return { optimisticMessages: [] };
      }

      await queryClient.cancelQueries({
        queryKey: chatConversationMessagesQueryKey(chatId, limit),
      });

      const now = Date.now();
      const optimisticMessages = messages.map((content, index) => ({
        id: `pending-${now}-${index}`,
        chatId,
        role: "user" as const,
        content,
        provider: null,
        model: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        requestCount: null,
        estimatedCostUsd: null,
        createdAt: new Date(now + index).toISOString(),
      }));

      queryClient.setQueryData<ChatMessage[]>(
        chatConversationMessagesQueryKey(chatId, limit),
        (currentMessages = []) => mergeChatMessages(currentMessages, optimisticMessages),
      );

      return { optimisticMessages };
    },
    onSuccess: (reply, _messages, context) => {
      if (!chatId) {
        return;
      }

      const optimisticIds = new Set((context?.optimisticMessages ?? []).map((message) => String(message.id)));

      queryClient.setQueryData<ChatMessage[]>(chatConversationMessagesQueryKey(chatId, limit), (currentMessages = []) =>
        appendChatReply(
          currentMessages.filter((message) => !optimisticIds.has(String(message.id))),
          reply,
        ),
      );

      if (reply.chat) {
        queryClient.setQueryData(chatConversationsQueryKey, (currentChats = []) => {
          const chats = Array.isArray(currentChats) ? currentChats : [];
          return upsertChatConversation(chats, reply.chat);
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
    onError: (_error, _messages, context) => {
      if (!chatId) {
        return;
      }

      const optimisticIds = new Set((context?.optimisticMessages ?? []).map((message) => String(message.id)));

      queryClient.setQueryData<ChatMessage[]>(chatConversationMessagesQueryKey(chatId, limit), (currentMessages = []) =>
        currentMessages.filter((message) => !optimisticIds.has(String(message.id))),
      );
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
