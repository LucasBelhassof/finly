import { FolderKanban, Loader2, Plus, Sparkles, Target } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { useChatConversations } from "@/hooks/use-chat";
import {
  useCreatePlan,
  useGeneratePlanDraft,
  usePlans,
  useSuggestPlanLink,
} from "@/hooks/use-plans";
import { useCategories } from "@/hooks/use-transactions";
import { appRoutes } from "@/lib/routes";
import type {
  CategoryItem,
  CreatePlanInput,
  Plan,
  PlanDraft,
  PlanGoal,
  PlanGoalSource,
  PlanGoalType,
  PlanItemStatus,
  PlanTransactionType,
} from "@/types/api";

export interface PlanFormItem {
  title: string;
  description: string;
  status: PlanItemStatus;
}

export interface PlanFormGoal {
  type: PlanGoalType;
  source: PlanGoalSource;
  targetAmount: string;
  transactionType: PlanTransactionType;
  categoryIds: string[];
  startDate: string;
  endDate: string;
}

export interface PlanFormState {
  title: string;
  description: string;
  goal: PlanFormGoal;
  items: PlanFormItem[];
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthRange() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    startDate: formatInputDate(firstDay),
    endDate: formatInputDate(lastDay),
  };
}

function createEmptyGoal(source: PlanGoalSource = "manual"): PlanFormGoal {
  const range = getCurrentMonthRange();

  return {
    type: "items",
    source,
    targetAmount: "",
    transactionType: "expense",
    categoryIds: [],
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

function createEmptyPlanForm(): PlanFormState {
  return {
    title: "",
    description: "",
    goal: createEmptyGoal("manual"),
    items: [{ title: "", description: "", status: "todo" }],
  };
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatCurrency(value: number | null | undefined) {
  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function formatAmountInput(value: number | null) {
  return value && value > 0 ? String(value).replace(".", ",") : "";
}

function parseAmountInput(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createGoalFormFromGoal(goal: PlanGoal): PlanFormGoal {
  const range = getCurrentMonthRange();

  return {
    type: goal.type,
    source: goal.source,
    targetAmount: formatAmountInput(goal.targetAmount),
    transactionType: goal.transactionType,
    categoryIds: goal.categoryIds.map((categoryId) => String(categoryId)),
    startDate: goal.startDate ?? range.startDate,
    endDate: goal.endDate ?? range.endDate,
  };
}

export function createPlanFormFromPlan(plan: Plan): PlanFormState {
  return {
    title: plan.title,
    description: plan.description,
    goal: createGoalFormFromGoal(plan.goal),
    items: plan.items.length
      ? plan.items.map((item) => ({
          title: item.title,
          description: item.description,
          status: item.status,
        }))
      : [{ title: "", description: "", status: "todo" }],
  };
}

export function createPlanFormFromDraft(draft: PlanDraft): PlanFormState {
  return {
    title: draft.title,
    description: draft.description,
    goal: createGoalFormFromGoal(draft.goal),
    items: draft.items.length
      ? draft.items.map((item) => ({
          title: item.title,
          description: item.description,
          status: item.status,
        }))
      : [{ title: "", description: "", status: "todo" }],
  };
}

export function normalizePlanForm(form: PlanFormState): CreatePlanInput {
  const goal: PlanGoal =
    form.goal.type === "transaction_sum"
      ? {
          type: "transaction_sum",
          source: form.goal.source,
          targetAmount: Number(parseAmountInput(form.goal.targetAmount).toFixed(2)),
          transactionType: form.goal.transactionType,
          categoryIds: form.goal.categoryIds,
          startDate: form.goal.startDate,
          endDate: form.goal.endDate,
        }
      : {
          type: "items",
          source: form.goal.source,
          targetAmount: null,
          transactionType: "expense",
          categoryIds: [],
          startDate: null,
          endDate: null,
        };

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    goal,
    items: form.items
      .map((item, index) => ({
        title: item.title.trim(),
        description: item.description.trim(),
        status: item.status,
        sortOrder: index,
      }))
      .filter((item) => item.title),
  };
}

export function getPlanFormValidationError(form: PlanFormState) {
  if (!form.title.trim()) {
    return "Informe um titulo para o planejamento.";
  }

  if (form.goal.type !== "transaction_sum") {
    return null;
  }

  if (parseAmountInput(form.goal.targetAmount) <= 0) {
    return "Informe o valor alvo da meta financeira.";
  }

  if (!form.goal.startDate || !form.goal.endDate) {
    return "Informe o periodo da meta financeira.";
  }

  if (form.goal.startDate > form.goal.endDate) {
    return "A data inicial precisa ser anterior a data final.";
  }

  return null;
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatGoalDateRange(goal: PlanGoal) {
  const start = formatDate(goal.startDate);
  const end = formatDate(goal.endDate);

  if (!start || !end) {
    return "Periodo nao definido";
  }

  return `${start} a ${end}`;
}

function getTransactionTypeLabel(type: PlanTransactionType) {
  return type === "income" ? "receitas" : "despesas";
}

function getGoalCategoryLabels(goal: PlanGoal, categories: CategoryItem[]) {
  const categoryIds = new Set(goal.categoryIds.map((categoryId) => String(categoryId)));

  if (!categoryIds.size) {
    return `Todas as ${getTransactionTypeLabel(goal.transactionType)}`;
  }

  const labels = categories
    .filter((category) => categoryIds.has(String(category.id)))
    .map((category) => category.label);

  if (!labels.length) {
    return `${categoryIds.size} categorias`;
  }

  return labels.length > 2 ? `${labels.slice(0, 2).join(", ")} +${labels.length - 2}` : labels.join(", ");
}

export function getPlanGoalSummary(plan: Plan, categories: CategoryItem[]) {
  if (plan.goal.type === "transaction_sum") {
    return `${plan.progress.formattedCurrentValue ?? formatCurrency(plan.progress.currentValue)} de ${
      plan.progress.formattedTargetValue ?? formatCurrency(plan.goal.targetAmount)
    }`;
  }

  return `${plan.progress.completedItems ?? 0}/${plan.progress.totalItems ?? 0} itens concluidos`;
}

export function getPlanGoalDetail(plan: Plan, categories: CategoryItem[]) {
  if (plan.goal.type === "transaction_sum") {
    return `${getGoalCategoryLabels(plan.goal, categories)} - ${formatGoalDateRange(plan.goal)}`;
  }

  return plan.goal.source === "ai" ? "Progresso por etapas sugeridas pela IA" : "Progresso por etapas concluidas";
}

export function PlanCard({
  plan,
  categories,
  onSelect,
}: {
  plan: Plan;
  categories: CategoryItem[];
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="glass-card min-h-[15rem] border-border/40 p-5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FolderKanban size={18} className="shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold text-foreground">{plan.title}</span>
        </div>
        <span className="shrink-0 rounded-full bg-secondary/70 px-2 py-1 text-xs text-muted-foreground">
          {plan.progress.percentage}%
        </span>
      </div>

      <p className="mt-3 line-clamp-3 min-h-[3.75rem] text-sm text-muted-foreground">
        {plan.description || "Sem descricao."}
      </p>

      <div className="mt-5 space-y-2">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-foreground">{getPlanGoalSummary(plan, categories)}</span>
          <span className="text-muted-foreground">{plan.goal.type === "transaction_sum" ? "Meta" : "Etapas"}</span>
        </div>
        <Progress value={plan.progress.percentage} className="h-2 bg-secondary/70" />
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Target size={14} className="shrink-0" />
        <span className="line-clamp-2">{getPlanGoalDetail(plan, categories)}</span>
      </div>
    </button>
  );
}

export function PlanFormFields({
  form,
  categories,
  onChange,
}: {
  form: PlanFormState;
  categories: CategoryItem[];
  onChange: (form: PlanFormState) => void;
}) {
  const availableGoalCategories = categories.filter((category) => category.transactionType === form.goal.transactionType);

  const updateGoal = (goal: Partial<PlanFormGoal>) => {
    onChange({
      ...form,
      goal: {
        ...form.goal,
        ...goal,
      },
    });
  };

  const updateItem = (index: number, item: Partial<PlanFormItem>) => {
    onChange({
      ...form,
      items: form.items.map((currentItem, currentIndex) =>
        currentIndex === index ? { ...currentItem, ...item } : currentItem,
      ),
    });
  };

  const removeItem = (index: number) => {
    const nextItems = form.items.filter((_item, currentIndex) => currentIndex !== index);
    onChange({
      ...form,
      items: nextItems.length ? nextItems : [{ title: "", description: "", status: "todo" }],
    });
  };

  const toggleCategory = (categoryId: string, checked: boolean) => {
    const categoryIds = checked
      ? Array.from(new Set([...form.goal.categoryIds, categoryId]))
      : form.goal.categoryIds.filter((currentId) => currentId !== categoryId);

    updateGoal({ categoryIds });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Titulo</label>
        <Input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Descricao</label>
        <Textarea
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          rows={3}
        />
      </div>

      <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tipo de progresso</label>
            <select
              value={form.goal.type}
              onChange={(event) => updateGoal({ type: event.target.value === "transaction_sum" ? "transaction_sum" : "items" })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="items">Itens concluidos</option>
              <option value="transaction_sum">Meta por transacoes</option>
            </select>
          </div>

          {form.goal.type === "transaction_sum" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Valor alvo</label>
              <Input
                value={form.goal.targetAmount}
                onChange={(event) => updateGoal({ targetAmount: event.target.value })}
                placeholder="Ex.: 500,00"
                inputMode="decimal"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Base</label>
              <div className="flex h-10 items-center rounded-md border border-border/40 bg-background px-3 text-sm text-muted-foreground">
                A barra usa os itens marcados como concluidos.
              </div>
            </div>
          )}
        </div>

        {form.goal.type === "transaction_sum" ? (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Transacoes</label>
                <select
                  value={form.goal.transactionType}
                  onChange={(event) =>
                    updateGoal({
                      transactionType: event.target.value === "income" ? "income" : "expense",
                      categoryIds: [],
                    })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="expense">Despesas</option>
                  <option value="income">Receitas</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Inicio</label>
                <Input type="date" value={form.goal.startDate} onChange={(event) => updateGoal({ startDate: event.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Fim</label>
                <Input type="date" value={form.goal.endDate} onChange={(event) => updateGoal({ endDate: event.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Categorias</label>
              <div className="grid max-h-40 grid-cols-1 gap-2 overflow-y-auto rounded-md border border-border/40 bg-background p-3 sm:grid-cols-2">
                {availableGoalCategories.length ? (
                  availableGoalCategories.map((category) => {
                    const categoryId = String(category.id);
                    const checked = form.goal.categoryIds.includes(categoryId);

                    return (
                      <label key={categoryId} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Checkbox checked={checked} onCheckedChange={(value) => toggleCategory(categoryId, Boolean(value))} />
                        <span className="truncate">{category.label}</span>
                      </label>
                    );
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">Nenhuma categoria disponivel.</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Se nenhuma categoria for marcada, todas as categorias deste tipo entram no calculo.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-foreground">Itens do plano</label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onChange({ ...form, items: [...form.items, { title: "", description: "", status: "todo" }] })}
          >
            <Plus size={15} />
            Item
          </Button>
        </div>

        {form.items.map((item, index) => (
          <div key={index} className="rounded-lg border border-border/40 bg-secondary/20 p-3">
            <div className="flex gap-2">
              <Input
                value={item.title}
                onChange={(event) => updateItem(index, { title: event.target.value })}
                placeholder="Acao planejada"
              />
              <select
                value={item.status}
                onChange={(event) => updateItem(index, { status: event.target.value === "done" ? "done" : "todo" })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="todo">A fazer</option>
                <option value="done">Concluido</option>
              </select>
            </div>
            <Textarea
              value={item.description}
              onChange={(event) => updateItem(index, { description: event.target.value })}
              placeholder="Detalhes opcionais"
              className="mt-2"
              rows={2}
            />
            <div className="mt-2 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
                Remover
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlansPage() {
  const { data: plans = [], isLoading, isError } = usePlans();
  const { data: chats = [] } = useChatConversations();
  const { data: categories = [] } = useCategories();
  const navigate = useNavigate();
  const createPlan = useCreatePlan();
  const generateDraft = useGeneratePlanDraft();
  const suggestLink = useSuggestPlanLink();
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [planForm, setPlanForm] = useState<PlanFormState>(() => createEmptyPlanForm());
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiChatId, setAiChatId] = useState("");
  const [aiDraftForm, setAiDraftForm] = useState<PlanFormState | null>(null);
  const [suggestedChatId, setSuggestedChatId] = useState("");

  const handleOpenCreate = () => {
    setPlanForm(createEmptyPlanForm());
    setManualDialogOpen(true);
  };

  const handleSubmitPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = getPlanFormValidationError(planForm);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    const input = normalizePlanForm(planForm);

    try {
      const plan = await createPlan.mutateAsync(input);
      setManualDialogOpen(false);
      navigate(`${appRoutes.plans}/${plan.id}`);
    } catch (error) {
      toast.error("Nao foi possivel salvar o planejamento.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleGenerateDraft = async () => {
    if (!aiChatId) {
      toast.error("Selecione um chat para gerar o planejamento.");
      return;
    }

    try {
      const draft = await generateDraft.mutateAsync(aiChatId);
      setAiDraftForm(createPlanFormFromDraft(draft));
    } catch (error) {
      toast.error("Nao foi possivel gerar o rascunho.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleSaveDraft = async () => {
    if (!aiDraftForm || !aiChatId) {
      return;
    }

    const validationError = getPlanFormValidationError(aiDraftForm);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    const input = normalizePlanForm(aiDraftForm);

    try {
      const plan = await createPlan.mutateAsync({
        ...input,
        source: "ai",
        chatIds: [aiChatId],
      });
      setAiDialogOpen(false);
      setAiDraftForm(null);
      navigate(`${appRoutes.plans}/${plan.id}`);
    } catch (error) {
      toast.error("Nao foi possivel salvar o rascunho.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleSuggestLink = async () => {
    if (!suggestedChatId) {
      toast.error("Selecione um chat para a sugestao.");
      return;
    }

    try {
      const suggestion = await suggestLink.mutateAsync(suggestedChatId);
      if (suggestion.action === "link" && suggestion.planId) {
        toast.success("A IA sugeriu um planejamento existente.", {
          description: suggestion.rationale,
        });
        navigate(`${appRoutes.plans}/${suggestion.planId}`);
      } else {
        toast.message("A IA recomenda criar um novo planejamento.", {
          description: suggestion.rationale,
        });
        setAiChatId(suggestedChatId);
        setAiDialogOpen(true);
      }
    } catch (error) {
      toast.error("Nao foi possivel sugerir um vinculo.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  return (
    <AppShell title="Planejamentos" description="Organize planos financeiros criados manualmente ou a partir dos chats">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleOpenCreate}>
            <Plus size={16} />
            Novo planejamento
          </Button>
          <Button variant="secondary" onClick={() => setAiDialogOpen(true)}>
            <Sparkles size={16} />
            Gerar com IA
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={suggestedChatId}
            onChange={(event) => setSuggestedChatId(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Chat para sugestao</option>
            {chats.map((chat) => (
              <option key={chat.id} value={chat.id}>
                {chat.title}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={handleSuggestLink} disabled={suggestLink.isPending || !suggestedChatId}>
            {suggestLink.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Sugerir vinculo
          </Button>
        </div>
      </div>

      {isLoading ? <div className="glass-card p-5 text-sm text-muted-foreground">Carregando planejamentos...</div> : null}
      {isError ? (
        <div className="glass-card p-5 text-sm text-muted-foreground">Nao foi possivel carregar os planejamentos.</div>
      ) : null}
      {!isLoading && !isError && !plans.length ? (
        <div className="glass-card flex min-h-[18rem] items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Crie um planejamento ou gere um rascunho com IA.
        </div>
      ) : null}

      {!isLoading && !isError && plans.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              categories={categories}
              onSelect={() => navigate(`${appRoutes.plans}/${plan.id}`)}
            />
          ))}
        </div>
      ) : null}

      <Dialog
        open={manualDialogOpen}
        onOpenChange={(open) => {
          setManualDialogOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo planejamento</DialogTitle>
            <DialogDescription>Defina um plano com itens acionaveis e uma meta de progresso.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitPlan} className="space-y-5">
            <PlanFormFields form={planForm} categories={categories} onChange={setPlanForm} />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setManualDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createPlan.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar planejamento com IA</DialogTitle>
            <DialogDescription>Escolha um chat, gere um rascunho e revise antes de salvar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={aiChatId}
                onChange={(event) => {
                  setAiChatId(event.target.value);
                  setAiDraftForm(null);
                }}
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">Selecione um chat</option>
                {chats.map((chat) => (
                  <option key={chat.id} value={chat.id}>
                    {chat.title}
                  </option>
                ))}
              </select>
              <Button onClick={handleGenerateDraft} disabled={generateDraft.isPending || !aiChatId}>
                {generateDraft.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Gerar
              </Button>
            </div>

            {aiDraftForm ? <PlanFormFields form={aiDraftForm} categories={categories} onChange={setAiDraftForm} /> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAiDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDraft} disabled={!aiDraftForm || createPlan.isPending}>
              Salvar planejamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppShell>
  );
}
