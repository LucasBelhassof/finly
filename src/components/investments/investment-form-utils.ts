import type { CreateInvestmentInput, InvestmentContributionMode, InvestmentStatus } from "@/types/api";

export const NO_BANK_CONNECTION_VALUE = "none";

export type InvestmentCoreFormState = {
  name: string;
  description: string;
  contributionMode: InvestmentContributionMode;
  fixedAmount: string;
  incomePercentage: string;
  currentAmount: string;
  targetAmount: string;
  status: InvestmentStatus;
  color: string;
  notes: string;
  bankConnectionId: string;
};

export function parseDecimalInput(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function formatDecimalInput(value: number | null) {
  return value === null ? "" : String(value).replace(".", ",");
}

export function buildEmptyInvestmentCoreForm(): InvestmentCoreFormState {
  return {
    name: "",
    description: "",
    contributionMode: "fixed_amount",
    fixedAmount: "",
    incomePercentage: "",
    currentAmount: "0",
    targetAmount: "",
    status: "active",
    color: "",
    notes: "",
    bankConnectionId: NO_BANK_CONNECTION_VALUE,
  };
}

export function getInvestmentCoreFormError(form: InvestmentCoreFormState) {
  if (!form.name.trim()) {
    return "Informe o nome da caixinha.";
  }

  const currentAmount = parseDecimalInput(form.currentAmount || "0");

  if (!Number.isFinite(currentAmount) || currentAmount < 0) {
    return "Informe um saldo atual válido.";
  }

  if (form.targetAmount.trim()) {
    const targetAmount = parseDecimalInput(form.targetAmount);

    if (!Number.isFinite(targetAmount) || targetAmount < 0) {
      return "Informe um valor alvo válido.";
    }
  }

  if (form.contributionMode === "fixed_amount") {
    const fixedAmount = parseDecimalInput(form.fixedAmount);

    if (!Number.isFinite(fixedAmount) || fixedAmount < 0) {
      return "Informe um aporte fixo válido.";
    }
  }

  if (form.contributionMode === "income_percentage") {
    const incomePercentage = parseDecimalInput(form.incomePercentage);

    if (!Number.isFinite(incomePercentage) || incomePercentage < 0 || incomePercentage > 100) {
      return "Informe um percentual de receita entre 0 e 100.";
    }
  }

  return null;
}

export function normalizeInvestmentCoreForm(form: InvestmentCoreFormState): CreateInvestmentInput {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    contributionMode: form.contributionMode,
    fixedAmount:
      form.contributionMode === "fixed_amount" ? Number(parseDecimalInput(form.fixedAmount).toFixed(2)) : null,
    incomePercentage:
      form.contributionMode === "income_percentage"
        ? Number(parseDecimalInput(form.incomePercentage).toFixed(2))
        : null,
    currentAmount: Number(parseDecimalInput(form.currentAmount || "0").toFixed(2)),
    targetAmount: form.targetAmount.trim() ? Number(parseDecimalInput(form.targetAmount).toFixed(2)) : null,
    status: form.status,
    color: form.color.trim() || null,
    notes: form.notes.trim(),
    bankConnectionId: form.bankConnectionId === NO_BANK_CONNECTION_VALUE ? null : form.bankConnectionId,
  };
}
