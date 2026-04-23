import { Bot, Loader2, Send, User } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { toast } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_CHAT_LIMIT, useChatMessages, useSendChatMessage } from "@/hooks/use-chat";
import type { ChatMessage } from "@/types/api";

interface AiChatProps {
  initialMessages?: ChatMessage[];
}

function ChatLoadingState() {
  return (
    <div className="glass-card flex h-full flex-col animate-fade-in">
      <div className="border-b border-border/50 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Bot size={14} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Assistente Finly</h3>
            <div className="flex items-center gap-1">
              <span className="pulse-glow h-1.5 w-1.5 rounded-full bg-income" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
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
      {line.split(/(\*\*.*?\*\*)/).map((part, partIndex) =>
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

export default function AiChat({ initialMessages }: AiChatProps) {
  const [input, setInput] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { data: messages = [], isLoading, isError, error } = useChatMessages(DEFAULT_CHAT_LIMIT, initialMessages);
  const sendMessage = useSendChatMessage(DEFAULT_CHAT_LIMIT);
  const pendingMessage = sendMessage.isPending && typeof sendMessage.variables === "string" ? sendMessage.variables : null;

  useEffect(() => {
    if (!isError) {
      return;
    }

    toast.error("Nao foi possivel carregar o historico do chat.", {
      description: getErrorMessage(error, "Tente novamente em instantes."),
    });
  }, [error, isError]);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages.length, pendingMessage]);

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const message = input.trim();

    if (!message || sendMessage.isPending) {
      return;
    }

    setInput("");

    try {
      await sendMessage.mutateAsync(message);
    } catch (mutationError) {
      setInput(message);
      toast.error("Nao foi possivel enviar sua mensagem.", {
        description: getErrorMessage(mutationError, "Tente novamente em instantes."),
      });
    }
  };

  if (isLoading && !messages.length) {
    return <ChatLoadingState />;
  }

  return (
    <div className="glass-card flex h-full flex-col animate-fade-in">
      <div className="border-b border-border/50 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Bot size={14} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Assistente Finly</h3>
            <div className="flex items-center gap-1">
              <span className="pulse-glow h-1.5 w-1.5 rounded-full bg-income" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
        {!messages.length ? (
          <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
            {isError ? "Nao foi possivel carregar a conversa agora." : "Comece uma conversa com o assistente."}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2.5 ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    message.role === "assistant" ? "bg-primary/10" : "bg-secondary"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <Bot size={13} className="text-primary" />
                  ) : (
                    <User size={13} className="text-muted-foreground" />
                  )}
                </div>
                <div
                  className={`max-w-full rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[85%] ${
                    message.role === "assistant"
                      ? "rounded-tl-sm bg-secondary text-secondary-foreground"
                      : "rounded-tr-sm bg-primary text-primary-foreground"
                  }`}
                >
                  {renderMessageContent(message.content)}
                </div>
              </div>
            ))}

            {pendingMessage ? (
              <>
                <div className="flex flex-row-reverse gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User size={13} className="text-muted-foreground" />
                  </div>
                  <div className="max-w-full rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground sm:max-w-[85%]">
                    {renderMessageContent(pendingMessage)}
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot size={13} className="text-primary" />
                  </div>
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
              placeholder="Pergunte sobre suas financas..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={sendMessage.isPending || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {sendMessage.isPending ? (
                <Loader2 size={14} className="animate-spin text-primary-foreground" />
              ) : (
                <Send size={14} className="text-primary-foreground" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
