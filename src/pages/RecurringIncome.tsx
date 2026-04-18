import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { CalendarRange, Pencil, Plus, Repeat, Search, Trash2, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import CategoryPieChart, { type CategoryPieChartItem } from "@/components/CategoryPieChart";
import MetricInfoTooltip from "@/components/MetricInfoTooltip";
import TransactionsDateFilter from "@/components/transactions/TransactionsDateFilter";
import TransactionsMonthYearFilter from "@/components/transactions/TransactionsMonthYearFilter";
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
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBanks } from "@/hooks/use-banks";
import { useCategories, useCreateTransaction, useDeleteTransaction, useTransactions, useUpdateTransaction } from "@/hooks/use-transactions";
import { resolveCategoryColorPresentation } from "@/lib/category-colors";
import {
  TRANSACTIONS_YEAR_SELECTION,
  getCurrentMonthSelection,
  resolveMonthYearRange,
  resolvePresetRange,
  type TransactionsDateFilterPreset,
} from "@/lib/transactions-date-filter";
import { cn } from "@/lib/utils";
import type { CreateTransactionInput, TransactionItem, UpdateTransactionInput } from "@/types/api";
import { toast } from "@/components/ui/sonner";

type RecurringIncomeFormState = {
  id?: string;
  sourceTransactionId?: string;
  description: string;
  amount: string;
  occurredOn: string;
  bankConnectionId: string;
  categoryId: string;
};

type TrendPoint = {
  label: string;
  amount: number;
  formattedAmount: string;
};

type RecurringIncomeTableRow = {
  id: string;
  sourceTransactionId: number | string;
  description: string;
  categoryLabel: string;
  categoryColor: string;
  accountName: string;
  occurredOnLabel: string;
  seriesLabel: string;
  amount: number;
  occurrenceCount: number;
  representativeTransaction: TransactionItem;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function createLocalDate(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatMonthKey(year: number, monthIndex: number) {
  return `${year}-${pad(monthIndex + 1)}-${pad(1)}`;
}

function resolveDefaultOccurredOn(monthIndex: number, year: number) {
  if (monthIndex === TRANSACTIONS_YEAR_SELECTION) {
    return formatMonthKey(year, new Date().getMonth());
  }

  return formatMonthKey(year, monthIndex);
}

function emptyRecurringIncomeForm(monthIndex: number, year: number): RecurringIncomeFormState {
  return {
    description: "",
    amount: "",
    occurredOn: resolveDefaultOccurredOn(monthIndex, year),
    bankConnectionId: "",
    categoryId: "",
  };
}

function mapTransactionToForm(transaction: TransactionItem): RecurringIncomeFormState {
  return {
    id: String(transaction.id),
    sourceTransactionId: String(transaction.sourceTransactionId ?? transaction.id),
    description: transaction.description,
    amount: String(Math.abs(transaction.amount)).replace(".", ","),
    occurredOn: transaction.occurredOn,
    bankConnectionId: String(transaction.account.id),
    categoryId: String(transaction.category.id),
  };
}

function createTrendSeries(transactions: TransactionItem[]): TrendPoint[] {
  const grouped = new Map<string, { amount: number; latestOccurredOn: string }>();

  transactions.forEach((transaction) => {
    const key = String(transaction.sourceTransactionId ?? transaction.id);
    const current = grouped.get(key);

    grouped.set(key, {
      amount: (current?.amount ?? 0) + transaction.amount,
      latestOccurredOn:
        !current || transaction.occurredOn > current.latestOccurredOn ? transaction.occurredOn : current.latestOccurredOn,
    });
  });

  return Array.from(grouped.entries())
    .map(([key, summary]) => {
      const referenceTransaction =
        transactions.find((transaction) => String(transaction.sourceTransactionId ?? transaction.id) === key) ?? transactions[0];

      return {
        label: referenceTransaction?.description ?? "Receita recorrente",
        amount: summary.amount,
        formattedAmount: formatCurrency(summary.amount),
        latestOccurredOn: summary.latestOccurredOn,
      };
    })
    .sort(
      (left, right) =>
        right.amount - left.amount ||
        right.latestOccurredOn.localeCompare(left.latestOccurredOn) ||
        left.label.localeCompare(right.label, "pt-BR"),
    )
    .map(({ label, amount, formattedAmount }) => ({
      label,
      amount,
      formattedAmount,
    }));
}

function createCategoryBreakdown(transactions: TransactionItem[]): CategoryPieChartItem[] {
  const grouped = new Map<string, { id: string; label: string; color: string; total: number }>();

  transactions.forEach((transaction) => {
    const key = transaction.category.groupSlug || transaction.category.slug || String(transaction.category.id);
    const current = grouped.get(key);

    grouped.set(key, {
      id: key,
      label: transaction.category.groupLabel || transaction.category.label,
      color: transaction.category.groupColor || transaction.category.color,
      total: (current?.total ?? 0) + transaction.amount,
    });
  });

  const overallTotal = Array.from(grouped.values()).reduce((sum, item) => sum + item.total, 0);

  return Array.from(grouped.values())
    .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label, "pt-BR"))
    .map((item) => ({
      ...item,
      formattedTotal: formatCurrency(item.total),
      percentage: overallTotal > 0 ? Math.round((item.total / overallTotal) * 100) : 0,
    }));
}

function RecurringIncomeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-[28px] border border-border/40 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_220px]">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass-card rounded-[28px] border border-border/40 p-5">
            <Skeleton className="mb-4 h-4 w-28" />
            <Skeleton className="mb-2 h-9 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="glass-card rounded-[28px] border border-border/40 p-5">
          <Skeleton className="mb-5 h-5 w-40" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        </div>
        <div className="glass-card rounded-[28px] border border-border/40 p-5">
          <Skeleton className="mb-5 h-5 w-40" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default function RecurringIncomePage() {
  const { data: transactions = [], isLoading, isError } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: banks = [], isLoading: isBanksLoading } = useBanks();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const removeTransaction = useDeleteTransaction();

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => getCurrentMonthSelection().monthIndex);
  const [selectedYear, setSelectedYear] = useState(() => getCurrentMonthSelection().year);
  const [datePreset, setDatePreset] = useState<TransactionsDateFilterPreset>(
    getCurrentMonthSelection().monthIndex === TRANSACTIONS_YEAR_SELECTION ? "year" : "month",
  );
  const [dateRange, setDateRange] = useState(() =>
    resolveMonthYearRange(getCurrentMonthSelection().monthIndex, getCurrentMonthSelection().year),
  );
  const [search, setSearch] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [form, setForm] = useState<RecurringIncomeFormState>(() =>
    emptyRecurringIncomeForm(getCurrentMonthSelection().monthIndex, getCurrentMonthSelection().year),
  );

  const accountOptions = useMemo(
    () =>
      banks.filter((bank) => bank.accountType === "bank_account" || bank.accountType === "cash"),
    [banks],
  );
  const incomeCategories = useMemo(() => categories.filter((category) => category.transactionType === "income"), [categories]);
  const recurringIncomes = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.amount > 0 &&
          transaction.isRecurring &&
          transaction.housingId === null &&
          (transaction.account.accountType === "bank_account" ||
            transaction.account.accountType === "cash"),
      ),
    [transactions],
  );
  const filteredTransactions = useMemo(
    () =>
      recurringIncomes.filter((transaction) => {
        const matchesSearch =
          !search.trim() ||
          transaction.description.toLowerCase().includes(search.trim().toLowerCase()) ||
          transaction.category.label.toLowerCase().includes(search.trim().toLowerCase()) ||
          transaction.account.name.toLowerCase().includes(search.trim().toLowerCase());
        const matchesAccount = selectedAccountId === "all" || String(transaction.account.id) === selectedAccountId;
        const matchesCategory = selectedCategoryId === "all" || String(transaction.category.id) === selectedCategoryId;
        const matchesDate = transaction.occurredOn >= dateRange.startDate && transaction.occurredOn <= dateRange.endDate;

        return matchesSearch && matchesAccount && matchesCategory && matchesDate;
      }),
    [dateRange.endDate, dateRange.startDate, recurringIncomes, search, selectedAccountId, selectedCategoryId],
  );
  const categoryBreakdown = useMemo(() => createCategoryBreakdown(filteredTransactions), [filteredTransactions]);
  const trendSeries = useMemo(() => createTrendSeries(filteredTransactions), [filteredTransactions]);
  const isYearlyTable = selectedMonthIndex === TRANSACTIONS_YEAR_SELECTION;
  const seriesCount = useMemo(
    () => new Set(filteredTransactions.map((transaction) => String(transaction.sourceTransactionId ?? transaction.id))).size,
    [filteredTransactions],
  );
  const totalIncome = useMemo(
    () => filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    [filteredTransactions],
  );
  const averageIncome = filteredTransactions.length ? totalIncome / filteredTransactions.length : 0;
  const topIncome = filteredTransactions[0] ?? null;
  const nextOccurrences = useMemo(
    () =>
      [...filteredTransactions]
        .sort((left, right) => left.occurredOn.localeCompare(right.occurredOn))
        .slice(0, 3),
    [filteredTransactions],
  );
  const tableRows = useMemo<RecurringIncomeTableRow[]>(() => {
    if (!isYearlyTable) {
      return filteredTransactions.map((transaction) => ({
        id: String(transaction.id),
        sourceTransactionId: transaction.sourceTransactionId ?? transaction.id,
        description: transaction.description,
        categoryLabel: transaction.category.label,
        categoryColor: transaction.category.groupColor || transaction.category.color,
        accountName: transaction.account.name,
        occurredOnLabel: transaction.occurredOn.split("-").reverse().join("/"),
        seriesLabel: transaction.isRecurringProjection ? "Projecao" : "Base da serie",
        amount: transaction.amount,
        occurrenceCount: 1,
        representativeTransaction: transaction,
      }));
    }

    const grouped = new Map<string, RecurringIncomeTableRow>();

    filteredTransactions.forEach((transaction) => {
      const key = String(transaction.sourceTransactionId ?? transaction.id);
      const current = grouped.get(key);

      if (!current) {
        grouped.set(key, {
          id: key,
          sourceTransactionId: transaction.sourceTransactionId ?? transaction.id,
          description: transaction.description,
          categoryLabel: transaction.category.label,
          categoryColor: transaction.category.groupColor || transaction.category.color,
          accountName: transaction.account.name,
          occurredOnLabel: `${dateRange.startDate.split("-").reverse().join("/")} - ${dateRange.endDate.split("-").reverse().join("/")}`,
          seriesLabel: "Serie consolidada",
          amount: transaction.amount,
          occurrenceCount: 1,
          representativeTransaction: transaction,
        });
        return;
      }

      const preferredRepresentative =
        !current.representativeTransaction.isRecurringProjection && transaction.isRecurringProjection
          ? current.representativeTransaction
          : current.representativeTransaction.isRecurringProjection && !transaction.isRecurringProjection
            ? transaction
            : transaction.occurredOn < current.representativeTransaction.occurredOn
              ? transaction
              : current.representativeTransaction;

      grouped.set(key, {
        ...current,
        amount: current.amount + transaction.amount,
        occurrenceCount: current.occurrenceCount + 1,
        representativeTransaction: preferredRepresentative,
      });
    });

    return Array.from(grouped.values()).sort(
      (left, right) =>
        right.amount - left.amount ||
        left.description.localeCompare(right.description, "pt-BR"),
    );
  }, [dateRange.endDate, dateRange.startDate, filteredTransactions, isYearlyTable]);
  const deleteTarget = filteredTransactions.find((transaction) => String(transaction.id) === deleteTargetId) ?? null;
  const isEditing = Boolean(form.id);

  const trendConfig = useMemo<ChartConfig>(
    () => ({
      amount: {
        label: "Receitas recorrentes",
        color: "hsl(var(--income))",
      },
    }),
    [],
  );

  const handleMonthChange = (monthIndex: number) => {
    setSelectedMonthIndex(monthIndex);
    setDatePreset(monthIndex === TRANSACTIONS_YEAR_SELECTION ? "year" : "month");
    setDateRange(resolveMonthYearRange(monthIndex, selectedYear));
    setForm((current) =>
      current.id
        ? current
        : {
            ...current,
            occurredOn: resolveDefaultOccurredOn(monthIndex, selectedYear),
          },
    );
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setDatePreset(selectedMonthIndex === TRANSACTIONS_YEAR_SELECTION ? "year" : "month");
    setDateRange(resolveMonthYearRange(selectedMonthIndex, year));
    setForm((current) =>
      current.id
        ? current
        : {
            ...current,
            occurredOn: resolveDefaultOccurredOn(selectedMonthIndex, year),
          },
    );
  };

  const openCreate = () => {
    setForm(emptyRecurringIncomeForm(selectedMonthIndex, selectedYear));
    setDialogOpen(true);
  };

  const handlePresetChange = (preset: Exclude<TransactionsDateFilterPreset, "custom">) => {
    setDatePreset(preset);
    setDateRange(resolvePresetRange(preset));
  };

  const handleCustomRangeApply = (range: { startDate: string; endDate: string }) => {
    setDatePreset("custom");
    setDateRange(range);
  };

  const openEdit = (transaction: TransactionItem) => {
    setForm(mapTransactionToForm(transaction));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const parsedAmount = Number(form.amount.replace(",", "."));

    if (!form.description.trim() || !Number.isFinite(parsedAmount) || !form.bankConnectionId || !form.categoryId || !form.occurredOn) {
      toast.error("Preencha descricao, valor, conta, categoria e data.");
      return;
    }

    const payload = {
      description: form.description.trim(),
      amount: Math.abs(parsedAmount),
      occurredOn: form.occurredOn,
      bankConnectionId: form.bankConnectionId,
      categoryId: form.categoryId,
      isRecurring: true,
    };

    try {
      if (form.id) {
        await updateTransaction.mutateAsync({
          id: form.sourceTransactionId ?? form.id,
          ...payload,
        } satisfies UpdateTransactionInput);
        toast.success("Receita recorrente atualizada.");
      } else {
        await createTransaction.mutateAsync(payload satisfies CreateTransactionInput);
        toast.success("Receita recorrente criada.");
      }

      setDialogOpen(false);
      setForm(emptyRecurringIncomeForm(selectedMonthIndex, selectedYear));
    } catch (error) {
      toast.error("Nao foi possivel salvar a receita recorrente.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await removeTransaction.mutateAsync({
        id: deleteTarget.sourceTransactionId ?? deleteTarget.id,
        occurredOn: deleteTarget.occurredOn,
      });
      setDeleteTargetId(null);
      setDialogOpen(false);
      toast.success("Receita recorrente removida.");
    } catch (error) {
      toast.error("Nao foi possivel remover a receita recorrente.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  if (isLoading || isBanksLoading) {
    return (
      <AppShell title="Receitas recorrentes" description="Controle recorrencias, previsao e distribuicao das receitas">
        <RecurringIncomeSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell title="Receitas recorrentes" description="Controle recorrencias, previsao e distribuicao das receitas">
      <AlertDialog open={Boolean(deleteTargetId)} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent className="border-warning/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir receita recorrente?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `A ocorrencia de "${deleteTarget.description}" em ${deleteTarget.occurredOn.split("-").reverse().join("/")} sera removida.`
                : "Essa ocorrencia sera removida."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeTransaction.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={removeTransaction.isPending}
            >
              {removeTransaction.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[520px] border-border/70 bg-card p-6">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar receita recorrente" : "Nova receita recorrente"}</DialogTitle>
            <DialogDescription>As alteracoes futuras respeitam o historico ja realizado.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Descricao"
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />
            <Input
              value={form.amount}
              onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              placeholder="Valor"
              inputMode="decimal"
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />
            <Select value={form.bankConnectionId} onValueChange={(value) => setForm((current) => ({ ...current, bankConnectionId: value }))}>
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                <SelectValue placeholder="Conta ou caixa" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map((bank) => (
                  <SelectItem key={bank.id} value={String(bank.id)}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.categoryId} onValueChange={(value) => setForm((current) => ({ ...current, categoryId: value }))}>
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {incomeCategories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DatePickerInput
              value={form.occurredOn}
              onChange={(value) => setForm((current) => ({ ...current, occurredOn: value }))}
              className="h-11"
              placeholder="Selecione a data de inicio"
            />
          </div>

          <DialogFooter className="justify-between sm:justify-between">
            <div>
              {isEditing ? (
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTargetId(form.id ?? null)}
                  disabled={removeTransaction.isPending}
                >
                  <Trash2 size={14} />
                  Excluir
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void handleSave()} disabled={createTransaction.isPending || updateTransaction.isPending}>
                {createTransaction.isPending || updateTransaction.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="glass-card rounded-[28px] border border-border/40 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <TransactionsMonthYearFilter
              selectedMonthIndex={selectedMonthIndex}
              selectedYear={selectedYear}
              onMonthChange={handleMonthChange}
              onYearChange={handleYearChange}
            />

            <TransactionsDateFilter
              preset={datePreset}
              range={dateRange}
              onSelectPreset={handlePresetChange}
              onApplyCustomRange={handleCustomRangeApply}
              showPresetButtons={false}
            />

            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:flex-1">
                <SelectValue placeholder="Todas as contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accountOptions.map((bank) => (
                  <SelectItem key={bank.id} value={String(bank.id)}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:flex-1">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {incomeCategories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar descricao, categoria ou conta..."
                className="h-11 rounded-xl border-border/60 bg-secondary/35 pl-11"
              />
            </div>
            <Button className="w-full rounded-xl bg-income text-background hover:bg-income/90 xl:w-auto" onClick={openCreate}>
              <Plus size={14} />
              Nova recorrencia
            </Button>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              {dateRange.startDate.split("-").reverse().join("/")} - {dateRange.endDate.split("-").reverse().join("/")}
            </div>
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Receitas no periodo</span>
              <MetricInfoTooltip content="Soma de todas as ocorrencias de receitas recorrentes que caem dentro do periodo e dos filtros aplicados." />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-income/10 text-income">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-[2rem] font-semibold text-income">{formatCurrency(totalIncome)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{filteredTransactions.length} ocorrencias filtradas</p>
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Series ativas</span>
              <MetricInfoTooltip content="Quantidade de series unicas de receita recorrente presentes no recorte filtrado." />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Repeat size={18} />
            </div>
          </div>
          <p className="text-[2rem] font-semibold text-foreground">{seriesCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">Fontes recorrentes unicas neste recorte</p>
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Media por ocorrencia</span>
              <MetricInfoTooltip content="Media calculada dividindo o total de receitas recorrentes do recorte pela quantidade de ocorrencias filtradas." />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground">
              <Wallet size={18} />
            </div>
          </div>
          <p className="text-[2rem] font-semibold text-foreground">{formatCurrency(averageIncome)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Quanto cada entrada recorrente gera em media</p>
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Proximas ocorrencias</span>
              <MetricInfoTooltip content="Quantidade das tres primeiras ocorrencias recorrentes encontradas no periodo filtrado, ordenadas por data." />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground">
              <CalendarRange size={18} />
            </div>
          </div>
          <p className="text-[2rem] font-semibold text-foreground">{nextOccurrences.length}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {nextOccurrences[0] ? `${nextOccurrences[0].description} em ${nextOccurrences[0].occurredOn.split("-").reverse().join("/")}` : "Sem novas ocorrencias no periodo"}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="glass-card rounded-[28px] border border-border/40 p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Evolucao das receitas recorrentes</h2>
              <p className="text-sm text-muted-foreground">Leitura visual por receita recorrente dentro dos filtros aplicados.</p>
            </div>
          </div>

          {!trendSeries.length ? (
            <div className="rounded-2xl border border-border/30 bg-secondary/20 p-6 text-sm text-muted-foreground">
              {isError ? "Nao foi possivel carregar as receitas recorrentes agora." : "Nenhuma receita recorrente encontrada para os filtros atuais."}
            </div>
          ) : (
            <div className="h-[320px]">
              <ChartContainer config={trendConfig} className="h-full w-full">
                <BarChart data={trendSeries} layout="vertical" margin={{ top: 8, right: 12, left: 12, bottom: 4 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="4 8" />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => formatCurrency(Number(value)).replace("R$", "").trim()}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={96} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 14, 14, 4]} />
                </BarChart>
              </ChartContainer>
            </div>
          )}
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-5">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-foreground">Distribuicao por categoria</h2>
            <p className="text-sm text-muted-foreground">Onde as receitas recorrentes estao concentradas.</p>
          </div>
          <CategoryPieChart
            items={categoryBreakdown}
            emptyMessage="Sem categorias para exibir nos filtros atuais."
            isError={isError}
            emptyErrorMessage="Nao foi possivel carregar a distribuicao por categoria."
          />
        </div>
      </section>

      <section className="glass-card rounded-[28px] border border-border/40 p-5">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Tabela de receitas recorrentes</h2>
            <p className="text-sm text-muted-foreground">
              {isYearlyTable
                ? "No filtro anual, a mesma receita e consolidada em uma unica linha."
                : "Edite, exclua ou revise cada ocorrencia da recorrencia no periodo selecionado."}
            </p>
          </div>
          <div className="text-sm text-muted-foreground">{tableRows.length} linhas</div>
        </div>

        {!tableRows.length ? (
          <div className="rounded-2xl border border-border/30 bg-secondary/20 p-6 text-sm text-muted-foreground">
            {isError ? "Nao foi possivel carregar a tabela agora." : "Nenhuma receita recorrente encontrada para os filtros atuais."}
          </div>
        ) : (
          <Table className="min-w-[940px]">
            <TableHeader>
              <TableRow>
                <TableHead>Receita</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>{isYearlyTable ? "Periodo" : "Ocorrencia"}</TableHead>
                <TableHead>Serie</TableHead>
                <TableHead className="text-center">{isYearlyTable ? "Ocorrencias" : "Tipo"}</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[132px] text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((row) => {
                const categoryColor = resolveCategoryColorPresentation(row.categoryColor);

                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{row.description}</span>
                          <span className="rounded-full bg-income/10 px-2 py-0.5 text-[11px] font-medium text-income">Recorrente</span>
                          {!isYearlyTable && row.representativeTransaction.isRecurringProjection ? (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Ocorrencia futura</span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Serie #{row.sourceTransactionId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium" style={{ color: categoryColor.text }}>
                        {row.categoryLabel}
                      </span>
                    </TableCell>
                    <TableCell>{row.accountName}</TableCell>
                    <TableCell>{row.occurredOnLabel}</TableCell>
                    <TableCell>{row.seriesLabel}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {isYearlyTable ? `${row.occurrenceCount}x` : row.representativeTransaction.isRecurringProjection ? "Projecao" : "Base"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-income">{formatCurrency(row.amount)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(row.representativeTransaction)}>
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTargetId(String(row.representativeTransaction.id))}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {topIncome ? (
          <div className="mt-5 rounded-2xl border border-border/40 bg-secondary/20 p-4 text-sm text-muted-foreground">
            Maior receita do recorte: <span className="font-medium text-foreground">{topIncome.description}</span> em{" "}
            <span className="font-medium text-foreground">{formatCurrency(topIncome.amount)}</span>.
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
