import {
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import AppShell from "@/components/AppShell";
import AiChat from "@/components/AiChat";
import CreateInvestmentDialog from "@/components/investments/CreateInvestmentDialog";
import { formatDecimalInput, parseDecimalInput, type InvestmentCoreFormState } from "@/components/investments/investment-form-utils";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useChatConversations,
  useCreateChatConversation,
  useDeleteChatConversation,
  useSearchChatConversations,
  useUpdateChatConversation,
} from "@/hooks/use-chat";
import {
  useConfirmPlanDraftSession,
  useCreatePlanDraftSession,
  useDismissPlanDraftSession,
  usePlanDraftSession,
  useLinkChatToPlan,
  usePlans,
  useRevisePlanDraftSession,
  useUpdatePlanDraftSession,
} from "@/hooks/use-plans";
import { useInvestments } from "@/hooks/use-investments";
import { useCategories } from "@/hooks/use-transactions";
import { appRoutes } from "@/lib/routes";
import { createPlanFormFromDraft, getPlanFormValidationError, normalizePlanForm, PlanFormFields, type PlanFormState } from "@/pages/Plans";
import type { ChatConversation, InvestmentItem, PlanDraft } from "@/types/api";

const EMPTY_SELECT_VALUE = "__empty__";
const MODAL_SELECT_TRIGGER_CLASSNAME = "h-11 rounded-xl border-border/60 bg-secondary/35";
const SCROLLABLE_MODAL_CONTENT_CLASSNAME = "h-[65vh] max-h-[40rem]";

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

function getInclusiveMonthSpan(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return 1;
  }

  return Math.max((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1, 1);
}

function buildInvestmentInitialValues(form: PlanFormState | null): Partial<InvestmentCoreFormState> | undefined {
  if (!form) {
    return undefined;
  }

  const suggestedInvestment = form.goal.investmentBox;
  const parsedTargetAmount = parseDecimalInput(form.goal.targetAmount);
  const hasPlanningTargetAmount = Number.isFinite(parsedTargetAmount) && parsedTargetAmount > 0;
  const targetAmount = hasPlanningTargetAmount
    ? formatDecimalInput(Number(parsedTargetAmount.toFixed(2)))
    : suggestedInvestment?.targetAmount !== null && suggestedInvestment?.targetAmount !== undefined
      ? formatDecimalInput(suggestedInvestment.targetAmount)
      : "";
  const suggestedFixedAmount = hasPlanningTargetAmount
    ? formatDecimalInput(Number((parsedTargetAmount / getInclusiveMonthSpan(form.goal.startDate, form.goal.endDate)).toFixed(2)))
    : suggestedInvestment?.fixedAmount && suggestedInvestment.fixedAmount > 0
      ? formatDecimalInput(suggestedInvestment.fixedAmount)
      : "";
  const contributionMode = hasPlanningTargetAmount ? "fixed_amount" : suggestedInvestment?.contributionMode ?? "fixed_amount";

  return {
    name: suggestedInvestment?.name?.trim() || form.title.trim(),
    description: suggestedInvestment?.description?.trim() || form.description.trim(),
    contributionMode,
    fixedAmount: contributionMode === "fixed_amount" ? suggestedFixedAmount : "",
    incomePercentage:
      contributionMode === "income_percentage" && suggestedInvestment?.incomePercentage !== null
        ? formatDecimalInput(suggestedInvestment.incomePercentage)
        : "",
    currentAmount:
      suggestedInvestment?.currentAmount !== null && suggestedInvestment?.currentAmount !== undefined
        ? formatDecimalInput(suggestedInvestment.currentAmount)
        : "0",
    targetAmount,
  };
}

export default function ChatPage() {
  const { chatId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: chats = [], isLoading, isError } = useChatConversations();
  const createChat = useCreateChatConversation();
  const deleteChat = useDeleteChatConversation();
  const updateChat = useUpdateChatConversation();
  const { data: plans = [] } = usePlans();
  const { data: categories = [] } = useCategories();
  const { data: investments = [] } = useInvestments();
  const linkChatToPlan = useLinkChatToPlan();
  const createPlanDraftSession = useCreatePlanDraftSession();
  const { mutateAsync: updatePlanDraftSessionAsync } = useUpdatePlanDraftSession();
  const revisePlanDraftSession = useRevisePlanDraftSession();
  const confirmPlanDraftSession = useConfirmPlanDraftSession();
  const dismissPlanDraftSession = useDismissPlanDraftSession();
  const [recentesOpen, setRecentesOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [planningOpen, setPlanningOpen] = useState(false);
  const [planningChat, setPlanningChat] = useState<ChatConversation | null>(null);
  const [planningReviewOpen, setPlanningReviewOpen] = useState(false);
  const [createInvestmentOpen, setCreateInvestmentOpen] = useState(false);
  const [planningInProgress, setPlanningInProgress] = useState(false);
  const [pendingInitialMessage, setPendingInitialMessage] = useState<string | null>(null);
  const [draftForm, setDraftForm] = useState<PlanFormState | null>(null);
  const [draftChat, setDraftChat] = useState<ChatConversation | null>(null);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const { data: loadedDraftSession } = usePlanDraftSession(draftSessionId ?? undefined);
  const [correction, setCorrection] = useState("");
  const [revisionMessages, setRevisionMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
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
  const createInvestmentInitialValues = useMemo(() => buildInvestmentInitialValues(draftForm), [draftForm]);

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

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const initialMessage =
      location.state &&
      typeof location.state === "object" &&
      "initialMessage" in location.state &&
      typeof location.state.initialMessage === "string"
        ? location.state.initialMessage.trim()
        : "";

    if (!chatId || !initialMessage) {
      return;
    }

    setPendingInitialMessage(initialMessage);
    navigate(location.pathname, { replace: true, state: null });
  }, [chatId, location.pathname, location.state, navigate]);

  const handleCreateChat = async () => {
    try {
      setMobileSidebarOpen(false);
      setPendingInitialMessage(null);
      const chat = await createChat.mutateAsync();
      navigate(getChatPath(chat.id));
    } catch (error) {
      toast.error("Nao foi possivel criar um novo chat.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleStartConversation = async (message: string) => {
    try {
      setMobileSidebarOpen(false);
      const chat = await createChat.mutateAsync();
      setPendingInitialMessage(message);
      navigate(getChatPath(chat.id));
      return true;
    } catch (error) {
      toast.error("Nao foi possivel iniciar um novo chat.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
      return false;
    }
  };

  const handleOpenPlanning = (chat?: ChatConversation) => {
    setPlanningChat(chat ?? null);
    setSelectedPlanId(chat?.planId ?? plans[0]?.id ?? "");
    setPlanningOpen(true);
  };

  const resetPlanningReview = () => {
    setPlanningReviewOpen(false);
    setPlanningInProgress(false);
    setDraftForm(null);
    setDraftChat(null);
    setDraftSessionId(null);
    setCorrection("");
    setRevisionMessages([]);
  };

  const createDraftFromForm = (form: PlanFormState): PlanDraft => {
    const normalized = normalizePlanForm(form);

    return {
      title: normalized.title,
      description: normalized.description ?? "",
      goal: normalized.goal ?? {
        type: "items",
        source: "ai",
        targetAmount: null,
        transactionType: "expense",
        targetModel: "category",
        categoryIds: [],
        investmentBoxId: null,
        investmentBox: null,
        investmentBoxIds: [],
        investmentBoxes: [],
        startDate: null,
        endDate: null,
      },
      items: (normalized.items ?? []).map((item, index) => ({
        id: `draft-${index}`,
        title: item.title,
        description: item.description ?? "",
        status: item.status ?? "todo",
        priority: item.priority ?? "medium",
        sortOrder: index,
      })),
    };
  };

  const applyDraftSessionToReview = useCallback(
    (draftSession: NonNullable<typeof loadedDraftSession>) => {
      setDraftSessionId(draftSession.id);
      setDraftForm(createPlanFormFromDraft(draftSession.draft));
      setDraftChat(chats.find((chat) => chat.id === draftSession.chatId) ?? null);
      setRevisionMessages(draftSession.revisionMessages);
      setCorrection("");
      setPlanningReviewOpen(true);
    },
    [chats],
  );

  const saveCurrentDraftSession = useCallback(async () => {
    if (!draftSessionId || !draftForm) {
      return;
    }

    await updatePlanDraftSessionAsync({
      draftId: draftSessionId,
      draft: createDraftFromForm(draftForm),
    });
  }, [draftForm, draftSessionId, updatePlanDraftSessionAsync]);

  useEffect(() => {
    if (!planningReviewOpen || !draftSessionId || !draftForm || planningInProgress) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void saveCurrentDraftSession().catch(() => {
        toast.error("Nao foi possivel salvar o rascunho automaticamente.");
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [draftForm, draftSessionId, planningInProgress, planningReviewOpen, saveCurrentDraftSession]);

  useEffect(() => {
    if (!loadedDraftSession || !draftSessionId || !planningReviewOpen || draftForm) {
      return;
    }

    applyDraftSessionToReview(loadedDraftSession);
  }, [applyDraftSessionToReview, draftForm, draftSessionId, loadedDraftSession, planningReviewOpen]);

  const handleStartPlanDraft = async (chat: ChatConversation | undefined | null) => {
    if (!chat || planningInProgress || planningReviewOpen) {
      return;
    }

    setDraftChat(chat);
    setDraftSessionId(null);
    setDraftForm(null);
    setCorrection("");
    setRevisionMessages([]);
    setPlanningReviewOpen(true);
    setPlanningInProgress(true);

    try {
      const draftSession = await createPlanDraftSession.mutateAsync(chat.id);
      applyDraftSessionToReview(draftSession);
    } catch (error) {
      resetPlanningReview();
      toast.error("Nao foi possivel gerar o rascunho do planejamento.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
      return;
    }

    setPlanningInProgress(false);
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

    setPlanningOpen(false);
    await handleStartPlanDraft(planningChat);
  };

  const handleReviseDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draftSessionId || !draftForm || !correction.trim()) {
      return;
    }

    const currentCorrection = correction.trim();
    setCorrection("");
    setPlanningInProgress(true);

    try {
      await saveCurrentDraftSession();
      const draftSession = await revisePlanDraftSession.mutateAsync({
        draftId: draftSessionId,
        correction: currentCorrection,
      });
      applyDraftSessionToReview(draftSession);
    } catch (error) {
      toast.error("Nao foi possivel revisar o rascunho.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    } finally {
      setPlanningInProgress(false);
    }
  };

  const handleConfirmDraft = async () => {
    if (!draftSessionId || !draftForm) {
      return;
    }

    const validationError = getPlanFormValidationError(draftForm);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      await saveCurrentDraftSession();
      const plan = await confirmPlanDraftSession.mutateAsync(draftSessionId);
      resetPlanningReview();
      navigate(`${appRoutes.plans}/${plan.id}`);
    } catch (error) {
      toast.error("Nao foi possivel salvar o planejamento.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleCreatedInvestment = (investment: InvestmentItem) => {
    setDraftForm((currentForm) => {
      if (!currentForm) {
        return currentForm;
      }

      return {
        ...currentForm,
        goal: {
          ...currentForm.goal,
          targetModel: "investment_box",
          transactionType: "income",
          investmentBoxId: String(investment.id),
          investmentBox: investment,
          investmentBoxIds: Array.from(new Set([...currentForm.goal.investmentBoxIds, String(investment.id)])),
          investmentBoxes: [
            ...currentForm.goal.investmentBoxes.filter(
              (currentInvestment) =>
                String(currentInvestment.id) !== "investment" &&
                String(currentInvestment.id) !== "draft-investment-box" &&
                String(currentInvestment.id) !== String(investment.id),
            ),
            investment,
          ],
        },
      };
    });
  };

  const handleDismissDraft = async () => {
    if (!draftSessionId) {
      resetPlanningReview();
      return;
    }

    try {
      await dismissPlanDraftSession.mutateAsync(draftSessionId);
      resetPlanningReview();
    } catch (error) {
      toast.error("Nao foi possivel recusar o rascunho.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handlePlanningReviewOpenChange = (open: boolean) => {
    if (open) {
      setPlanningReviewOpen(true);
      return;
    }

    void saveCurrentDraftSession().catch(() => {
      toast.error("Nao foi possivel salvar o rascunho antes de fechar.");
    });
    setPlanningReviewOpen(false);
  };

  const handleOpenDraftSession = (draftId: string) => {
    setDraftSessionId(draftId);
    setDraftForm(null);
    setDraftChat(null);
    setCorrection("");
    setRevisionMessages([]);
    setPlanningReviewOpen(true);
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

  const handleOpenSearch = () => {
    setMobileSidebarOpen(false);
    setSearchOpen(true);
  };

  const renderChatItem = (chat: ChatConversation, onSelect?: () => void) => {
    const isActive = chat.id === chatId;

    return (
      <div key={chat.id} className="group relative">
        <Link
          to={getChatPath(chat.id)}
          onClick={onSelect}
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
            <DropdownMenuItem
              onClick={() => {
                onSelect?.();
                handleOpenPlanning(chat);
              }}
            >
              <FolderKanban size={15} className="mr-2" />
              Mover para um planejamento
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                onSelect?.();
                handleTogglePin(chat);
              }}
            >
              <Pin size={15} className="mr-2" />
              {chat.pinned ? "Desfixar Chat" : "Fixar Chat"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                onSelect?.();
                setRenamingChat(chat);
              }}
            >
              <Pencil size={15} className="mr-2" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                onSelect?.();
                setDeletingChat(chat);
              }}
            >
              <Trash2 size={15} className="mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const renderChatNavigation = (onSelect?: () => void) => (
    <>
      <div className="space-y-2">
        <Button className="w-full justify-start" onClick={() => void handleCreateChat()} disabled={createChat.isPending}>
          <Plus size={16} />
          Novo chat
        </Button>
        <Button className="w-full justify-start" variant="secondary" onClick={handleOpenSearch}>
          <Search size={16} />
          Buscar em Chats
        </Button>
        <Button className="w-full justify-start" variant="secondary" asChild>
          <Link
            to={appRoutes.plans}
            onClick={() => {
              onSelect?.();
            }}
          >
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
            {isLoading ? <div className="rounded-lg bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">Carregando chats...</div> : null}

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

            {pinnedChats.map((chat) => renderChatItem(chat, onSelect))}
            {pinnedChats.length > 0 && recentChats.length > 0 ? <div className="h-px bg-border/50" /> : null}
            {recentChats.map((chat) => renderChatItem(chat, onSelect))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );

  return (
    <AppShell title="Chat IA" description="Converse com o assistente sobre gastos, contas e metas">
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[22rem] max-w-[calc(100vw-1rem)] border-border/60 bg-card p-0">
          <div className="flex h-full min-h-0 flex-col">
            <SheetHeader className="border-b border-border/50 px-4 py-4 text-left">
              <SheetTitle>Menu do chat</SheetTitle>
              <SheetDescription>Acesse atalhos, planejamentos e conversas recentes.</SheetDescription>
            </SheetHeader>
            <div className="flex min-h-0 flex-1 flex-col p-4">{renderChatNavigation(() => setMobileSidebarOpen(false))}</div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="glass-card hidden min-h-[18rem] flex-col p-4 lg:flex">
          <div data-tour-id="chat-suggestions" className="flex min-h-0 flex-1 flex-col">
            {renderChatNavigation()}
          </div>
        </aside>

        <div className="grid min-h-[28rem] grid-rows-[auto_minmax(0,1fr)] gap-3">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
              className="mt-0.5 h-10 w-10 shrink-0 rounded-lg border-border/60 lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Abrir barra lateral do chat"
            >
              <MessageSquare size={18} />
            </Button>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-foreground">
                  {activeChat?.title ?? (chatId ? "Chat nao encontrado" : "Selecione ou crie um chat")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {chatId ? "As mensagens ficam salvas ate voce excluir o chat." : "Cada conversa tem uma URL propria."}
                </p>
              </div>
            </div>
            {activeChat ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleStartPlanDraft(activeChat)}
                disabled={planningInProgress || planningReviewOpen}
              >
                <Sparkles size={16} />
                Gerar planejamento
              </Button>
            ) : null}
          </div>

          <div data-tour-id="chat-conversation" className="h-[calc(100vh-15.5rem)] min-h-[28rem] sm:h-[calc(100vh-14.5rem)]">
            {chatId && activeChat ? (
              <AiChat
                chatId={chatId}
                planningInProgress={planningInProgress}
                creatingConversation={createChat.isPending && !chatId}
                initialMessage={pendingInitialMessage}
                onInitialMessageHandled={() => setPendingInitialMessage(null)}
                onPlanningIntent={() => handleStartPlanDraft(activeChat)}
                onStartConversation={handleStartConversation}
                onPlanDraftAction={(action) => handleOpenDraftSession(action.draftId)}
              />
            ) : (
              <AiChat
                planningInProgress={planningInProgress}
                creatingConversation={createChat.isPending}
                initialMessage={pendingInitialMessage}
                onInitialMessageHandled={() => setPendingInitialMessage(null)}
                onStartConversation={handleStartConversation}
                onPlanDraftAction={(action) => handleOpenDraftSession(action.draftId)}
              />
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

            <ScrollArea className="h-80 max-h-[50vh]">
              <div className="space-y-2 pr-4">
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
            </ScrollArea>
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
              <Select
                value={selectedPlanId || EMPTY_SELECT_VALUE}
                onValueChange={(value) => setSelectedPlanId(value === EMPTY_SELECT_VALUE ? "" : value)}
              >
                <SelectTrigger className={MODAL_SELECT_TRIGGER_CLASSNAME}>
                  <SelectValue placeholder="Selecione um planejamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SELECT_VALUE}>Selecione um planejamento</SelectItem>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
              disabled={!planningChat || planningInProgress || createPlanDraftSession.isPending}
            >
              {planningInProgress || createPlanDraftSession.isPending ? "Gerando..." : "Usar IA"}
            </Button>
            <Button onClick={handleMoveToSelectedPlan} disabled={!planningChat || !selectedPlanId || linkChatToPlan.isPending}>
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={planningReviewOpen} onOpenChange={handlePlanningReviewOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Revisar planejamento</DialogTitle>
            <DialogDescription>
              {draftChat ? `Rascunho pendente gerado a partir de "${draftChat.title}".` : "Rascunho pendente gerado pela IA."}
            </DialogDescription>
          </DialogHeader>

          {planningInProgress && !draftForm ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-secondary/30 p-4 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              Gerando rascunho para revisao...
            </div>
          ) : null}

          {draftForm ? (
            <ScrollArea className={SCROLLABLE_MODAL_CONTENT_CLASSNAME}>
              <div className="space-y-5 pr-4">
                <PlanFormFields
                  form={draftForm}
                  categories={categories}
                  investments={investments}
                  onChange={setDraftForm}
                  onCreateInvestment={() => setCreateInvestmentOpen(true)}
                />

                <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
                  <div className="mb-3 space-y-2">
                    {revisionMessages.length ? (
                      revisionMessages.map((message, index) => (
                        <div
                          key={`${message.role}-${index}`}
                          className={`rounded-lg px-3 py-2 text-sm ${
                            message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                          } max-w-[85%]`}
                        >
                          {message.content}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Peça ajustes antes de confirmar, sem gravar no historico do chat.</p>
                    )}
                  </div>

                  <form onSubmit={handleReviseDraft} className="space-y-2">
                    <Textarea
                      value={correction}
                      onChange={(event) => setCorrection(event.target.value)}
                      placeholder="Ex.: reduza para 3 etapas e foque em cartao de credito"
                      rows={2}
                      disabled={planningInProgress}
                    />
                    <div className="flex justify-end">
                      <Button type="submit" variant="secondary" disabled={!correction.trim() || planningInProgress}>
                        {planningInProgress ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        Corrigir rascunho
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </ScrollArea>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleDismissDraft} disabled={dismissPlanDraftSession.isPending || confirmPlanDraftSession.isPending}>
              Recusar
            </Button>
            <Button onClick={handleConfirmDraft} disabled={!draftForm || planningInProgress || confirmPlanDraftSession.isPending}>
              Confirmar plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateInvestmentDialog
        open={createInvestmentOpen}
        onOpenChange={setCreateInvestmentOpen}
        onCreated={handleCreatedInvestment}
        initialValues={createInvestmentInitialValues}
      />

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
