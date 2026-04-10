import { Building2, Car, Droplets, Home, Landmark, Lightbulb, Pencil, Plug, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useBanks } from "@/hooks/use-banks";
import { useCategories, useCreateTransaction, useDeleteTransaction, useUpdateTransaction } from "@/hooks/use-transactions";
import type { BankItem, CategoryItem, CreateTransactionInput, UpdateTransactionInput } from "@/types/api";

type HousingExpenseType = "rent" | "home_financing" | "electricity" | "water" | "condo" | "vehicle_financing" | "other";

type HousingExpense = {
  id: number;
  description: string;
  type: HousingExpenseType;
  amount: number;
  dueDay: number;
  bankConnectionId: string;
  transactionId: string;
  notes: string;
};

type HousingFormState = {
  description: string;
  type: HousingExpenseType;
  amount: string;
  dueDay: string;
  bankConnectionId: string;
  notes: string;
};

const expenseTypeOptions: Array<{ value: HousingExpenseType; label: string; icon: typeof Home }> = [
  { value: "rent", label: "Aluguel", icon: Home },
  { value: "home_financing", label: "Financiamento da casa", icon: Landmark },
  { value: "electricity", label: "Luz", icon: Plug },
  { value: "water", label: "Água", icon: Droplets },
  { value: "condo", label: "Condomínio", icon: Building2 },
  { value: "vehicle_financing", label: "Financiamento de automóvel", icon: Car },
  { value: "other", label: "Outro gasto recorrente", icon: Lightbulb },
];

const emptyForm: HousingFormState = {
  description: "",
  type: "rent",
  amount: "",
  dueDay: "",
  bankConnectionId: "none",
  notes: "",
};

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

function getLinkedBankName(banks: BankItem[], bankConnectionId: string) {
  if (!bankConnectionId) {
    return "Sem banco vinculado";
  }

  return banks.find((bank) => String(bank.id) === bankConnectionId)?.name ?? "Banco nao encontrado";
}

function getCurrentMonthOccurrenceDate(dueDay: number) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(Math.max(dueDay, 1), lastDay);

  return new Date(year, month, safeDay).toISOString().slice(0, 10);
}

function resolveHousingCategoryId(categories: CategoryItem[], type: HousingExpenseType) {
  const preferredSlug = type === "electricity" ? "energia" : "moradia";
  const preferred = categories.find((category) => category.transactionType === "expense" && category.slug === preferredSlug);

  if (preferred) {
    return preferred.id;
  }

  return categories.find((category) => category.transactionType === "expense" && category.groupSlug === "moradia")?.id;
}

export default function HousingPage() {
  const { data: banks = [], isLoading: banksLoading } = useBanks();
  const { data: categories = [] } = useCategories();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const [expenses, setExpenses] = useState<HousingExpense[]>([]);
  const [form, setForm] = useState<HousingFormState>(emptyForm);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);

  const transactionAccounts = useMemo(() => banks.filter((bank) => bank.accountType !== "credit_card"), [banks]);
  const monthlyTotal = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount, 0), [expenses]);
  const linkedExpensesCount = useMemo(() => expenses.filter((expense) => expense.bankConnectionId).length, [expenses]);

  const editingExpense = expenses.find((expense) => expense.id === editingExpenseId) ?? null;
  const isSaving = createTransaction.isPending || updateTransaction.isPending;
  const isDeleting = deleteTransaction.isPending;

  const resetForm = () => {
    setForm(emptyForm);
    setEditingExpenseId(null);
  };

  const startEditExpense = (expense: HousingExpense) => {
    setEditingExpenseId(expense.id);
    setForm({
      description: expense.description,
      type: expense.type,
      amount: formatCurrencyForInput(expense.amount),
      dueDay: String(expense.dueDay),
      bankConnectionId: expense.bankConnectionId || "none",
      notes: expense.notes,
    });
  };

  const handleSaveExpense = async () => {
    const amount = parseCurrencyInput(form.amount);
    const dueDay = Number(form.dueDay);

    if (
      !form.description.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isInteger(dueDay) ||
      dueDay < 1 ||
      dueDay > 31 ||
      form.bankConnectionId === "none"
    ) {
      toast.error("Informe descricao, valor e vencimento validos.");
      return;
    }

    const categoryId = resolveHousingCategoryId(categories, form.type);
    const transactionPayload = {
      description: form.description.trim(),
      amount: -Math.abs(amount),
      occurredOn: getCurrentMonthOccurrenceDate(dueDay),
      bankConnectionId: form.bankConnectionId,
      ...(categoryId ? { categoryId } : {}),
    };

    try {
      if (editingExpense) {
        if (editingExpense.transactionId) {
          await updateTransaction.mutateAsync({
            id: editingExpense.transactionId,
            ...transactionPayload,
          } satisfies UpdateTransactionInput);
        }

        setExpenses((current) =>
          current.map((expense) =>
            expense.id === editingExpense.id
              ? {
                  ...expense,
                  description: form.description.trim(),
                  type: form.type,
                  amount,
                  dueDay,
                  bankConnectionId: form.bankConnectionId,
                  notes: form.notes.trim(),
                }
              : expense,
          ),
        );
        resetForm();
        toast.success("Despesa de habitacao atualizada.");
        return;
      }

      const transaction = await createTransaction.mutateAsync(transactionPayload satisfies CreateTransactionInput);

      setExpenses((current) => [
        {
          id: Date.now(),
          description: form.description.trim(),
          type: form.type,
          amount,
          dueDay,
          bankConnectionId: form.bankConnectionId,
          transactionId: String(transaction.id),
          notes: form.notes.trim(),
        },
        ...current,
      ]);
      resetForm();
      toast.success("Despesa recorrente adicionada nas transacoes.");
    } catch (error) {
      toast.error(editingExpense ? "Nao foi possivel atualizar a transacao." : "Nao foi possivel criar a transacao.", {
        description: error instanceof Error && error.message ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleDeleteExpense = async (expense: HousingExpense) => {
    try {
      if (expense.transactionId) {
        await deleteTransaction.mutateAsync(expense.transactionId);
      }

      setExpenses((current) => current.filter((item) => item.id !== expense.id));

      if (editingExpenseId === expense.id) {
        resetForm();
      }

      toast.success("Despesa de habitacao excluida.");
    } catch (error) {
      toast.error("Nao foi possivel excluir a transacao.", {
        description: error instanceof Error && error.message ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  return (
    <AppShell title="Habitação" description="Organize moradia, contas essenciais e financiamentos vinculados a bancos">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Compromisso mensal</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{currencyFormatter.format(monthlyTotal)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Despesas recorrentes</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{expenses.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Vinculadas a bancos</p>
          <p className="mt-1 text-2xl font-bold text-primary">{linkedExpensesCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="glass-card rounded-2xl border border-border/40 p-5">
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
              onValueChange={(value: HousingExpenseType) => setForm((current) => ({ ...current, type: value }))}
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

            <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
              <Input
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="Valor mensal"
                inputMode="decimal"
                className="h-11 rounded-xl border-border/60 bg-secondary/35"
              />
              <Input
                value={form.dueDay}
                onChange={(event) => setForm((current) => ({ ...current, dueDay: event.target.value }))}
                placeholder="Dia"
                inputMode="numeric"
                className="h-11 rounded-xl border-border/60 bg-secondary/35"
              />
            </div>

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

            <div className="flex gap-2">
              {editingExpense ? (
                <Button variant="outline" className="shrink-0" onClick={resetForm} disabled={isSaving}>
                  <X size={16} />
                  Cancelar
                </Button>
              ) : null}
              <Button className="flex-1" onClick={() => void handleSaveExpense()} disabled={isSaving}>
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

        <div className="glass-card rounded-2xl border border-border/40 p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">Despesas de habitação</h2>
            <p className="text-sm text-muted-foreground">
              Financiamentos de carro, moto, casa ou apartamento podem ser vinculados ao banco onde foram contratados.
            </p>
          </div>

          {!expenses.length ? (
            <div className="rounded-2xl border border-dashed border-border/40 bg-secondary/20 p-5 text-sm text-muted-foreground">
              Nenhuma despesa de habitacao cadastrada ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => {
              const option = expenseTypeOptions.find((item) => item.value === expense.type);
              const Icon = option?.icon ?? Lightbulb;

              return (
                <div key={expense.id} className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-foreground">{expense.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {getExpenseTypeLabel(expense.type)} · vence dia {expense.dueDay}
                        </p>
                        <p className="text-sm text-muted-foreground">{getLinkedBankName(transactionAccounts, expense.bankConnectionId)}</p>
                        {expense.transactionId ? (
                          <p className="text-xs text-primary">Lancada em Transacoes #{expense.transactionId}</p>
                        ) : null}
                        {expense.notes ? <p className="mt-1 text-sm text-muted-foreground">{expense.notes}</p> : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-2 md:flex-col md:items-end">
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
