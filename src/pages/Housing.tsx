import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Building2,
  CalendarRange,
  Car,
  Droplets,
  Home,
  Landmark,
  Lightbulb,
  Pencil,
  Plus,
  Plug,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBanks } from "@/hooks/use-banks";
import { useCreateHousing, useDeleteHousing, useHousing, useUpdateHousing } from "@/hooks/use-housing";
import { useCategories } from "@/hooks/use-transactions";
import {
  TRANSACTIONS_YEAR_SELECTION,
  getCurrentMonthSelection,
  resolveMonthYearRange,
  resolvePresetRange,
  type TransactionsDateFilterPreset,
} from "@/lib/transactions-date-filter";
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

type HousingOccurrence = {
  id: string;
  housingId: string;
  description: string;
  expenseType: HousingExpenseType;
  amount: number;
  occurredOn: string;
  bankName: string;
  bankId: string;
  typeLabel: string;
  typeColor: string;
};

type TrendPoint = {
  label: string;
  amount: number;
  formattedAmount: string;
};

const expenseTypeOptions: Array<{ value: HousingExpenseType; label: string; icon: typeof Home; color: string }> = [
  { value: "rent", label: "Aluguel", icon: Home, color: "bg-primary" },
  { value: "home_financing", label: "Financiamento da casa", icon: Landmark, color: "bg-sky-500" },
  { value: "electricity", label: "Luz", icon: Plug, color: "bg-amber-500" },
  { value: "water", label: "Agua", icon: Droplets, color: "bg-cyan-500" },
  { value: "condo", label: "Condominio", icon: Building2, color: "bg-emerald-500" },
  { value: "vehicle_financing", label: "Financiamento de automovel", icon: Car, color: "bg-rose-500" },
  { value: "other", label: "Outro gasto recorrente", icon: Lightbulb, color: "bg-violet-500" },
];

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function buildEmptyForm(selectedMonthIndex = getCurrentMonthSelection().monthIndex, selectedYear = getCurrentMonthSelection().year): HousingFormState {
  const monthIndex = selectedMonthIndex === TRANSACTIONS_YEAR_SELECTION ? new Date().getMonth() : selectedMonthIndex;

  return {
    description: "",
    type: "rent",
    amount: "",
    startDate: new Date(Date.UTC(selectedYear, monthIndex, 1, 12, 0, 0, 0)).toISOString().slice(0, 10),
    installmentCount: "",
    bankConnectionId: "none",
    notes: "",
  };
}

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatCurrencyForInput(value: number) {
  return String(value).replace(".", ",");
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function getExpenseTypeLabel(type: HousingExpenseType) {
  return expenseTypeOptions.find((option) => option.value === type)?.label ?? "Outro gasto recorrente";
}

function getExpenseTypeColor(type: HousingExpenseType) {
  return expenseTypeOptions.find((option) => option.value === type)?.color ?? "bg-secondary";
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

function parseDateOnly(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function addMonthsToDate(value: string, monthOffset: number, dueDay: number) {
  const date = parseDateOnly(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + monthOffset;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const safeDay = Math.min(Math.max(Number(dueDay), 1), lastDay);

  return new Date(Date.UTC(year, month, safeDay, 12, 0, 0, 0)).toISOString().slice(0, 10);
}

function getMonthKey(value: string) {
  return value.slice(0, 7);
}

function formatShortMonth(value: string) {
  const [year, month] = value.split("-");

  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
  }).format(new Date(Number(year), Number(month) - 1, 1, 12, 0, 0, 0));
}

function formatShortDay(value: string) {
  const [year, month, day] = value.split("-");

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0));
}

function createTrendSeries(occurrences: HousingOccurrence[], useMonthlyBuckets: boolean): TrendPoint[] {
  const grouped = new Map<string, number>();

  occurrences.forEach((occurrence) => {
    const key = useMonthlyBuckets ? getMonthKey(occurrence.occurredOn) : occurrence.occurredOn;
    grouped.set(key, (grouped.get(key) ?? 0) + occurrence.amount);
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, amount]) => ({
      label: useMonthlyBuckets ? formatShortMonth(key) : formatShortDay(key),
      amount,
      formattedAmount: formatCurrency(amount),
    }));
}

function createExpenseTypeBreakdown(occurrences: HousingOccurrence[]): CategoryPieChartItem[] {
  const grouped = new Map<string, { id: string; label: string; color: string; total: number }>();

  occurrences.forEach((occurrence) => {
    const current = grouped.get(occurrence.expenseType);

    grouped.set(occurrence.expenseType, {
      id: occurrence.expenseType,
      label: occurrence.typeLabel,
      color: occurrence.typeColor,
      total: (current?.total ?? 0) + occurrence.amount,
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

function buildHousingOccurrences(expenses: HousingItem[], endDate: string) {
  return expenses.flatMap((expense) => {
    if (expense.status !== "active") {
      return [];
    }

    if (expense.installmentCount && expense.installmentCount > 1) {
      return Array.from({ length: expense.installmentCount }, (_, index) => {
        const occurredOn = addMonthsToDate(expense.startDate, index, expense.dueDay);

        return {
          id: `${expense.id}-${index + 1}`,
          housingId: String(expense.id),
          description: expense.description,
          expenseType: expense.expenseType,
          amount: Math.abs(expense.amount),
          occurredOn,
          bankName: expense.bank.name,
          bankId: String(expense.bank.id),
          typeLabel: getExpenseTypeLabel(expense.expenseType),
          typeColor: getExpenseTypeColor(expense.expenseType),
        } satisfies HousingOccurrence;
      }).filter((occurrence) => occurrence.occurredOn <= endDate);
    }

    const occurrences: HousingOccurrence[] = [];
    let offset = 0;

    while (offset < 240) {
      const occurredOn = addMonthsToDate(expense.startDate, offset, expense.dueDay);

      if (occurredOn > endDate) {
        break;
      }

      occurrences.push({
        id: `${expense.id}-${offset + 1}`,
        housingId: String(expense.id),
        description: expense.description,
        expenseType: expense.expenseType,
        amount: Math.abs(expense.amount),
        occurredOn,
        bankName: expense.bank.name,
        bankId: String(expense.bank.id),
        typeLabel: getExpenseTypeLabel(expense.expenseType),
        typeColor: getExpenseTypeColor(expense.expenseType),
      });

      offset += 1;
    }

    return occurrences;
  });
}

function HousingSkeleton() {
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

export default function HousingPage() {
  const { data: banks = [], isLoading: banksLoading } = useBanks();
  const { data: categories = [] } = useCategories();
  const { data: expenses = [], isLoading: housingLoading, isError: housingError } = useHousing();
  const createHousing = useCreateHousing();
  const updateHousing = useUpdateHousing();
  const deleteHousing = useDeleteHousing();

  const currentSelection = getCurrentMonthSelection();
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(currentSelection.monthIndex);
  const [selectedYear, setSelectedYear] = useState(currentSelection.year);
  const [datePreset, setDatePreset] = useState<TransactionsDateFilterPreset>(
    currentSelection.monthIndex === TRANSACTIONS_YEAR_SELECTION ? "year" : "month",
  );
  const [dateRange, setDateRange] = useState(() => resolveMonthYearRange(currentSelection.monthIndex, currentSelection.year));
  const [search, setSearch] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [form, setForm] = useState<HousingFormState>(() => buildEmptyForm(currentSelection.monthIndex, currentSelection.year));

  const transactionAccounts = useMemo(() => banks.filter((bank) => bank.accountType !== "credit_card"), [banks]);
  const allOccurrences = useMemo(() => buildHousingOccurrences(expenses, dateRange.endDate), [dateRange.endDate, expenses]);
  const seriesById = useMemo(
    () => new Map(expenses.map((expense) => [String(expense.id), expense])),
    [expenses],
  );
  const filteredOccurrences = useMemo(
    () =>
      allOccurrences.filter((occurrence) => {
        const expense = seriesById.get(occurrence.housingId);

        if (!expense) {
          return false;
        }

        const matchesSearch =
          !search.trim() ||
          expense.description.toLowerCase().includes(search.trim().toLowerCase()) ||
          occurrence.bankName.toLowerCase().includes(search.trim().toLowerCase()) ||
          occurrence.typeLabel.toLowerCase().includes(search.trim().toLowerCase());
        const matchesAccount = selectedAccountId === "all" || occurrence.bankId === selectedAccountId;
        const matchesType = selectedType === "all" || occurrence.expenseType === selectedType;
        const matchesDate = occurrence.occurredOn >= dateRange.startDate && occurrence.occurredOn <= dateRange.endDate;

        return matchesSearch && matchesAccount && matchesType && matchesDate;
      }),
    [allOccurrences, dateRange.endDate, dateRange.startDate, search, selectedAccountId, selectedType, seriesById],
  );

  const occurrencesByHousingId = useMemo(() => {
    const grouped = new Map<string, HousingOccurrence[]>();

    filteredOccurrences.forEach((occurrence) => {
      const current = grouped.get(occurrence.housingId) ?? [];
      current.push(occurrence);
      grouped.set(occurrence.housingId, current);
    });

    return grouped;
  }, [filteredOccurrences]);

  const filteredSeries = useMemo(
    () =>
      expenses.filter((expense) => {
        const matchesSearch =
          !search.trim() ||
          expense.description.toLowerCase().includes(search.trim().toLowerCase()) ||
          expense.bank.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          getExpenseTypeLabel(expense.expenseType).toLowerCase().includes(search.trim().toLowerCase());
        const matchesAccount = selectedAccountId === "all" || String(expense.bank.id) === selectedAccountId;
        const matchesType = selectedType === "all" || expense.expenseType === selectedType;
        const hasRowsInPeriod = (occurrencesByHousingId.get(String(expense.id)) ?? []).length > 0;

        return matchesSearch && matchesAccount && matchesType && hasRowsInPeriod;
      }),
    [expenses, occurrencesByHousingId, search, selectedAccountId, selectedType],
  );

  const trendSeries = useMemo(
    () => createTrendSeries(filteredOccurrences, selectedMonthIndex === TRANSACTIONS_YEAR_SELECTION),
    [filteredOccurrences, selectedMonthIndex],
  );
  const expenseTypeBreakdown = useMemo(() => createExpenseTypeBreakdown(filteredOccurrences), [filteredOccurrences]);
  const periodTotal = useMemo(
    () => filteredOccurrences.reduce((sum, occurrence) => sum + occurrence.amount, 0),
    [filteredOccurrences],
  );
  const averageOccurrence = filteredOccurrences.length ? periodTotal / filteredOccurrences.length : 0;
  const activeSeriesCount = filteredSeries.length;
  const nextOccurrence = useMemo(
    () =>
      filteredOccurrences
        .filter((occurrence) => occurrence.occurredOn >= new Date().toISOString().slice(0, 10))
        .sort((left, right) => left.occurredOn.localeCompare(right.occurredOn))[0] ?? null,
    [filteredOccurrences],
  );
  const deleteTarget = expenses.find((expense) => String(expense.id) === deleteTargetId) ?? null;
  const editingExpense = expenses.find((expense) => String(expense.id) === editingExpenseId) ?? null;
  const isSaving = createHousing.isPending || updateHousing.isPending;
  const isDeleting = deleteHousing.isPending;
  const isFinancing = isFinancingType(form.type);
  const trendConfig = useMemo<ChartConfig>(
    () => ({
      amount: {
        label: "Habitacao",
        color: "hsl(var(--destructive))",
      },
    }),
    [],
  );

  const resetForm = () => {
    setForm(buildEmptyForm(selectedMonthIndex, selectedYear));
    setEditingExpenseId(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handlePresetChange = (preset: Exclude<TransactionsDateFilterPreset, "custom">) => {
    setDatePreset(preset);
    setDateRange(resolvePresetRange(preset));
  };

  const handleMonthChange = (monthIndex: number) => {
    setSelectedMonthIndex(monthIndex);
    setDatePreset(monthIndex === TRANSACTIONS_YEAR_SELECTION ? "year" : "month");
    setDateRange(resolveMonthYearRange(monthIndex, selectedYear));
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setDatePreset(selectedMonthIndex === TRANSACTIONS_YEAR_SELECTION ? "year" : "month");
    setDateRange(resolveMonthYearRange(selectedMonthIndex, year));
  };

  const handleCustomRangeApply = (range: { startDate: string; endDate: string }) => {
    setDatePreset("custom");
    setDateRange(range);
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
    setDialogOpen(true);
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
        toast.success("Despesa de habitacao atualizada.");
      } else {
        await createHousing.mutateAsync(payload);
        toast.success("Despesa recorrente adicionada nas transacoes.");
      }

      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(editingExpense ? "Nao foi possivel atualizar a despesa." : "Nao foi possivel criar a despesa.", {
        description: error instanceof Error && error.message ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteHousing.mutateAsync(deleteTarget.id);
      setDeleteTargetId(null);

      if (editingExpenseId === String(deleteTarget.id)) {
        setDialogOpen(false);
        resetForm();
      }

      toast.success("Despesa de habitacao excluida.");
    } catch (error) {
      toast.error("Nao foi possivel excluir a despesa.", {
        description: error instanceof Error && error.message ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  if (housingLoading || banksLoading) {
    return (
      <AppShell title="Habitacao" description="Gerencie despesas recorrentes de moradia, utilidades e financiamentos">
        <HousingSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell title="Habitacao" description="Gerencie despesas recorrentes de moradia, utilidades e financiamentos">
      <AlertDialog open={Boolean(deleteTargetId)} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent className="border-warning/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa recorrente?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `A serie de "${deleteTarget.description}" sera removida, incluindo os lancamentos vinculados.`
                : "Essa serie sera removida."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteExpense();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-[520px] border-border/70 bg-card p-6">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Editar despesa recorrente" : "Nova despesa recorrente"}</DialogTitle>
            <DialogDescription>Cadastre aluguel, financiamento, luz, agua, condominio e outras despesas fixas.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
          </div>

          <DialogFooter className="justify-between sm:justify-between">
            <div>
              {editingExpense ? (
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTargetId(editingExpenseId)}
                  disabled={isDeleting}
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
              <Button onClick={() => void handleSaveExpense()} disabled={isSaving}>
                {isSaving ? "Salvando..." : editingExpense ? "Salvar alteracoes" : "Adicionar despesa"}
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
                {transactionAccounts.map((bank) => (
                  <SelectItem key={bank.id} value={String(bank.id)}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:flex-1">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {expenseTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
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
                placeholder="Buscar descricao, tipo ou conta..."
                className="h-11 rounded-xl border-border/60 bg-secondary/35 pl-11"
              />
            </div>

            <Button className="w-full rounded-xl xl:w-auto" onClick={openCreate}>
              <Plus size={14} />
              Nova despesa recorrente
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
              <span className="text-sm text-muted-foreground">Compromisso do periodo</span>
              <MetricInfoTooltip content="Soma de todas as cobrancas de habitacao geradas dentro do periodo e dos filtros aplicados." />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Wallet size={18} />
            </div>
          </div>
          <p className="text-[2rem] font-semibold text-foreground">{formatCurrency(periodTotal)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{filteredOccurrences.length} ocorrencias no recorte</p>
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Series ativas</span>
              <MetricInfoTooltip content="Quantidade de despesas de habitacao com pelo menos uma ocorrencia dentro do recorte filtrado." />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Building2 size={18} />
            </div>
          </div>
          <p className="text-[2rem] font-semibold text-foreground">{activeSeriesCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">Despesas de habitacao com ocorrencia no periodo</p>
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Media por vencimento</span>
              <MetricInfoTooltip content="Media calculada dividindo o compromisso total do periodo pela quantidade de ocorrencias de habitacao geradas no recorte." />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground">
              <CalendarRange size={18} />
            </div>
          </div>
          <p className="text-[2rem] font-semibold text-foreground">{formatCurrency(averageOccurrence)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Valor medio por cobranca gerada no recorte</p>
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Proximo vencimento</span>
              <MetricInfoTooltip content="Indica se existe uma proxima cobranca futura dentro do recorte atual e destaca a primeira ocorrencia encontrada." />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-foreground">
              <Home size={18} />
            </div>
          </div>
          <p className="text-[2rem] font-semibold text-foreground">{nextOccurrence ? "1" : "0"}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {nextOccurrence
              ? `${nextOccurrence.description} em ${nextOccurrence.occurredOn.split("-").reverse().join("/")}`
              : "Sem vencimentos futuros dentro dos filtros"}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="glass-card rounded-[28px] border border-border/40 p-5">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-foreground">Evolucao das despesas</h2>
            <p className="text-sm text-muted-foreground">
              Leitura visual por {selectedMonthIndex === TRANSACTIONS_YEAR_SELECTION ? "mes" : "dia"} das cobrancas filtradas.
            </p>
          </div>

          {!trendSeries.length ? (
            <div className="rounded-2xl border border-border/30 bg-secondary/20 p-6 text-sm text-muted-foreground">
              {housingError ? "Nao foi possivel carregar as despesas de habitacao." : "Nenhuma despesa encontrada para os filtros atuais."}
            </div>
          ) : (
            <div className="h-[320px]">
              <ChartContainer config={trendConfig} className="h-full w-full">
                <BarChart data={trendSeries} margin={{ top: 8, right: 12, left: 12, bottom: 4 }}>
                  <CartesianGrid vertical={false} strokeDasharray="4 8" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickFormatter={(value) => formatCurrency(Number(value)).replace("R$", "").trim()} tickLine={false} axisLine={false} width={72} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={[14, 14, 4, 4]} />
                </BarChart>
              </ChartContainer>
            </div>
          )}
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-5">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-foreground">Distribuicao por tipo</h2>
            <p className="text-sm text-muted-foreground">Entenda quais despesas pesam mais na sua estrutura de habitacao.</p>
          </div>
          <CategoryPieChart
            items={expenseTypeBreakdown}
            emptyMessage="Sem tipos para exibir nos filtros atuais."
            isError={housingError}
            emptyErrorMessage="Nao foi possivel carregar a distribuicao por tipo."
          />
        </div>
      </section>

      <section className="glass-card rounded-[28px] border border-border/40 p-5">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Tabela de despesas recorrentes</h2>
            <p className="text-sm text-muted-foreground">Gerencie as series de habitacao, revise vencimentos e atualize as recorrencias.</p>
          </div>
          <div className="text-sm text-muted-foreground">{filteredSeries.length} linhas</div>
        </div>

        {!filteredSeries.length ? (
          <div className="rounded-2xl border border-border/30 bg-secondary/20 p-6 text-sm text-muted-foreground">
            {housingError ? "Nao foi possivel carregar a tabela de habitacao." : "Nenhuma despesa encontrada para os filtros atuais."}
          </div>
        ) : (
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Despesa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Ocorrencias</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-[132px] text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSeries.map((expense) => {
                const rows = occurrencesByHousingId.get(String(expense.id)) ?? [];
                const option = expenseTypeOptions.find((item) => item.value === expense.expenseType);
                const totalInPeriod = rows.reduce((sum, row) => sum + row.amount, 0);

                return (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">{expense.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {expense.installmentCount
                            ? `${expense.installmentCount} parcelas planejadas`
                            : "Recorrencia mensal continua"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium text-foreground">
                        {option?.label ?? getExpenseTypeLabel(expense.expenseType)}
                      </span>
                    </TableCell>
                    <TableCell>{expense.bank.name}</TableCell>
                    <TableCell>{expense.startDate.split("-").reverse().join("/")}</TableCell>
                    <TableCell>Dia {expense.dueDay}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">{rows.length} no periodo</div>
                        <div className="text-xs text-muted-foreground">
                          {expense.installmentCount ? `${rows.length}/${expense.installmentCount} visiveis no recorte` : "Cobrança mensal recorrente"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-1">
                        <div className="font-semibold text-foreground">{formatCurrency(expense.amount)}</div>
                        <div className="text-xs text-muted-foreground">{formatCurrency(totalInPeriod)} no periodo</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Editar ${expense.description}`}
                          onClick={() => startEditExpense(expense)}
                          disabled={isSaving || isDeleting}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Excluir ${expense.description}`}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTargetId(String(expense.id))}
                          disabled={isSaving || isDeleting}
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
      </section>
    </AppShell>
  );
}
