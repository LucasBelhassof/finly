import {
  formatDecimalInput,
  parseDecimalInput,
  type InvestmentCoreFormState,
} from "@/components/investments/investment-form-utils";
import type {
  CategoryItem,
  CreatePlanInput,
  InvestmentItem,
  Plan,
  PlanAiAssessmentStatus,
  PlanDraft,
  PlanDraftClarification,
  PlanGoal,
  PlanGoalSource,
  PlanGoalTargetModel,
  PlanGoalType,
  PlanItemStatus,
  PlanPriority,
  PlanTransactionType,
} from "@/types/api";

export interface PlanFormItem {
  title: string;
  description: string;
  status: PlanItemStatus;
  priority: PlanPriority;
}

export interface PlanFormGoal {
  type: PlanGoalType;
  source: PlanGoalSource;
  targetAmount: string;
  transactionType: PlanTransactionType;
  targetModel: PlanGoalTargetModel;
  categoryIds: string[];
  investmentBoxId: string;
  investmentBox: InvestmentItem | null;
  investmentBoxIds: string[];
  investmentBoxes: InvestmentItem[];
  startDate: string;
  endDate: string;
}

export interface PlanFormState {
  title: string;
  description: string;
  goal: PlanFormGoal;
  items: PlanFormItem[];
  clarifications: PlanDraftClarification[];
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

function getInclusiveMonthSpan(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return 1;
  }

  return Math.max((end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1, 1);
}

function formatCurrency(value: number | null | undefined) {
  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

export { formatCurrency };

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
  const investmentBoxIds = Array.from(
    new Set([...goal.investmentBoxIds.map(String), ...(goal.investmentBoxId ? [String(goal.investmentBoxId)] : [])]),
  );
  const investmentBoxes = goal.investmentBoxes.length
    ? goal.investmentBoxes
    : goal.investmentBox
      ? [goal.investmentBox]
      : [];

  return {
    type: goal.type,
    source: goal.source,
    targetAmount: formatAmountInput(goal.targetAmount),
    transactionType: goal.transactionType,
    targetModel: goal.targetModel,
    categoryIds: goal.categoryIds.map((categoryId) => String(categoryId)),
    investmentBoxId: investmentBoxIds[0] ?? "",
    investmentBox: investmentBoxes[0] ?? null,
    investmentBoxIds,
    investmentBoxes,
    startDate: goal.type === "transaction_sum" ? (goal.startDate ?? "") : (goal.startDate ?? range.startDate),
    endDate: goal.type === "transaction_sum" ? (goal.endDate ?? "") : (goal.endDate ?? range.endDate),
  };
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
  if (goal.targetModel === "investment_box") {
    const names = goal.investmentBoxes.map((investment) => investment.name).filter(Boolean);

    if (!names.length && goal.investmentBox?.name) {
      return goal.investmentBox.name;
    }

    if (!names.length) {
      return "Caixinha";
    }

    return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
  }

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

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
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
          priority: item.priority,
        }))
      : [{ title: "", description: "", status: "todo", priority: "medium" }],
    clarifications: [],
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
          priority: item.priority,
        }))
      : [{ title: "", description: "", status: "todo", priority: "medium" }],
    clarifications: draft.clarifications,
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
          targetModel: form.goal.targetModel,
          categoryIds: form.goal.targetModel === "category" ? form.goal.categoryIds : [],
          investmentBoxId:
            form.goal.targetModel === "investment_box" && form.goal.investmentBoxIds[0]
              ? form.goal.investmentBoxIds[0]
              : null,
          investmentBox: form.goal.targetModel === "investment_box" ? (form.goal.investmentBoxes[0] ?? null) : null,
          investmentBoxIds: form.goal.targetModel === "investment_box" ? form.goal.investmentBoxIds : [],
          investmentBoxes: form.goal.targetModel === "investment_box" ? form.goal.investmentBoxes : [],
          startDate: form.goal.startDate || null,
          endDate: form.goal.endDate || null,
        }
      : {
          type: "items",
          source: form.goal.source,
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
        priority: item.priority,
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

  if (form.clarifications.some((clarification) => clarification.required)) {
    return "Responda as perguntas pendentes da IA antes de confirmar o planejamento.";
  }

  if (form.goal.targetModel === "category" && (!form.goal.startDate || !form.goal.endDate)) {
    return "Informe o periodo da meta financeira.";
  }

  if (form.goal.startDate && form.goal.endDate && form.goal.startDate > form.goal.endDate) {
    return "A data inicial precisa ser anterior a data final.";
  }

  if (
    form.goal.targetModel === "investment_box" &&
    !form.goal.investmentBoxIds.length &&
    !form.goal.investmentBoxes.length
  ) {
    return "Selecione ou crie pelo menos uma caixinha para a meta.";
  }

  return null;
}

export function buildInvestmentInitialValues(form: PlanFormState | null): Partial<InvestmentCoreFormState> | undefined {
  if (!form) {
    return undefined;
  }

  const suggestedInvestment = form.goal.investmentBoxes[0] ?? form.goal.investmentBox;
  const parsedTargetAmount = parseDecimalInput(form.goal.targetAmount);
  const hasPlanningTargetAmount = Number.isFinite(parsedTargetAmount) && parsedTargetAmount > 0;
  const targetAmount = hasPlanningTargetAmount
    ? formatDecimalInput(Number(parsedTargetAmount.toFixed(2)))
    : suggestedInvestment?.targetAmount !== null && suggestedInvestment?.targetAmount !== undefined
      ? formatDecimalInput(suggestedInvestment.targetAmount)
      : "";
  const suggestedFixedAmount = hasPlanningTargetAmount
    ? formatDecimalInput(
        Number((parsedTargetAmount / getInclusiveMonthSpan(form.goal.startDate, form.goal.endDate)).toFixed(2)),
      )
    : suggestedInvestment?.fixedAmount && suggestedInvestment.fixedAmount > 0
      ? formatDecimalInput(suggestedInvestment.fixedAmount)
      : "";
  const contributionMode = hasPlanningTargetAmount
    ? "fixed_amount"
    : (suggestedInvestment?.contributionMode ?? "fixed_amount");

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

export function applyCreatedInvestmentToPlanForm(form: PlanFormState, investment: InvestmentItem): PlanFormState {
  return {
    ...form,
    goal: {
      ...form.goal,
      targetModel: "investment_box",
      transactionType: "income",
      investmentBoxId: String(investment.id),
      investmentBox: investment,
      investmentBoxIds: Array.from(new Set([...form.goal.investmentBoxIds, String(investment.id)])),
      investmentBoxes: [
        ...form.goal.investmentBoxes.filter(
          (currentInvestment) =>
            String(currentInvestment.id) !== "investment" &&
            String(currentInvestment.id) !== "draft-investment-box" &&
            String(currentInvestment.id) !== String(investment.id),
        ),
        investment,
      ],
    },
  };
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

export function getPlanGoalSummary(plan: Plan, _categories: CategoryItem[]) {
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

export function getPlanAiStatusLabel(status: PlanAiAssessmentStatus) {
  switch (status) {
    case "completed":
      return "Concluido";
    case "at_risk":
      return "Em risco";
    case "attention":
      return "Atencao";
    default:
      return "No ritmo";
  }
}

export function getPriorityLabel(priority: PlanPriority) {
  return priority === "high" ? "Alta" : priority === "low" ? "Baixa" : "Media";
}
