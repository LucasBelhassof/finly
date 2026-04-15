import { Building2, Car, Droplets, Home, Landmark, Lightbulb, Pencil, Plug, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useBanks } from "@/hooks/use-banks";
import { useCreateHousing, useDeleteHousing, useHousing, useUpdateHousing } from "@/hooks/use-housing";
import { useCategories } from "@/hooks/use-transactions";
import type { CategoryItem, CreateHousingInput, HousingExpenseType, HousingItem, UpdateHousingInput } from "@/types/api";

type HousingFormState = {
  description: string;
  type: HousingExpenseType;
  amount: string;
  startDate: string;
  installmentCount: string;
  bankConnectionId: string;
  notes: string;
};

const expenseTypeOptions: Array<{ value: HousingExpenseType; label: string; icon: typeof Home }> = [
  { value: "rent", label: "Aluguel", icon: Home },
  { value: "home_financing", label: "Financiamento da casa", icon: Landmark },
  { value: "electricity", label: "Luz", icon: Plug },
  { value: "water", label: "Agua", icon: Droplets },
  { value: "condo", label: "Condominio", icon: Building2 },
  { value: "vehicle_financing", label: "Financiamento de automovel", icon: Car },
  { value: "other", label: "Outro gasto recorrente", icon: Lightbulb },
];

function buildEmptyForm(): HousingFormState {
  return {
    description: "",
    type: "rent",
    amount: "",
    startDate: new Date().toISOString().slice(0, 10),
    installmentCount: "",
    bankConnectionId: "none",
    notes: "",
  };
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatCurrencyForInput(value: number) {
  return String(value).replace(".", ",");
}

function getExpenseTypeLabel(type: HousingExpenseType) {
  return expenseTypeOptions.find((option) => option.value === type)?.label ?? "Outro gasto recorrente";
}

function resolveHousingCategoryId(categories: CategoryItem[], type: HousingExpenseType) {
  const preferredSlug = type === "electricity" ? "energia" : "moradia";
  const preferred = categories.find((category) => category.transactionType === "expense" && category.slug === preferredSlug);

  if (preferred) {
    return preferred.id;
  }

  return categories.find((category) => category.transactionType === "expense" && category.groupSlug === "moradia")?.id;
}

function isFinancingType(type: HousingExpenseType) {
  return type === "home_financing" || type === "vehicle_financing";
}

function getDueDayFromDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return Number.NaN;
  }

  return day;
}

export default function HousingPage() {
  const { data: banks = [], isLoading: banksLoading } = useBanks();
  const { data: categories = [] } = useCategories();
  const { data: expenses = [], isLoading: housingLoading, isError: housingError } = useHousing();
  const createHousing = useCreateHousing();
  const updateHousing = useUpdateHousing();
  const deleteHousing = useDeleteHousing();
  const [form, setForm] = useState<HousingFormState>(() => buildEmptyForm());
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const transactionAccounts = useMemo(() => banks.filter((bank) => bank.accountType !== "credit_card"), [banks]);
  const monthlyTotal = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount, 0), [expenses]);
  const linkedExpensesCount = expenses.length;
  const editingExpense = expenses.find((expense) => String(expense.id) === editingExpenseId) ?? null;
  const isSaving = createHousing.isPending || updateHousing.isPending;
  const isDeleting = deleteHousing.isPending;
  const isFinancing = isFinancingType(form.type);

  const resetForm = () => {
    setForm(buildEmptyForm());
    setEditingExpenseId(null);
  };

  const startEditExpense = (expense: HousingItem) => {
    setEditingExpenseId(String(expense.id));
    setForm({
      description: expense.description,
      type: expense.expenseType,
      amount: formatCurrencyForInput(expense.amount),
      startDate: expense.startDate,
      installmentCount: expense.installmentCount ? String(expense.installmentCount) : "",
      bankConnectionId: String(expense.bank.id),
      notes: expense.notes,
    });
  };

  const buildPayload = () => {
    const amount = parseCurrencyInput(form.amount);
    const dueDay = getDueDayFromDate(form.startDate);
    const installmentCount = Number(form.installmentCount);

    if (
      !form.description.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isInteger(dueDay) ||
      dueDay < 1 ||
      dueDay > 31 ||
      !form.startDate ||
      form.bankConnectionId === "none"
    ) {
      toast.error("Informe descricao, valor, data da cobranca e conta validos.");
      return null;
    }

    if (isFinancing && (!Number.isInteger(installmentCount) || installmentCount < 2)) {
      toast.error("Financiamentos exigem numero de parcelas maior ou igual a 2.");
      return null;
    }

    const categoryId = resolveHousingCategoryId(categories, form.type);

    return {
      description: form.description.trim(),
      expenseType: form.type,
      amount,
      dueDay,
      startDate: form.startDate,
      bankConnectionId: form.bankConnectionId,
      installmentCount: isFinancing ? installmentCount : null,
      notes: form.notes.trim(),
      status: "active",
      ...(categoryId ? { categoryId } : {}),
    } satisfies CreateHousingInput;
  };

  const handleSaveExpense = async () => {
    const payload = buildPayload();

    if (!payload) {
      return;
    }

    try {
      if (editingExpense) {
        await updateHousing.mutateAsync({
          id: editingExpense.id,
          ...payload,
        } satisfies UpdateHousingInput);
        resetForm();
        toast.success("Despesa de habitacao atualizada.");
        return;
      }

      await createHousing.mutateAsync(payload);
      resetForm();
      toast.success("Despesa recorrente adicionada nas transacoes.");
    } catch (error) {
      toast.error(editingExpense ? "Nao foi possivel atualizar a despesa." : "Nao foi possivel criar a despesa.", {
        description: error instanceof Error && error.message ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleDeleteExpense = async (expense: HousingItem) => {
    try {
      await deleteHousing.mutateAsync(expense.id);

      if (editingExpenseId === String(expense.id)) {
        resetForm();
      }

      toast.success("Despesa de habitacao excluida.");
    } catch (error) {
      toast.error("Nao foi possivel excluir a despesa.", {
        description: error instanceof Error && error.message ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  return (
    <AppShell title="Habitacao" description="Organize moradia, contas essenciais e financiamentos vinculados a bancos">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Compromisso mensal</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{currencyFormatter.format(monthlyTotal)}</p>
        </div>
        <div className="glass-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Despesas recorrentes</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{expenses.length}</p>
        </div>
        <div className="glass-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Vinculadas a bancos</p>
          <p className="mt-1 text-2xl font-bold text-primary">{linkedExpensesCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-foreground">
            {editingExpense ? "Editar despesa recorrente" : "Nova despesa recorrente"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre aluguel, financiamento, luz, agua, condominio ou financiamento de automovel.
          </p>

          <div className="mt-5 space-y-4">
            <Input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Ex: Financiamento do apartamento"
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />

            <Select
              value={form.type}
              onValueChange={(value: HousingExpenseType) =>
                setForm((current) => ({
                  ...current,
                  type: value,
                  installmentCount: isFinancingType(value) ? current.installmentCount : "",
                }))
              }
            >
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                <SelectValue placeholder="Tipo de gasto" />
              </SelectTrigger>
              <SelectContent>
                {expenseTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={form.amount}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              placeholder="Valor mensal"
              inputMode="decimal"
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />

            <DatePickerInput
              value={form.startDate}
              onChange={(value) => setForm((current) => ({ ...current, startDate: value }))}
              placeholder="Selecione a data da cobranca"
            />

            {isFinancing ? (
              <Input
                value={form.installmentCount}
                onChange={(event) => setForm((current) => ({ ...current, installmentCount: event.target.value }))}
                placeholder="Numero de parcelas"
                inputMode="numeric"
                className="h-11 rounded-xl border-border/60 bg-secondary/35"
              />
            ) : null}

            <Select value={form.bankConnectionId} onValueChange={(value) => setForm((current) => ({ ...current, bankConnectionId: value }))}>
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                <SelectValue placeholder="Conta ou banco da transacao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione uma conta</SelectItem>
                {transactionAccounts.map((bank) => (
                  <SelectItem key={bank.id} value={String(bank.id)}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Observacao opcional"
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />

            <div className="flex flex-col gap-2 sm:flex-row">
              {editingExpense ? (
                <Button variant="outline" className="w-full shrink-0 sm:w-auto" onClick={resetForm} disabled={isSaving}>
                  <X size={16} />
                  Cancelar
                </Button>
              ) : null}
              <Button className="w-full flex-1" onClick={() => void handleSaveExpense()} disabled={isSaving}>
                <Plus size={16} />
                {isSaving ? "Salvando..." : editingExpense ? "Salvar alteracoes" : "Adicionar despesa"}
              </Button>
            </div>

            {banksLoading ? (
              <p className="text-xs text-muted-foreground">Carregando bancos cadastrados...</p>
            ) : !transactionAccounts.length ? (
              <p className="text-xs text-muted-foreground">
                Cadastre uma conta bancaria ou caixa em Contas para lancar despesas de habitacao em Transacoes.
              </p>
            ) : null}
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">Despesas de habitacao</h2>
            <p className="text-sm text-muted-foreground">
              Financiamentos de carro, moto, casa ou apartamento podem ser vinculados ao banco onde foram contratados.
            </p>
          </div>

          {housingLoading ? (
            <div className="rounded-2xl border border-border/40 bg-secondary/20 p-5 text-sm text-muted-foreground">
              Carregando despesas de habitacao...
            </div>
          ) : housingError ? (
            <div className="rounded-2xl border border-border/40 bg-secondary/20 p-5 text-sm text-muted-foreground">
              Nao foi possivel carregar as despesas de habitacao.
            </div>
          ) : !expenses.length ? (
            <div className="rounded-2xl border border-dashed border-border/40 bg-secondary/20 p-5 text-sm text-muted-foreground">
              Nenhuma despesa de habitacao cadastrada ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => {
                const option = expenseTypeOptions.find((item) => item.value === expense.expenseType);
                const Icon = option?.icon ?? Lightbulb;

                return (
                  <div key={expense.id} className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="break-words text-base font-semibold text-foreground">{expense.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {getExpenseTypeLabel(expense.expenseType)} · vence dia {expense.dueDay}
                          </p>
                          <p className="text-sm text-muted-foreground">{expense.bank.name}</p>
                          {expense.installmentCount ? (
                            <p className="text-xs text-primary">
                              {expense.transactionIds.length} de {expense.installmentCount} parcelas geradas
                            </p>
                          ) : (
                            <p className="text-xs text-primary">Lancada em Transacoes #{expense.transactionIds[0] ?? "--"}</p>
                          )}
                          {expense.notes ? <p className="mt-1 text-sm text-muted-foreground">{expense.notes}</p> : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between md:flex-col md:items-end">
                        <p className="text-lg font-bold text-foreground">{currencyFormatter.format(expense.amount)}</p>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${expense.description}`}
                            onClick={() => startEditExpense(expense)}
                            disabled={isSaving || isDeleting}
                          >
                            <Pencil size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Excluir ${expense.description}`}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => void handleDeleteExpense(expense)}
                            disabled={isSaving || isDeleting}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
