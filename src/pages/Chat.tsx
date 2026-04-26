import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import {
  useChatConversations,
  useCreateChatConversation,
  useDeleteChatConversation,
  useSearchChatConversations,
  useUpdateChatConversation,
} from "@/hooks/use-chat";
import {
  useCreatePlan,
  useGeneratePlanDraft,
  useLinkChatToPlan,
  usePlans,
  useSuggestPlanLink,
} from "@/hooks/use-plans";
import { appRoutes } from "@/lib/routes";
import type { ChatConversation } from "@/types/api";

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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { data: chats = [], isLoading, isError } = useChatConversations();
  const createChat = useCreateChatConversation();
  const deleteChat = useDeleteChatConversation();
  const updateChat = useUpdateChatConversation();
  const { data: plans = [] } = usePlans();
  const linkChatToPlan = useLinkChatToPlan();
  const suggestPlanLink = useSuggestPlanLink();
  const generatePlanDraft = useGeneratePlanDraft();
  const createPlan = useCreatePlan();
  const [recentesOpen, setRecentesOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [planningOpen, setPlanningOpen] = useState(false);
  const [planningChat, setPlanningChat] = useState<ChatConversation | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [renamingChat, setRenamingChat] = useState<ChatConversation | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deletingChat, setDeletingChat] = useState<ChatConversation | null>(null);
  const activeChat = chats.find((chat) => chat.id === chatId);
  const { data: searchResults = [], isLoading: isSearching, isError: isSearchError } =
    useSearchChatConversations(debouncedSearchTerm);

  const nonEmptySearch = debouncedSearchTerm.trim();
  const pinnedChats = useMemo(() => chats.filter((chat) => chat.pinned), [chats]);
  const recentChats = useMemo(() => chats.filter((chat) => !chat.pinned), [chats]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    if (!renamingChat) {
      return;
    }

    setRenameTitle(renamingChat.title);
  }, [renamingChat]);

  const handleCreateChat = async () => {
    try {
      const chat = await createChat.mutateAsync();
      navigate(getChatPath(chat.id));
    } catch (error) {
      toast.error("Nao foi possivel criar um novo chat.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleOpenPlanning = (chat?: ChatConversation) => {
    setPlanningChat(chat ?? null);
    setSelectedPlanId(chat?.planId ?? plans[0]?.id ?? "");
    setPlanningOpen(true);
  };

  const handleMoveToSelectedPlan = async () => {
    if (!planningChat || !selectedPlanId) {
      return;
    }

    try {
      await linkChatToPlan.mutateAsync({ planId: selectedPlanId, chatId: planningChat.id });
      setPlanningOpen(false);
      toast.success("Chat vinculado ao planejamento.");
    } catch (error) {
      toast.error("Nao foi possivel vincular o chat.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleAiPlanningAction = async () => {
    if (!planningChat) {
      return;
    }

    try {
      const suggestion = await suggestPlanLink.mutateAsync(planningChat.id);

      if (suggestion.action === "link" && suggestion.planId) {
        await linkChatToPlan.mutateAsync({ planId: suggestion.planId, chatId: planningChat.id });
        setPlanningOpen(false);
        toast.success("A IA vinculou o chat a um planejamento existente.", {
          description: suggestion.rationale,
        });
        return;
      }

      const draft = await generatePlanDraft.mutateAsync(planningChat.id);
      const plan = await createPlan.mutateAsync({
        title: draft.title,
        description: draft.description,
        source: "ai",
        goal: draft.goal,
        items: draft.items.map((item, index) => ({
          title: item.title,
          description: item.description,
          status: item.status,
          sortOrder: index,
        })),
        chatIds: [planningChat.id],
      });

      setPlanningOpen(false);
      toast.success("A IA criou um novo planejamento para este chat.", {
        description: plan.title,
      });
    } catch (error) {
      toast.error("Nao foi possivel organizar este chat com IA.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleTogglePin = async (chat: ChatConversation) => {
    try {
      await updateChat.mutateAsync({
        chatId: chat.id,
        input: {
          pinned: !chat.pinned,
        },
      });
    } catch (error) {
      toast.error("Nao foi possivel atualizar o chat.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleRenameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!renamingChat || !renameTitle.trim()) {
      return;
    }

    try {
      await updateChat.mutateAsync({
        chatId: renamingChat.id,
        input: {
          title: renameTitle.trim(),
        },
      });
      setRenamingChat(null);
    } catch (error) {
      toast.error("Nao foi possivel renomear o chat.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleDeleteChat = async () => {
    if (!deletingChat) {
      return;
    }

    try {
      await deleteChat.mutateAsync(deletingChat.id);

      if (deletingChat.id === chatId) {
        const nextChat = chats.find((chat) => chat.id !== deletingChat.id);
        navigate(nextChat ? getChatPath(nextChat.id) : appRoutes.chat);
      }

      setDeletingChat(null);
    } catch (error) {
      toast.error("Nao foi possivel excluir o chat.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleSearchResultClick = (resultChatId: string) => {
    setSearchOpen(false);
    navigate(getChatPath(resultChatId));
  };

  const renderChatItem = (chat: ChatConversation) => {
    const isActive = chat.id === chatId;

    return (
      <div key={chat.id} className="group relative">
        <Link
          to={getChatPath(chat.id)}
          className={`block rounded-lg border px-3 py-2 pr-10 transition-colors ${
            isActive
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-transparent bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          }`}
        >
          <div className="flex items-start gap-2">
            <MessageSquare size={15} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                {chat.pinned ? <Pin size={12} className="shrink-0 text-primary" /> : null}
                <p className="truncate text-sm font-medium">{chat.title}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatChatDate(chat.updatedAt)}</p>
            </div>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Opcoes do chat ${chat.title}`}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-100 transition-opacity hover:bg-background/80 hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            >
              <MoreHorizontal size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => handleOpenPlanning(chat)}>
              <FolderKanban size={15} className="mr-2" />
              Mover para um planejamento
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleTogglePin(chat)}>
              <Pin size={15} className="mr-2" />
              {chat.pinned ? "Desfixar Chat" : "Fixar Chat"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRenamingChat(chat)}>
              <Pencil size={15} className="mr-2" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingChat(chat)}>
              <Trash2 size={15} className="mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <AppShell title="Chat IA" description="Converse com o assistente sobre gastos, contas e metas">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="glass-card flex min-h-[18rem] flex-col p-4">
          <div data-tour-id="chat-suggestions" className="space-y-2">
            <Button className="w-full justify-start" onClick={handleCreateChat} disabled={createChat.isPending}>
              <Plus size={16} />
              Novo chat
            </Button>
            <Button className="w-full justify-start" variant="secondary" onClick={() => setSearchOpen(true)}>
              <Search size={16} />
              Buscar em Chats
            </Button>
            <Button className="w-full justify-start" variant="secondary" asChild>
              <Link to={appRoutes.plans}>
                <FolderKanban size={16} />
                Planejamentos
              </Link>
            </Button>
          </div>

          <Collapsible open={recentesOpen} onOpenChange={setRecentesOpen} className="mt-4 flex min-h-0 flex-1 flex-col">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:bg-secondary/60"
              >
                <span>Recentes</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {chats.length}
                  {recentesOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </span>
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent className="min-h-0 flex-1">
              <div className="mt-2 flex max-h-[calc(100vh-18rem)] min-h-0 flex-col gap-2 overflow-y-auto pr-1 scrollbar-thin">
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

                {pinnedChats.map(renderChatItem)}
                {pinnedChats.length > 0 && recentChats.length > 0 ? <div className="h-px bg-border/50" /> : null}
                {recentChats.map(renderChatItem)}
              </div>
            </CollapsibleContent>
          </Collapsible>
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
          </div>

          <div data-tour-id="chat-conversation" className="h-[calc(100vh-15.5rem)] min-h-[28rem] sm:h-[calc(100vh-14.5rem)]">
            {chatId && activeChat ? (
              <AiChat chatId={chatId} />
            ) : (
              <div className="glass-card flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                Use Novo chat para iniciar uma conversa com seu consultor.
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buscar em Chats</DialogTitle>
            <DialogDescription>Busque pelo titulo ou pelo conteudo das conversas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Digite um termo para buscar"
              autoFocus
            />

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
              {!nonEmptySearch ? (
                <div className="rounded-lg border border-border/30 bg-secondary/30 p-3 text-sm text-muted-foreground">
                  Digite um termo para encontrar chats.
                </div>
              ) : null}

              {nonEmptySearch && isSearching ? (
                <div className="rounded-lg bg-secondary/40 p-3 text-sm text-muted-foreground">Buscando chats...</div>
              ) : null}

              {nonEmptySearch && isSearchError ? (
                <div className="rounded-lg border border-border/30 bg-secondary/30 p-3 text-sm text-muted-foreground">
                  Nao foi possivel buscar nos chats.
                </div>
              ) : null}

              {nonEmptySearch && !isSearching && !isSearchError && !searchResults.length ? (
                <div className="rounded-lg border border-border/30 bg-secondary/30 p-3 text-sm text-muted-foreground">
                  Nenhum chat encontrado.
                </div>
              ) : null}

              {searchResults.map((result) => (
                <button
                  key={`${result.chatId}-${result.matchType}-${result.matchedAt}`}
                  type="button"
                  onClick={() => handleSearchResultClick(result.chatId)}
                  className="w-full rounded-lg border border-border/40 bg-secondary/30 p-3 text-left transition-colors hover:bg-secondary/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-foreground">{result.title}</p>
                    <span className="shrink-0 rounded-md bg-background px-2 py-0.5 text-xs text-muted-foreground">
                      {result.matchType === "title" ? "Titulo" : "Mensagem"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{result.matchedText}</p>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={planningOpen} onOpenChange={setPlanningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover para um planejamento</DialogTitle>
            <DialogDescription>
              {planningChat
                ? `Escolha um planejamento para "${planningChat.title}" ou deixe a IA sugerir o melhor destino.`
                : "Selecione um chat para organizar em planejamentos."}
            </DialogDescription>
          </DialogHeader>
          {planningChat ? (
            <div className="space-y-4">
              <select
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">Selecione um planejamento</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title}
                  </option>
                ))}
              </select>

              {!plans.length ? (
                <div className="rounded-lg border border-border/30 bg-secondary/30 p-3 text-sm text-muted-foreground">
                  Nenhum planejamento encontrado. Use a IA para criar um novo a partir deste chat ou abra a pagina de planejamentos.
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPlanningOpen(false)}>
              Cancelar
            </Button>
            <Button variant="outline" asChild>
              <Link to={appRoutes.plans}>Abrir planejamentos</Link>
            </Button>
            <Button
              variant="outline"
              onClick={handleAiPlanningAction}
              disabled={!planningChat || suggestPlanLink.isPending || generatePlanDraft.isPending || createPlan.isPending}
            >
              {suggestPlanLink.isPending || generatePlanDraft.isPending || createPlan.isPending ? "Organizando..." : "Usar IA"}
            </Button>
            <Button onClick={handleMoveToSelectedPlan} disabled={!planningChat || !selectedPlanId || linkChatToPlan.isPending}>
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renamingChat)} onOpenChange={(open) => (!open ? setRenamingChat(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear chat</DialogTitle>
            <DialogDescription>Altere o titulo exibido na lista de chats.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <Input value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} autoFocus />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setRenamingChat(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!renameTitle.trim() || updateChat.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingChat)} onOpenChange={(open) => (!open ? setDeletingChat(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao remove a conversa e todas as mensagens dela permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
