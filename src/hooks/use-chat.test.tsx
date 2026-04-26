import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChatReply } from "@/types/api";

const mockGetChatMessages = vi.fn();
const mockPostChatMessage = vi.fn<(...args: unknown[]) => Promise<ChatReply>>();

vi.mock("@/lib/api", () => ({
  getChatMessages: (...args: unknown[]) => mockGetChatMessages(...args),
  postChatMessage: (...args: unknown[]) => mockPostChatMessage(...args),
}));

import { chatMessagesQueryKey, DEFAULT_CHAT_LIMIT, useSendChatMessage } from "@/hooks/use-chat";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useSendChatMessage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("posts a message and appends both chat messages into cache", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    queryClient.setQueryData(chatMessagesQueryKey(DEFAULT_CHAT_LIMIT), [
      {
        id: 1,
        role: "assistant",
        content: "Ola",
        createdAt: "2026-04-06T10:00:00.000Z",
      },
    ]);

    mockPostChatMessage.mockResolvedValue({
      userMessage: {
        id: 2,
        role: "user",
        content: "Como economizar?",
        createdAt: "2026-04-06T10:01:00.000Z",
      },
      userMessages: [
        {
          id: 2,
          role: "user",
          content: "Como economizar?",
          createdAt: "2026-04-06T10:01:00.000Z",
        },
      ],
      assistantMessage: {
        id: 3,
        role: "assistant",
        content: "Comece pelo delivery.",
        createdAt: "2026-04-06T10:01:01.000Z",
      },
    });

    const { result } = renderHook(() => useSendChatMessage(DEFAULT_CHAT_LIMIT), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("Como economizar?");
    });

    expect(mockPostChatMessage).toHaveBeenCalledWith("Como economizar?");
    expect(queryClient.getQueryData(chatMessagesQueryKey(DEFAULT_CHAT_LIMIT))).toEqual([
      {
        id: 1,
        role: "assistant",
        content: "Ola",
        createdAt: "2026-04-06T10:00:00.000Z",
      },
      {
        id: 2,
        role: "user",
        content: "Como economizar?",
        createdAt: "2026-04-06T10:01:00.000Z",
      },
      {
        id: 3,
        role: "assistant",
        content: "Comece pelo delivery.",
        createdAt: "2026-04-06T10:01:01.000Z",
      },
    ]);
  });
});
