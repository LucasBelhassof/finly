import { FolderKanban, Loader2, Plus, Sparkles, Target } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppShell from "@/components/AppShell";
import { ListPaginationBar } from "@/components/ListPaginationBar";
import CreateInvestmentDialog from "@/components/investments/CreateInvestmentDialog";
import { PremiumGate } from "@/components/premium/PremiumGate";
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
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageSizeSelect } from "@/components/ui/page-size-select";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { useChatConversations } from "@/hooks/use-chat";
import { usePagination } from "@/hooks/use-pagination";
import { useCreatePlan, useGeneratePlanDraft, usePlans, useSuggestPlanLink } from "@/hooks/use-plans";
import { useInvestments } from "@/hooks/use-investments";
import { useCategories } from "@/hooks/use-transactions";
import { appRoutes } from "@/lib/routes";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";
import {
  applyCreatedInvestmentToPlanForm,
  buildInvestmentInitialValues,
  createPlanFormFromDraft,
  formatCurrency,
  getErrorMessage,
  getPlanAiStatusLabel,
  getPlanFormValidationError,
  getPlanGoalDetail,
  getPlanGoalSummary,
  type PlanFormGoal,
  type PlanFormItem,
  type PlanFormState,
  normalizePlanForm,
} from "@/pages/plans/shared";
import type {
  CategoryItem,
  Plan,
  PlanDraft,
  PlanDraftClarification,
  PlanGoalTargetModel,
  PlanGoalSource,
  PlanGoalType,
  PlanItemStatus,
  PlanPriority,
  PlanTransactionType,
  InvestmentItem,
} from "@/types/api";

const EMPTY_SELECT_VALUE = "__empty__";
const MODAL_SELECT_TRIGGER_CLASSNAME = "h-11 rounded-xl border-border/60 bg-secondary/35";
const INLINE_SELECT_TRIGGER_CLASSNAME = "h-10 rounded-md border-border/60 bg-background";
const SCROLLABLE_MODAL_CONTENT_CLASSNAME = "h-[65vh] max-h-[40rem]";

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
    targetModel: "category",
    categoryIds: [],
    investmentBoxId: "",
    investmentBox: null,
    investmentBoxIds: [],
    investmentBoxes: [],
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

function createEmptyPlanForm(): PlanFormState {
  return {
    title: "",
    description: "",
    goal: createEmptyGoal("manual"),
    items: [{ title: "", description: "", status: "todo", priority: "medium" }],
    clarifications: [],
  };
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

      {plan.aiAssessment ? (
        <div
          className={`mt-3 inline-flex rounded-full px-2 py-1 text-xs font-medium ${
            plan.aiAssessment.status === "at_risk"
              ? "bg-destructive/10 text-destructive"
              : plan.aiAssessment.status === "attention"
                ? "bg-warning/10 text-warning"
                : "bg-secondary/70 text-muted-foreground"
          }`}
        >
          IA: {getPlanAiStatusLabel(plan.aiAssessment.status)}
        </div>
      ) : null}

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
  investments,
  onChange,
  onCreateInvestment,
}: {
  form: PlanFormState;
  categories: CategoryItem[];
  investments: InvestmentItem[];
  onChange: (form: PlanFormState) => void;
  onCreateInvestment?: () => void;
}) {
  const availableGoalCategories = categories.filter(
    (category) => category.transactionType === form.goal.transactionType,
  );

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
      items: nextItems.length ? nextItems : [{ title: "", description: "", status: "todo", priority: "medium" }],
    });
  };

  const toggleCategory = (categoryId: string, checked: boolean) => {
    const categoryIds = checked
      ? Array.from(new Set([...form.goal.categoryIds, categoryId]))
      : form.goal.categoryIds.filter((currentId) => currentId !== categoryId);

    updateGoal({ categoryIds });
  };

  const toggleInvestment = (investment: InvestmentItem, checked: boolean) => {
    const investmentId = String(investment.id);
    const investmentBoxIds = checked
      ? Array.from(new Set([...form.goal.investmentBoxIds, investmentId]))
      : form.goal.investmentBoxIds.filter((currentId) => currentId !== investmentId);
    const currentDraftBoxes = form.goal.investmentBoxes.filter(
      (currentInvestment) =>
        String(currentInvestment.id) === "investment" || String(currentInvestment.id) === "draft-investment-box",
    );
    const selectedExistingBoxes = investments.filter((item) => investmentBoxIds.includes(String(item.id)));

    updateGoal({
      investmentBoxIds,
      investmentBoxId: investmentBoxIds[0] ?? "",
      investmentBoxes: [...selectedExistingBoxes, ...currentDraftBoxes],
      investmentBox: selectedExistingBoxes[0] ?? currentDraftBoxes[0] ?? null,
    });
  };

  const selectedInvestments = [
    ...investments.filter((investment) => form.goal.investmentBoxIds.includes(String(investment.id))),
    ...form.goal.investmentBoxes.filter(
      (investment) => String(investment.id) === "investment" || String(investment.id) === "draft-investment-box",
    ),
  ];

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

      {form.clarifications.length ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <p className="font-medium">Perguntas pendentes da IA</p>
          <div className="mt-2 space-y-1">
            {form.clarifications.map((clarification) => (
              <p key={clarification.id}>{clarification.question}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tipo de progresso</label>
            <Select
              value={form.goal.type}
              onValueChange={(value: PlanGoalType) =>
                updateGoal({
                  type: value === "transaction_sum" ? "transaction_sum" : "items",
                })
              }
            >
              <SelectTrigger className={MODAL_SELECT_TRIGGER_CLASSNAME}>
                <SelectValue placeholder="Tipo de progresso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="items">Itens concluidos</SelectItem>
                <SelectItem value="transaction_sum">Meta por transacoes</SelectItem>
              </SelectContent>
            </Select>
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
                <Select
                  value={form.goal.transactionType}
                  onValueChange={(value: PlanTransactionType) =>
                    updateGoal({
                      transactionType: value === "income" ? "income" : "expense",
                      categoryIds: [],
                      investmentBoxId: "",
                      investmentBoxIds: form.goal.targetModel === "investment_box" ? form.goal.investmentBoxIds : [],
                      investmentBoxes: form.goal.targetModel === "investment_box" ? form.goal.investmentBoxes : [],
                      investmentBox:
                        form.goal.targetModel === "investment_box" ? (form.goal.investmentBoxes[0] ?? null) : null,
                    })
                  }
                >
                  <SelectTrigger className={MODAL_SELECT_TRIGGER_CLASSNAME}>
                    <SelectValue placeholder="Transacoes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Despesas</SelectItem>
                    <SelectItem value="income">Receitas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Inicio</label>
                <DatePickerInput
                  value={form.goal.startDate}
                  onChange={(value) => updateGoal({ startDate: value })}
                  placeholder="Selecionar data inicial"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Fim</label>
                <DatePickerInput
                  value={form.goal.endDate}
                  onChange={(value) => updateGoal({ endDate: value })}
                  placeholder="Selecionar data final"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Acompanhar por</label>
              <Select
                value={form.goal.targetModel}
                onValueChange={(value: PlanGoalTargetModel) => {
                  const nextTargetModel = value === "investment_box" ? "investment_box" : "category";
                  updateGoal({
                    targetModel: nextTargetModel,
                    transactionType: nextTargetModel === "investment_box" ? "income" : form.goal.transactionType,
                    categoryIds: nextTargetModel === "category" ? form.goal.categoryIds : [],
                    investmentBoxId: nextTargetModel === "investment_box" ? (form.goal.investmentBoxIds[0] ?? "") : "",
                    investmentBox: nextTargetModel === "investment_box" ? (form.goal.investmentBoxes[0] ?? null) : null,
                    investmentBoxIds: nextTargetModel === "investment_box" ? form.goal.investmentBoxIds : [],
                    investmentBoxes: nextTargetModel === "investment_box" ? form.goal.investmentBoxes : [],
                  });
                }}
              >
                <SelectTrigger className={MODAL_SELECT_TRIGGER_CLASSNAME}>
                  <SelectValue placeholder="Acompanhar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Categorias</SelectItem>
                  <SelectItem value="investment_box">Caixinha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.goal.targetModel === "category" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Categorias</label>
                <ScrollArea className="h-40 rounded-md border border-border/40 bg-background">
                  <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                    {availableGoalCategories.length ? (
                      availableGoalCategories.map((category) => {
                        const categoryId = String(category.id);
                        const checked = form.goal.categoryIds.includes(categoryId);

                        return (
                          <label key={categoryId} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => toggleCategory(categoryId, Boolean(value))}
                            />
                            <span className="truncate">{category.label}</span>
                          </label>
                        );
                      })
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhuma categoria disponivel.</span>
                    )}
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground">
                  Se nenhuma categoria for marcada, todas as categorias deste tipo entram no calculo.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Caixinhas de referencia</label>
                <ScrollArea className="h-40 rounded-md border border-border/40 bg-background">
                  <div className="space-y-2 p-3">
                    {investments.length ? (
                      investments.map((investment) => {
                        const investmentId = String(investment.id);
                        const checked = form.goal.investmentBoxIds.includes(investmentId);

                        return (
                          <label key={investmentId} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => toggleInvestment(investment, Boolean(value))}
                            />
                            <span className="min-w-0 flex-1 truncate">{investment.name}</span>
                            <span className="shrink-0 text-xs">{investment.formattedCurrentAmount}</span>
                          </label>
                        );
                      })
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhuma caixinha disponivel.</span>
                    )}
                  </div>
                </ScrollArea>
                {onCreateInvestment ? (
                  <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onCreateInvestment}>
                    <Plus size={14} />
                    Criar caixinha
                  </Button>
                ) : null}
                {selectedInvestments.length ? (
                  <div className="space-y-2">
                    {selectedInvestments.map((investment) => (
                      <div
                        key={investment.id}
                        className="rounded-md border border-border/40 bg-background p-3 text-sm text-muted-foreground"
                      >
                        <p className="font-medium text-foreground">{investment.name}</p>
                        <p className="mt-1">
                          {investment.contributionMode === "income_percentage"
                            ? `${investment.incomePercentage ?? 0}% da receita`
                            : `${formatCurrency(investment.fixedAmount)} fixo`}
                        </p>
                        <p className="mt-1">Saldo atual: {investment.formattedCurrentAmount}</p>
                        {investment.id === "investment" || investment.id === "draft-investment-box" ? (
                          <p className="mt-2 text-xs text-primary">
                            Esta caixinha sera criada automaticamente ao salvar o planejamento.
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {onCreateInvestment
                      ? "Escolha uma ou mais caixinhas existentes, crie uma nova ou mantenha a sugestao criada pela IA no rascunho."
                      : "Escolha uma ou mais caixinhas existentes ou mantenha a sugestao criada pela IA no rascunho."}
                  </p>
                )}
              </div>
            )}
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
            onClick={() =>
              onChange({
                ...form,
                items: [...form.items, { title: "", description: "", status: "todo", priority: "medium" }],
              })
            }
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
              <Select
                value={item.status}
                onValueChange={(value: PlanItemStatus) =>
                  updateItem(index, { status: value === "done" ? "done" : "todo" })
                }
              >
                <SelectTrigger className={`w-[140px] ${INLINE_SELECT_TRIGGER_CLASSNAME}`}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">A fazer</SelectItem>
                  <SelectItem value="done">Concluido</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={item.priority}
                onValueChange={(value: PlanPriority) =>
                  updateItem(index, {
                    priority: value === "high" || value === "low" ? value : "medium",
                  })
                }
              >
                <SelectTrigger className={`w-[150px] ${INLINE_SELECT_TRIGGER_CLASSNAME}`}>
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
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
  const { user } = useAuthContext();
  const isPremiumUser = Boolean(user?.isPremium);
  const { data: plans = [], isLoading, isError } = usePlans();
  const { data: chats = [] } = useChatConversations({ enabled: isPremiumUser });
  const { data: categories = [] } = useCategories();
  const { data: investments = [] } = useInvestments();
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
  const [investmentDialogContext, setInvestmentDialogContext] = useState<"manual" | "ai" | null>(null);

  const {
    page: plansPage,
    pageSize: plansPageSize,
    totalPages: plansTotalPages,
    setPage: setPlansPage,
    setPageSize: setPlansPageSize,
    paginate: paginatePlans,
  } = usePagination(plans.length);
  const paginatedPlans = paginatePlans(plans);

  const createInvestmentInitialValues = useMemo(
    () => buildInvestmentInitialValues(investmentDialogContext === "ai" ? aiDraftForm : planForm),
    [aiDraftForm, investmentDialogContext, planForm],
  );

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

  const handleCreatedInvestment = (investment: InvestmentItem) => {
    if (investmentDialogContext === "ai") {
      setAiDraftForm((currentForm) =>
        currentForm ? applyCreatedInvestmentToPlanForm(currentForm, investment) : currentForm,
      );
      return;
    }

    setPlanForm((currentForm) => applyCreatedInvestmentToPlanForm(currentForm, investment));
  };

  return (
    <AppShell title="Planejamentos" description="Organize planos financeiros criados manualmente ou a partir dos chats">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleOpenCreate}>
            <Plus size={16} />
            Novo planejamento
          </Button>
          <PremiumGate featureLabel="Geração de planejamento com IA" mode="inline">
            <Button variant="secondary" onClick={() => setAiDialogOpen(true)}>
              <Sparkles size={16} />
              Gerar com IA
            </Button>
          </PremiumGate>
        </div>

        <PremiumGate
          featureLabel="Sugestão de vínculo por IA"
          mode="inline"
          description="A IA pode sugerir quando um chat deve virar um novo planejamento ou ser vinculado a um existente."
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={suggestedChatId || EMPTY_SELECT_VALUE}
              onValueChange={(value) => setSuggestedChatId(value === EMPTY_SELECT_VALUE ? "" : value)}
            >
              <SelectTrigger className={`min-w-[220px] ${INLINE_SELECT_TRIGGER_CLASSNAME}`}>
                <SelectValue placeholder="Chat para sugestao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>Chat para sugestao</SelectItem>
                {chats.map((chat) => (
                  <SelectItem key={chat.id} value={chat.id}>
                    {chat.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleSuggestLink} disabled={suggestLink.isPending || !suggestedChatId}>
              {suggestLink.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Sugerir vinculo
            </Button>
          </div>
        </PremiumGate>
      </div>

      {isLoading ? (
        <div className="glass-card p-5 text-sm text-muted-foreground">Carregando planejamentos...</div>
      ) : null}
      {isError ? (
        <div className="glass-card p-5 text-sm text-muted-foreground">Nao foi possivel carregar os planejamentos.</div>
      ) : null}
      {!isLoading && !isError && !plans.length ? (
        <div className="glass-card flex min-h-[18rem] items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Crie um planejamento ou gere um rascunho com IA.
        </div>
      ) : null}

      {!isLoading && !isError && plans.length ? (
        <>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{plans.length} planejamentos</span>
            <PageSizeSelect value={plansPageSize} onChange={setPlansPageSize} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                categories={categories}
                onSelect={() => navigate(`${appRoutes.plans}/${plan.id}`)}
              />
            ))}
          </div>
          <ListPaginationBar
            page={plansPage}
            totalPages={plansTotalPages}
            totalItems={plans.length}
            pageSize={plansPageSize}
            onPageChange={setPlansPage}
            itemLabel="planejamentos"
          />
        </>
      ) : null}

      <Dialog
        open={manualDialogOpen}
        onOpenChange={(open) => {
          setManualDialogOpen(open);
          if (!open) {
            setInvestmentDialogContext(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo planejamento</DialogTitle>
            <DialogDescription>Defina um plano com itens acionaveis e uma meta de progresso.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitPlan} className="space-y-5">
            <ScrollArea className={SCROLLABLE_MODAL_CONTENT_CLASSNAME}>
              <div className="pr-4">
                <PlanFormFields
                  form={planForm}
                  categories={categories}
                  investments={investments}
                  onChange={setPlanForm}
                  onCreateInvestment={() => setInvestmentDialogContext("manual")}
                />
              </div>
            </ScrollArea>
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

      <Dialog
        open={aiDialogOpen}
        onOpenChange={(open) => {
          setAiDialogOpen(open);
          if (!open) {
            setInvestmentDialogContext(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar planejamento com IA</DialogTitle>
            <DialogDescription>Escolha um chat, gere um rascunho e revise antes de salvar.</DialogDescription>
          </DialogHeader>
          <PremiumGate featureLabel="Rascunho de planejamento com IA">
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={aiChatId || EMPTY_SELECT_VALUE}
                  onValueChange={(value) => {
                    setAiChatId(value === EMPTY_SELECT_VALUE ? "" : value);
                    setAiDraftForm(null);
                  }}
                >
                  <SelectTrigger className={`flex-1 ${MODAL_SELECT_TRIGGER_CLASSNAME}`}>
                    <SelectValue placeholder="Selecione um chat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_SELECT_VALUE}>Selecione um chat</SelectItem>
                    {chats.map((chat) => (
                      <SelectItem key={chat.id} value={chat.id}>
                        {chat.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleGenerateDraft} disabled={generateDraft.isPending || !aiChatId}>
                  {generateDraft.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Gerar
                </Button>
              </div>

              {aiDraftForm ? (
                <ScrollArea className={SCROLLABLE_MODAL_CONTENT_CLASSNAME}>
                  <div className="pr-4">
                    <PlanFormFields
                      form={aiDraftForm}
                      categories={categories}
                      investments={investments}
                      onChange={setAiDraftForm}
                      onCreateInvestment={() => setInvestmentDialogContext("ai")}
                    />
                  </div>
                </ScrollArea>
              ) : null}
            </div>
          </PremiumGate>
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

      <CreateInvestmentDialog
        open={investmentDialogContext !== null}
        onOpenChange={(open) => setInvestmentDialogContext(open ? investmentDialogContext : null)}
        onCreated={handleCreatedInvestment}
        initialValues={createInvestmentInitialValues}
      />
    </AppShell>
  );
}
