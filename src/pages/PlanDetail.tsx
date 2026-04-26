import { CheckCircle2, ChevronLeft, Link2, Loader2, MessageSquareText, Trash2, Unlink } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import AppShell from "@/components/AppShell";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/sonner";
import { useChatConversationMessages, useChatConversations } from "@/hooks/use-chat";
import { useCategories } from "@/hooks/use-transactions";
import {
  useDeletePlan,
  useLinkChatToPlan,
  usePlan,
  useUnlinkChatFromPlan,
  useUpdatePlan,
} from "@/hooks/use-plans";
import { appRoutes } from "@/lib/routes";
import {
  PlanFormFields,
  createPlanFormFromPlan,
  formatDate,
  getErrorMessage,
  getPlanFormValidationError,
  getPlanGoalDetail,
  getPlanGoalSummary,
  normalizePlanForm,
  type PlanFormState,
} from "@/pages/Plans";
import type { ChatConversation, ChatMessage } from "@/types/api";

function getMessagePreview(content: string, maxLength = 170) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3).trim()}...` : normalized;
}

function buildChatSummary(messages: ChatMessage[]) {
  const userMessages = messages.filter((message) => message.role === "user");
  const assistantMessages = messages.filter((message) => message.role === "assistant");

  return {
    questionCount: userMessages.length,
    answerCount: assistantMessages.length,
    questions: userMessages.slice(-3).map((message) => getMessagePreview(message.content, 130)),
    answers: assistantMessages.slice(-3).map((message) => getMessagePreview(message.content, 170)),
  };
}

function ChatSummaryPanel({
  chat,
  messages,
  isLoading,
}: {
  chat: ChatConversation | null;
  messages: ChatMessage[];
  isLoading: boolean;
}) {
  if (!chat) {
    return (
      <div className="glass-card flex min-h-[18rem] items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Selecione um chat vinculado para ver o resumo e o historico.
      </div>
    );
  }

  if (isLoading) {
    return <div className="glass-card p-5 text-sm text-muted-foreground">Carregando historico do chat...</div>;
  }

  const summary = buildChatSummary(messages);

  return (
    <div className="space-y-5">
      <div className="glass-card p-5">
        <div className="flex items-start gap-3">
          <MessageSquareText size={20} className="mt-1 shrink-0 text-primary" />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground">{chat.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.questionCount} perguntas e {summary.answerCount} respostas da IA
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border/40 bg-secondary/20 p-4">
            <h4 className="text-sm font-semibold text-foreground">Perguntas feitas</h4>
            {summary.questions.length ? (
              <div className="mt-3 space-y-2">
                {summary.questions.map((question, index) => (
                  <p key={`${question}-${index}`} className="rounded-md bg-background/70 p-3 text-sm text-muted-foreground">
                    {question}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Nenhuma pergunta encontrada.</p>
            )}
          </div>

          <div className="rounded-lg border border-border/40 bg-secondary/20 p-4">
            <h4 className="text-sm font-semibold text-foreground">Respostas da IA</h4>
            {summary.answers.length ? (
              <div className="mt-3 space-y-2">
                {summary.answers.map((answer, index) => (
                  <p key={`${answer}-${index}`} className="rounded-md bg-background/70 p-3 text-sm text-muted-foreground">
                    {answer}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Nenhuma resposta encontrada.</p>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Chat original</h3>
        {!messages.length ? (
          <div className="rounded-lg border border-border/30 bg-secondary/30 p-3 text-sm text-muted-foreground">
            Nenhuma mensagem encontrada neste chat.
          </div>
        ) : (
          <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg border p-3 ${
                  message.role === "user"
                    ? "border-primary/30 bg-primary/10"
                    : "border-border/40 bg-secondary/20"
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {message.role === "user" ? "Usuario" : "IA"} - {formatDate(message.createdAt)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{message.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlanDetailPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { data: plan, isLoading, isError } = usePlan(planId);
  const { data: chats = [] } = useChatConversations();
  const { data: categories = [] } = useCategories();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();
  const linkChat = useLinkChatToPlan();
  const unlinkChat = useUnlinkChatFromPlan();
  const [editing, setEditing] = useState(false);
  const [planForm, setPlanForm] = useState<PlanFormState | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkChatId, setLinkChatId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [unlinkingChat, setUnlinkingChat] = useState<ChatConversation | null>(null);
  const [activeChatId, setActiveChatId] = useState("");
  const activeChat = plan?.chats.find((chat) => chat.id === activeChatId) ?? plan?.chats[0] ?? null;
  const { data: activeMessages = [], isLoading: isLoadingMessages } = useChatConversationMessages(activeChat?.id, 100);
  const unlinkedChats = useMemo(() => chats.filter((chat) => chat.planId !== plan?.id), [chats, plan?.id]);

  useEffect(() => {
    if (!plan?.chats.length) {
      setActiveChatId("");
      return;
    }

    if (!activeChatId || !plan.chats.some((chat) => chat.id === activeChatId)) {
      setActiveChatId(plan.chats[0].id);
    }
  }, [activeChatId, plan?.chats]);

  const handleOpenEdit = () => {
    if (!plan) {
      return;
    }

    setPlanForm(createPlanFormFromPlan(plan));
    setEditing(true);
  };

  const handleSubmitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!plan || !planForm) {
      return;
    }

    const validationError = getPlanFormValidationError(planForm);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      await updatePlan.mutateAsync({ planId: plan.id, ...normalizePlanForm(planForm) });
      setEditing(false);
      setPlanForm(null);
    } catch (error) {
      toast.error("Nao foi possivel salvar o planejamento.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleLinkChat = async () => {
    if (!plan || !linkChatId) {
      return;
    }

    try {
      const updatedPlan = await linkChat.mutateAsync({ planId: plan.id, chatId: linkChatId });
      setActiveChatId(linkChatId);
      setLinkDialogOpen(false);
      setLinkChatId("");
      if (!updatedPlan.chats.some((chat) => chat.id === linkChatId)) {
        setActiveChatId(updatedPlan.chats[0]?.id ?? "");
      }
    } catch (error) {
      toast.error("Nao foi possivel vincular o chat.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleConfirmUnlinkChat = async () => {
    if (!plan || !unlinkingChat) {
      return;
    }

    try {
      await unlinkChat.mutateAsync({ planId: plan.id, chatId: unlinkingChat.id });
      setUnlinkingChat(null);
    } catch (error) {
      toast.error("Nao foi possivel desvincular o chat.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleDeletePlan = async () => {
    if (!plan) {
      return;
    }

    try {
      await deletePlan.mutateAsync(plan.id);
      navigate(appRoutes.plans);
    } catch (error) {
      toast.error("Nao foi possivel excluir o planejamento.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  if (isLoading) {
    return (
      <AppShell title="Planejamento" description="Carregando detalhes do planejamento">
        <div className="glass-card p-5 text-sm text-muted-foreground">Carregando planejamento...</div>
      </AppShell>
    );
  }

  if (isError || !plan) {
    return (
      <AppShell title="Planejamento" description="Nao foi possivel carregar este planejamento">
        <div className="glass-card p-6 text-sm text-muted-foreground">
          Planejamento nao encontrado ou indisponivel.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={plan.title} description="Acompanhe metas, resumo e chats vinculados">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="secondary" onClick={() => navigate(appRoutes.plans)}>
          <ChevronLeft size={16} />
          Planejamentos
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleOpenEdit}>
            Editar
          </Button>
          <Button variant="outline" onClick={() => setLinkDialogOpen(true)}>
            <Link2 size={16} />
            Vincular chat
          </Button>
          <Button variant="outline" onClick={() => setDeleting(true)}>
            <Trash2 size={16} />
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="glass-card p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {plan.source === "ai" ? "Gerado com IA" : "Manual"} - {formatDate(plan.updatedAt)}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">{plan.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{plan.description || "Sem descricao."}</p>

            <div className="mt-5 rounded-lg border border-border/40 bg-secondary/20 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{getPlanGoalSummary(plan, categories)}</span>
                <span className="text-muted-foreground">{plan.progress.percentage}%</span>
              </div>
              <Progress value={plan.progress.percentage} className="mt-3 h-2.5 bg-secondary/70" />
              <p className="mt-2 text-xs text-muted-foreground">{getPlanGoalDetail(plan, categories)}</p>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Metas a cumprir</h3>
            {!plan.items.length ? (
              <div className="rounded-lg border border-border/30 bg-secondary/30 p-3 text-sm text-muted-foreground">
                Nenhuma meta cadastrada.
              </div>
            ) : (
              <div className="space-y-3">
                {plan.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/40 bg-secondary/20 p-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2
                        size={18}
                        className={item.status === "done" ? "mt-0.5 text-income" : "mt-0.5 text-muted-foreground"}
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ChatSummaryPanel chat={activeChat} messages={activeMessages} isLoading={isLoadingMessages} />
        </div>

        <aside className="glass-card h-fit p-5">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Chats vinculados</h3>
          {!plan.chats.length ? (
            <div className="rounded-lg border border-border/30 bg-secondary/30 p-3 text-sm text-muted-foreground">
              Nenhum chat vinculado.
            </div>
          ) : (
            <div className="space-y-2">
              {plan.chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`rounded-lg border p-3 ${
                    activeChat?.id === chat.id ? "border-primary/40 bg-primary/10" : "border-border/40 bg-secondary/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" className="min-w-0 text-left" onClick={() => setActiveChatId(chat.id)}>
                      <p className="truncate text-sm font-medium text-foreground">{chat.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(chat.updatedAt)}</p>
                    </button>
                    <Button variant="ghost" size="sm" onClick={() => setUnlinkingChat(chat)}>
                      <Unlink size={15} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <Dialog
        open={editing}
        onOpenChange={(open) => {
          setEditing(open);
          if (!open) {
            setPlanForm(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar planejamento</DialogTitle>
            <DialogDescription>Atualize o resumo, metas e regra de progresso.</DialogDescription>
          </DialogHeader>
          {planForm ? (
            <form onSubmit={handleSubmitEdit} className="space-y-5">
              <PlanFormFields form={planForm} categories={categories} onChange={setPlanForm} />
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updatePlan.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular chat</DialogTitle>
            <DialogDescription>Escolha um chat para anexar ao planejamento.</DialogDescription>
          </DialogHeader>
          <select
            value={linkChatId}
            onChange={(event) => setLinkChatId(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Selecione um chat</option>
            {unlinkedChats.map((chat) => (
              <option key={chat.id} value={chat.id}>
                {chat.title}
              </option>
            ))}
          </select>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setLinkDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleLinkChat} disabled={!linkChatId || linkChat.isPending}>
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir planejamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Os chats vinculados serao mantidos, mas ficarao sem planejamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlan}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir planejamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(unlinkingChat)} onOpenChange={(open) => (!open ? setUnlinkingChat(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular chat?</AlertDialogTitle>
            <AlertDialogDescription>
              O chat "{unlinkingChat?.title}" sera removido deste planejamento, mas a conversa original sera mantida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUnlinkChat}>
              Desvincular chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
