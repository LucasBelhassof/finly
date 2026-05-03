import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardChatCard from "@/components/DashboardChatCard";
import { appRoutes } from "@/lib/routes";

const mockUseChatConversations = vi.fn();
const mockUseCreateChatConversation = vi.fn();
const mockNavigate = vi.fn();
const mockCreateChatMutateAsync = vi.fn();
const mockAiChatConsumeInitialMessage = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/hooks/use-chat", () => ({
  useChatConversations: (...args: unknown[]) => mockUseChatConversations(...args),
  useCreateChatConversation: (...args: unknown[]) => mockUseCreateChatConversation(...args),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <select
      aria-label="Escolher conversa do chat financeiro"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder}</>,
}));

vi.mock("@/components/AiChat", () => ({
  default: ({
    chatId,
    initialMessage,
    onStartConversation,
    creatingConversation,
    onInitialMessageHandled,
    onOpenFullChat,
    headerActions,
  }: {
    chatId?: string;
    initialMessage?: string | null;
    onStartConversation?: (message: string) => Promise<boolean>;
    creatingConversation?: boolean;
    onInitialMessageHandled?: () => void;
    onOpenFullChat?: () => void;
    headerActions?: ReactNode;
  }) =>
    (() => {
      useEffect(() => {
        if (!chatId || !initialMessage) {
          return;
        }

        mockAiChatConsumeInitialMessage(chatId, initialMessage);
        onInitialMessageHandled?.();
      }, [chatId, initialMessage, onInitialMessageHandled]);

      return (
        <div>
          {headerActions}
          <span>{chatId ?? "sem chat"}</span>
          <span>{initialMessage ?? "sem mensagem inicial"}</span>
          <span>{creatingConversation ? "criando chat" : "chat pronto"}</span>
          <button type="button" onClick={() => onOpenFullChat?.()}>
            abrir no chat ia
          </button>
          <button type="button" onClick={() => void onStartConversation?.("Quero organizar minhas contas")}>
            enviar mensagem inicial
          </button>
        </div>
      );
    })(),
}));

describe("DashboardChatCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatConversations.mockReturnValue({
      data: [
        {
          id: "chat-1",
          title: "Planejamento mensal",
        },
        {
          id: "chat-2",
          title: "Novo chat",
        },
      ],
    });
    mockUseCreateChatConversation.mockReturnValue({
      isPending: false,
      mutateAsync: mockCreateChatMutateAsync.mockResolvedValue({ id: "chat-2" }),
    });
  });

  it("creates a new chat from the dashboard first message and keeps the conversation inline", async () => {
    render(<DashboardChatCard />);

    expect(screen.queryByText("Chat financeiro")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /enviar mensagem inicial/i }));

    await waitFor(() => {
      expect(mockCreateChatMutateAsync).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockAiChatConsumeInitialMessage).toHaveBeenCalledWith("chat-2", "Quero organizar minhas contas");
    });

    expect(screen.getByText("chat-2")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("loads an existing chat inline when one is selected", async () => {
    render(<DashboardChatCard />);

    fireEvent.change(screen.getByLabelText("Escolher conversa do chat financeiro"), {
      target: { value: "chat-1" },
    });

    expect(screen.getByText("chat-1")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("opens the active conversation in the chat page only when requested", async () => {
    render(<DashboardChatCard />);

    fireEvent.change(screen.getByLabelText("Escolher conversa do chat financeiro"), {
      target: { value: "chat-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /abrir no chat ia/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(`${appRoutes.chat}/chat-1`);
    });
  });
});
