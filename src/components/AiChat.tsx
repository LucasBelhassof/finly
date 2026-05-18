import { ExternalLink, FolderKanban, Send, User } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";

import { KipAvatar } from "@/components/brand/KipAvatar";
import { toast } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_CHAT_LIMIT, useChatConversationMessages, useSendChatConversationMessages } from "@/hooks/use-chat";
import type { PlanDraftAction } from "@/types/api";

interface AiChatProps {
  chatId?: string;
  planningInProgress?: boolean;
  onPlanningIntent?: () => void;
  creatingConversation?: boolean;
  initialMessage?: string | null;
  onInitialMessageHandled?: () => void;
  onStartConversation?: (message: string) => Promise<boolean>;
  onPlanDraftAction?: (action: PlanDraftAction) => void;
  onOpenFullChat?: () => void;
  headerActions?: ReactNode;
}

function ChatLoadingState() {
  return (
    <div className="glass-card grid h-[min(72vh,38rem)] min-h-[26rem] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden animate-fade-in sm:h-[min(68vh,42rem)]">
      <div className="border-b border-border/50 p-4">
        <div className="flex items-center gap-2">
          <KipAvatar size="sm" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Kip</h3>
            <div className="flex items-center gap-1">
              <span className="pulse-glow h-1.5 w-1.5 rounded-full bg-income" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 space-y-4 overflow-y-auto p-4 scrollbar-thin">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={`flex gap-2.5 ${index % 2 === 1 ? "flex-row-reverse" : ""}`}>
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className={`h-20 rounded-2xl ${index % 2 === 1 ? "w-40" : "w-52"}`} />
          </div>
        ))}
      </div>

      <div className="border-t border-border/50 p-3">
        <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function renderMessageContent(content: string) {
  return content.split("\n").map((line, lineIndex) => (
    <p key={`${lineIndex}-${line}`} className={lineIndex > 0 ? "mt-1" : ""}>
      {line
        .split(/(\*\*.*?\*\*)/)
        .map((part, partIndex) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={`${partIndex}-${part}`}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={`${partIndex}-${part}`}>{part}</span>
          ),
        )}
    </p>
  ));
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60" />
    </div>
  );
}

function hasPlanningIntent(message: string) {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return /\b(planejamento|plano financeiro|crie um plano|monte um plano|organize um planejamento)\b/.test(normalized);
}

export default function AiChat({
  chatId,
  planningInProgress = false,
  onPlanningIntent,
  creatingConversation = false,
  initialMessage = null,
  onInitialMessageHandled,
  onStartConversation,
  onPlanDraftAction,
  onOpenFullChat,
  headerActions,
}: AiChatProps) {
  const [input, setInput] = useState("");
  const [queuedMessages, setQueuedMessages] = useState<Array<{ id: string; content: string; createdAt: string }>>([]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const queuedMessagesRef = useRef(queuedMessages);
  const { data: messages = [], isLoading, isError, error } = useChatConversationMessages(chatId, DEFAULT_CHAT_LIMIT);
  const sendMessages = useSendChatConversationMessages(chatId, DEFAULT_CHAT_LIMIT);
  const { isPending: isSendingMessages, mutateAsync: sendQueuedMessages } = sendMessages;
  const hasUserMessage =
    messages.some((message) => message.role === "user") || queuedMessages.length > 0 || Boolean(initialMessage);

  useEffect(() => {
    queuedMessagesRef.current = queuedMessages;
  }, [queuedMessages]);

  useEffect(() => {
    if (!isError) {
      return;
    }

    toast.error("Não foi possível carregar o histórico do chat.", {
      description: getErrorMessage(error, "Tente novamente em instantes."),
    });
  }, [error, isError]);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages.length, queuedMessages.length, isSendingMessages, planningInProgress]);

  useEffect(() => {
    setInput("");
    setQueuedMessages([]);
    queuedMessagesRef.current = [];
  }, [chatId]);

  useEffect(() => {
    if (!chatId || !initialMessage) {
      return;
    }

    setQueuedMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `queued-initial-${Date.now()}-${currentMessages.length}`,
        content: initialMessage,
        createdAt: new Date().toISOString(),
      },
    ]);
    onInitialMessageHandled?.();
  }, [chatId, initialMessage, onInitialMessageHandled]);

  useEffect(() => {
    if (!chatId || !queuedMessages.length || isSendingMessages) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const messagesToSend = queuedMessagesRef.current;

      if (!messagesToSend.length) {
        return;
      }

      setQueuedMessages([]);
      queuedMessagesRef.current = [];

      try {
        await sendQueuedMessages(messagesToSend.map((message) => message.content));
        if (messagesToSend.some((message) => hasPlanningIntent(message.content))) {
          onPlanningIntent?.();
        }
      } catch (mutationError) {
        setInput(messagesToSend.map((message) => message.content).join(" "));
        toast.error("Não foi possível enviar sua mensagem.", {
          description: getErrorMessage(mutationError, "Tente novamente em instantes."),
        });
      }
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [chatId, isSendingMessages, onPlanningIntent, queuedMessages.length, sendQueuedMessages]);

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const message = input.trim();

    if (!message || planningInProgress || creatingConversation) {
      return;
    }

    if (!chatId) {
      if (!onStartConversation) {
        return;
      }

      const started = await onStartConversation(message);

      if (started) {
        setInput("");
      }

      return;
    }

    setInput("");
    setQueuedMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `queued-${Date.now()}-${currentMessages.length}`,
        content: message,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  if (isLoading && !messages.length) {
    return <ChatLoadingState />;
  }

  return (
    <div className="glass-card grid h-[min(72vh,38rem)] min-h-[26rem] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden animate-fade-in sm:h-[min(68vh,42rem)]">
      <div className="border-b border-border/50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <KipAvatar size="sm" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Kip</h3>
              <div className="flex items-center gap-1">
                <span className="pulse-glow h-1.5 w-1.5 rounded-full bg-income" />
                <span className="text-xs text-muted-foreground">Online</span>
              </div>
            </div>
          </div>

          {headerActions || (onOpenFullChat && hasUserMessage) ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {headerActions}
              {onOpenFullChat && hasUserMessage ? (
                <button
                  type="button"
                  onClick={onOpenFullChat}
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <ExternalLink size={12} />
                  Abrir chat completo
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div ref={scrollContainerRef} className="min-h-0 space-y-4 overflow-y-auto p-4 scrollbar-thin">
        {!messages.length &&
        !queuedMessages.length &&
        !isSendingMessages &&
        !planningInProgress &&
        !creatingConversation ? (
          <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
            {isError ? "Não foi possível carregar a conversa agora." : "Comece uma conversa com Kip."}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-2.5 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                {message.role === "assistant" ? (
                  <KipAvatar size="sm" />
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User size={13} className="text-muted-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-full rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[85%] ${
                    message.role === "assistant"
                      ? "rounded-tl-sm bg-secondary text-secondary-foreground"
                      : "rounded-tr-sm bg-primary text-primary-foreground"
                  }`}
                >
                  {renderMessageContent(message.content)}
                  {message.role === "assistant" &&
                  message.planDraftAction &&
                  message.planDraftAction.status === "pending" ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => onPlanDraftAction?.(message.planDraftAction!)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-background/70 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-background"
                      >
                        <FolderKanban size={13} />
                        {message.planDraftAction.label}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {queuedMessages.map((message) => (
              <div key={message.id} className="flex flex-row-reverse gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <User size={13} className="text-muted-foreground" />
                </div>
                <div className="max-w-full rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground sm:max-w-[85%]">
                  {renderMessageContent(message.content)}
                </div>
              </div>
            ))}

            {queuedMessages.length || isSendingMessages || planningInProgress || creatingConversation ? (
              <>
                <div className="flex gap-2.5">
                  <KipAvatar size="sm" />
                  <div className="max-w-full rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-3 text-sm text-secondary-foreground sm:max-w-[85%]">
                    <TypingIndicator />
                  </div>
                </div>
              </>
            ) : null}
          </>
        )}
      </div>

      <div className="border-t border-border/50 p-3">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                planningInProgress
                  ? "Gerando rascunho de planejamento..."
                  : creatingConversation
                    ? "Criando novo chat..."
                    : "Pergunte sobre suas finanças..."
              }
              disabled={planningInProgress || creatingConversation || (!chatId && !onStartConversation)}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={
                !input.trim() || planningInProgress || creatingConversation || (!chatId && !onStartConversation)
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              <Send size={14} className="text-primary-foreground" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
