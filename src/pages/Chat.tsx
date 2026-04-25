import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import AppShell from "@/components/AppShell";
import AiChat from "@/components/AiChat";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useChatConversations, useCreateChatConversation, useDeleteChatConversation } from "@/hooks/use-chat";
import { appRoutes } from "@/lib/routes";

function getChatPath(chatId: string) {
  return `${appRoutes.chat}/${chatId}`;
}

function formatChatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { data: chats = [], isLoading, isError } = useChatConversations();
  const createChat = useCreateChatConversation();
  const deleteChat = useDeleteChatConversation();
  const activeChat = chats.find((chat) => chat.id === chatId);
  const nextChatAfterDelete = useMemo(
    () => chats.find((chat) => chat.id !== chatId),
    [chatId, chats],
  );

  const handleCreateChat = async () => {
    try {
      const chat = await createChat.mutateAsync();
      navigate(getChatPath(chat.id));
    } catch (error) {
      toast.error("Nao foi possivel criar um novo chat.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleDeleteChat = async () => {
    if (!chatId) {
      return;
    }

    try {
      await deleteChat.mutateAsync(chatId);
      navigate(nextChatAfterDelete ? getChatPath(nextChatAfterDelete.id) : appRoutes.chat);
    } catch (error) {
      toast.error("Nao foi possivel excluir o chat.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  return (
    <AppShell title="Chat IA" description="Converse com o assistente sobre gastos, contas e metas">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="glass-card flex min-h-[18rem] flex-col p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Chats</h2>
            <Button size="sm" onClick={handleCreateChat} disabled={createChat.isPending}>
              <Plus size={16} />
              Novo chat
            </Button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin">
            {isLoading ? (
              <div className="rounded-lg bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">Carregando chats...</div>
            ) : null}

            {isError ? (
              <div className="rounded-lg border border-border/30 bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
                Nao foi possivel carregar seus chats.
              </div>
            ) : null}

            {!isLoading && !isError && !chats.length ? (
              <div className="rounded-lg border border-border/30 bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
                Crie um chat para comecar.
              </div>
            ) : null}

            {chats.map((chat) => {
              const isActive = chat.id === chatId;

              return (
                <Link
                  key={chat.id}
                  to={getChatPath(chat.id)}
                  className={`block rounded-lg border px-3 py-2 transition-colors ${
                    isActive
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-transparent bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare size={15} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{chat.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatChatDate(chat.updatedAt)}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </aside>

        <div className="grid min-h-[28rem] grid-rows-[auto_minmax(0,1fr)] gap-3">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-foreground">
                {activeChat?.title ?? (chatId ? "Chat nao encontrado" : "Selecione ou crie um chat")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {chatId ? "As mensagens ficam salvas ate voce excluir o chat." : "Cada conversa tem uma URL propria."}
              </p>
            </div>

            {chatId ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={deleteChat.isPending}>
                    <Trash2 size={16} />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir chat?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acao remove a conversa e todas as mensagens dela permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir chat
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>

          <div data-tour-id="chat-conversation" className="h-[calc(100vh-15.5rem)] min-h-[28rem] sm:h-[calc(100vh-14.5rem)]">
            {chatId && activeChat ? (
              <AiChat chatId={chatId} />
            ) : (
              <div className="glass-card flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                Use Novo chat para iniciar uma conversa persistente.
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
