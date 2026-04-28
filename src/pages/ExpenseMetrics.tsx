import { ArrowDownRight, ArrowUpRight, CalendarRange, Landmark, Scale, TrendingDown, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import AppShell from "@/components/AppShell";
import CategoryPieChart, { type CategoryPieChartItem } from "@/components/CategoryPieChart";
import MetricInfoTooltip from "@/components/MetricInfoTooltip";
import TransactionsDateFilter from "@/components/transactions/TransactionsDateFilter";
import TransactionsMonthYearFilter from "@/components/transactions/TransactionsMonthYearFilter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBanks } from "@/hooks/use-banks";
import { useTransactions } from "@/hooks/use-transactions";
import { useUrlPeriodFilter } from "@/hooks/use-url-period-filter";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { resolveCategoryColorPresentation } from "@/lib/category-colors";
import {
  formatDateRangeLabel,
  getCurrentMonthSelection,
  resolvePresetRange,
  type TransactionsDateFilterPreset,
} from "@/lib/transactions-date-filter";
import { cn } from "@/lib/utils";
import type { BankItem, TransactionItem } from "@/types/api";

type MetricTypeFilter = "all" | "income" | "expense";

type TrendPoint = {
  label: string;
  amount: number;
  formattedAmount: string;
  incomeAmount: number;
  expenseAmount: number;
  formattedIncomeAmount: string;
  formattedExpenseAmount: string;
};

const typeFilters: Array<{ label: string; value: MetricTypeFilter }> = [
  { label: "Todas", value: "all" },
  { label: "Receitas", value: "income" },
  { label: "Despesas", value: "expense" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
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

function getMonthKey(value: string) {
  return value.slice(0, 7);
}

function calculateMedian(values: number[]) {
  if (!values.length) {
    return 0;
  }

  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);

  if (ordered.length % 2 === 0) {
    return (ordered[middle - 1] + ordered[middle]) / 2;
  }

  return ordered[middle];
}

function createTrendSeries(transactions: TransactionItem[], preset: TransactionsDateFilterPreset): TrendPoint[] {
  const grouped = new Map<string, { incomeAmount: number; expenseAmount: number }>();
  const useMonthlyBuckets = preset === "year";

  transactions.forEach((transaction) => {
    const key = useMonthlyBuckets ? getMonthKey(transaction.occurredOn) : transaction.occurredOn;
    const current = grouped.get(key) ?? { incomeAmount: 0, expenseAmount: 0 };

    grouped.set(key, {
      incomeAmount: current.incomeAmount + (transaction.amount > 0 ? transaction.amount : 0),
      expenseAmount: current.expenseAmount + (transaction.amount < 0 ? Math.abs(transaction.amount) : 0),
    });
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, totals]) => {
      const amount = totals.incomeAmount + totals.expenseAmount;

      return {
        label: useMonthlyBuckets ? formatShortMonth(key) : formatShortDay(key),
        amount,
        formattedAmount: formatCurrency(amount),
        incomeAmount: totals.incomeAmount,
        expenseAmount: totals.expenseAmount,
        formattedIncomeAmount: formatCurrency(totals.incomeAmount),
        formattedExpenseAmount: formatCurrency(totals.expenseAmount),
      };
    });
}

function createCategoryBreakdown(transactions: TransactionItem[]): CategoryPieChartItem[] {
  const grouped = new Map<string, { id: string; label: string; color: string; total: number }>();

  transactions.forEach((transaction) => {
    const key = transaction.category.groupSlug || transaction.category.slug || String(transaction.category.id);
    const current = grouped.get(key);
    const nextTotal = (current?.total ?? 0) + Math.abs(transaction.amount);

    grouped.set(key, {
      id: key,
      label: transaction.category.groupLabel || transaction.category.label,
      color: transaction.category.groupColor || transaction.category.color,
      total: nextTotal,
    });
  });

  const total = Array.from(grouped.values()).reduce((sum, item) => sum + item.total, 0);

  return Array.from(grouped.values())
    .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label, "pt-BR"))
    .map((item) => ({
      ...item,
      formattedTotal: formatCurrency(item.total),
      percentage: total > 0 ? Math.round((item.total / total) * 100) : 0,
    }));
}

function createAccountBreakdown(transactions: TransactionItem[], banks: BankItem[]) {
  const bankById = new Map(banks.map((bank) => [String(bank.id), bank]));
  const grouped = new Map<string, { id: string; label: string; total: number; count: number }>();

  transactions.forEach((transaction) => {
    const key = String(transaction.account.id);
    const current = grouped.get(key);

    grouped.set(key, {
      id: key,
      label: bankById.get(key)?.name ?? transaction.account.name,
      total: (current?.total ?? 0) + Math.abs(transaction.amount),
      count: (current?.count ?? 0) + 1,
    });
  });

  return Array.from(grouped.values()).sort(
    (left, right) => right.total - left.total || right.count - left.count || left.label.localeCompare(right.label, "pt-BR"),
  );
}

function MetricsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl border border-border/40 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass-card rounded-3xl border border-border/40 p-5">
            <Skeleton className="mb-4 h-4 w-28" />
            <Skeleton className="mb-2 h-9 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <div className="glass-card rounded-3xl border border-border/40 p-5">
          <Skeleton className="mb-5 h-5 w-40" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        </div>
        <div className="glass-card rounded-3xl border border-border/40 p-5">
          <Skeleton className="mb-5 h-5 w-40" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default function ExpenseMetricsPage() {
  const isMobile = useIsMobile();
  const { data: transactions = [], isLoading: isTransactionsLoading, isError: isTransactionsError } = useTransactions();
  const { data: banks = [], isLoading: isBanksLoading } = useBanks();
  const currentSelection = getCurrentMonthSelection();
  const {
    selectedMonthIndex,
    selectedYear,
    datePreset,
    dateRange,
    handleMonthChange,
    handleYearChange,
    handlePresetChange,
    handleCustomRangeApply,
  } = useUrlPeriodFilter({
    selectedMonthIndex: currentSelection.monthIndex,
    selectedYear: currentSelection.year,
    datePreset: "month",
    dateRange: resolvePresetRange("month"),
  });

  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [typeFilter, setTypeFilter] = useState<MetricTypeFilter>("all");

  const visibleTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.housingId === null &&
          (transaction.account.accountType === "bank_account" ||
            transaction.account.accountType === "credit_card" ||
            transaction.account.accountType === "cash"),
      ),
    [transactions],
  );

  const filteredTransactions = useMemo(
    () =>
      visibleTransactions.filter((transaction) => {
        const matchesAccount = selectedAccountId === "all" || String(transaction.account.id) === selectedAccountId;
        const matchesType =
          typeFilter === "all" || (typeFilter === "income" ? transaction.amount > 0 : transaction.amount < 0);
        const matchesDate = transaction.occurredOn >= dateRange.startDate && transaction.occurredOn <= dateRange.endDate;

        return matchesAccount && matchesType && matchesDate;
      }),
    [dateRange.endDate, dateRange.startDate, selectedAccountId, typeFilter, visibleTransactions],
  );

  const expenseTransactions = useMemo(
    () => filteredTransactions.filter((transaction) => transaction.amount < 0),
    [filteredTransactions],
  );

  const incomeTransactions = useMemo(
    () => filteredTransactions.filter((transaction) => transaction.amount > 0),
    [filteredTransactions],
  );

  const metrics = useMemo(() => {
    const totalExpenses = expenseTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    const totalIncomes = incomeTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const balance = totalIncomes - totalExpenses;
    const averageExpense = expenseTransactions.length ? totalExpenses / expenseTransactions.length : 0;
    const expenseValues = expenseTransactions.map((transaction) => Math.abs(transaction.amount));
    const medianExpense = calculateMedian(expenseValues);
    const largestExpense = expenseTransactions.reduce<TransactionItem | null>((highest, transaction) => {
      if (!highest || Math.abs(transaction.amount) > Math.abs(highest.amount)) {
        return transaction;
      }

      return highest;
    }, null);

    const activeDays = new Set(filteredTransactions.map((transaction) => transaction.occurredOn)).size;
    const categoryBreakdown = createCategoryBreakdown(expenseTransactions);
    const accountBreakdown = createAccountBreakdown(expenseTransactions, banks);
    const trendSource =
      typeFilter === "income" ? incomeTransactions : typeFilter === "expense" ? expenseTransactions : filteredTransactions;
    const trendSeries = createTrendSeries(trendSource, datePreset);
    const topCategory = categoryBreakdown[0] ?? null;
    const concentrationRatio = topCategory && totalExpenses > 0 ? topCategory.total / totalExpenses : 0;

    return {
      totalExpenses,
      totalIncomes,
      balance,
      averageExpense,
      medianExpense,
      largestExpense,
      activeDays,
      categoryBreakdown,
      accountBreakdown,
      trendSeries,
      topCategory,
      concentrationRatio,
    };
  }, [banks, datePreset, expenseTransactions, filteredTransactions, incomeTransactions, typeFilter]);

  const trendConfig = useMemo<ChartConfig>(
    () => ({
      amount: {
        label: typeFilter === "income" ? "Receitas" : "Movimentacao",
        color: typeFilter === "income" ? "hsl(var(--income))" : typeFilter === "expense" ? "#ef4444" : "hsl(var(--primary))",
      },
      incomeAmount: {
        label: "Receitas",
        color: "hsl(var(--income))",
      },
      expenseAmount: {
        label: "Gastos",
        color: "#ef4444",
      },
    }),
    [typeFilter],
  );
  const topCategoriesConfig = useMemo<ChartConfig>(
    () =>
      metrics.categoryBreakdown.slice(0, 6).reduce<ChartConfig>((config, category) => {
        config[String(category.id)] = {
          label: category.label,
          color: resolveCategoryColorPresentation(category.color).solid,
        };

        return config;
      }, {}),
    [metrics.categoryBreakdown],
  );

  const accountOptions = useMemo(
    () =>
      banks.filter(
        (bank) => bank.accountType === "bank_account" || bank.accountType === "credit_card" || bank.accountType === "cash",
      ),
    [banks],
  );

  if (isTransactionsLoading || isBanksLoading) {
    return (
      <AppShell title="Métricas" description="Leitura operacional das despesas, receitas e concentração por conta">
        <MetricsSkeleton />
      </AppShell>
    );
  }

  const topAccount = metrics.accountBreakdown[0] ?? null;
  const chartData = metrics.trendSeries;
  const emptyStateMessage =
    typeFilter === "income"
      ? "Nenhuma receita encontrada para os filtros selecionados."
      : typeFilter === "expense"
        ? "Nenhuma despesa encontrada para os filtros selecionados."
        : "Nenhuma movimentação encontrada para os filtros selecionados.";

  return (
    <AppShell title="Métricas" description="Leitura operacional das despesas, receitas e concentração por conta">
      <section data-tour-id="expense-metrics-filters" className="glass-card rounded-[28px] border border-border/40 p-4">
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
            <SelectTrigger className="h-11 w-full rounded-2xl border-border/60 bg-secondary/30 xl:flex-1">
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
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center justify-between">
          
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            {dateRange.startDate.split("-").reverse().join("/")} - {dateRange.endDate.split("-").reverse().join("/")}
          </div>
          <div className="grid grid-cols-3 gap-2 xl:flex xl:flex-wrap">
            {typeFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setTypeFilter(filter.value)}
                className={cn(
                  "min-h-11 rounded-2xl px-4 py-2.5 text-sm transition-colors sm:min-h-0",
                  typeFilter === filter.value ? "bg-primary/15 text-primary" : "bg-secondary/50 text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section data-tour-id="expense-metrics-summary" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Despesas no período</span>
              <MetricInfoTooltip content="Soma de todas as despesas visíveis no recorte filtrado por período, conta e tipo." />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-expense/10 text-expense">
              <TrendingDown size={18} />
            </div>
          </div>
          <p className="text-[2rem] font-semibold text-foreground">{formatCurrency(metrics.totalExpenses)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {expenseTransactions.length} lançamentos filtrados
          </p>
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Saldo filtrado</span>
              <MetricInfoTooltip content="Resultado das receitas menos as despesas considerando apenas as movimentações dentro dos filtros atuais." />
            </div>
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", metrics.balance >= 0 ? "bg-income/10 text-income" : "bg-expense/10 text-expense")}>
              {metrics.balance >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            </div>
          </div>
          <p className={cn("text-[2rem] font-semibold", metrics.balance >= 0 ? "text-income" : "text-expense")}>
            {formatCurrency(metrics.balance)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Receitas: {formatCurrency(metrics.totalIncomes)}</p>
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ticket médio de despesa</span>
              <MetricInfoTooltip content="Média das despesas individuais do recorte. A mediana exibida abaixo representa o valor central dessas despesas ordenadas." />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Scale size={18} />
            </div>
          </div>
          <p className="text-[2rem] font-semibold text-foreground">{formatCurrency(metrics.averageExpense)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Mediana: {formatCurrency(metrics.medianExpense)}</p>
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Dias com movimentação</span>
              <MetricInfoTooltip content="Quantidade de dias distintos que tiveram ao menos uma movimentação dentro dos filtros aplicados." />
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-warning/10 text-warning">
              <CalendarRange size={18} />
            </div>
          </div>
          <p className="text-[2rem] font-semibold text-foreground">{metrics.activeDays}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Maior saida: {metrics.largestExpense ? metrics.largestExpense.description : "Sem despesas"}
          </p>
        </div>
      </section>

      <section data-tour-id="expense-metrics-trend" className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {typeFilter === "income" ? "Tendência de receitas" : "Tendência de movimentação"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {datePreset === "year" ? "Consolidado mensal" : "Consolidado diario"} da faixa selecionada
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {typeFilter === "all" ? (
                <div className="flex items-center gap-3 rounded-2xl bg-secondary/50 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-income" />
                    Receitas
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="h-2.5 w-2.5 rounded-full bg-expense" />
                    Gastos
                  </div>
                </div>
              ) : null}
              <div className="rounded-2xl bg-secondary/50 px-3 py-2 text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pico</div>
                <div className="text-sm font-medium text-foreground">
                  {chartData.length ? chartData.reduce((highest, item) => (item.amount > highest.amount ? item : highest)).formattedAmount : "--"}
                </div>
              </div>
            </div>
          </div>

          {!chartData.length ? (
            <div className="rounded-2xl border border-border/30 bg-secondary/25 p-4 text-sm text-muted-foreground">
              {isTransactionsError ? "Não foi possível carregar as métricas agora." : emptyStateMessage}
            </div>
          ) : (
            <ChartContainer config={trendConfig} className="h-[220px] w-full sm:h-[300px]">
              <BarChart data={chartData} margin={isMobile ? { top: 8, right: 4, left: -20, bottom: 0 } : { top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={isMobile ? 12 : 24} tick={{ fontSize: isMobile ? 10 : 12 }} />
                <YAxis
                  hide={isMobile}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(value: number) => `R$ ${Math.round(value / 1000)}k`}
                  tick={{ fontSize: 12 }}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      formatter={(_, __, item) => {
                        const payload = item.payload as TrendPoint;

                        return (
                          <div className="min-w-[10rem] space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">{payload.label}</span>
                              <span className="font-medium text-foreground">{payload.formattedAmount}</span>
                            </div>
                            {typeFilter === "all" ? (
                              <>
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-income">Receitas</span>
                                  <span className="font-medium text-foreground">{payload.formattedIncomeAmount}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="text-expense">Gastos</span>
                                  <span className="font-medium text-foreground">{payload.formattedExpenseAmount}</span>
                                </div>
                              </>
                            ) : null}
                          </div>
                        );
                      }}
                    />
                  }
                />
                {typeFilter === "all" ? (
                  <>
                    <Bar dataKey="incomeAmount" radius={[12, 12, 4, 4]} fill="var(--color-incomeAmount)" maxBarSize={isMobile ? 18 : 28} />
                    <Bar dataKey="expenseAmount" radius={[12, 12, 4, 4]} fill="var(--color-expenseAmount)" maxBarSize={isMobile ? 18 : 28} />
                  </>
                ) : (
                  <Bar dataKey="amount" radius={[12, 12, 4, 4]} fill="var(--color-amount)" maxBarSize={isMobile ? 24 : 40} />
                )}
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-foreground">Concentração por categoria</h2>
            <p className="text-sm text-muted-foreground">Despesas agrupadas por famílias para expor dependência e dispersão</p>
          </div>

          <CategoryPieChart
            items={metrics.categoryBreakdown}
            emptyMessage="Não há despesas suficientes para compor o concentrado por categoria."
            isError={isTransactionsError}
            chartClassName="mb-2 h-[200px] sm:h-[240px]"
          />
        </div>
      </section>

      <section className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Top categorias</h2>
            <p className="text-sm text-muted-foreground">Leitura visual do peso relativo das categorias de despesa</p>
          </div>
          <div className="rounded-2xl bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
            Concentracao: {Math.round(metrics.concentrationRatio * 100)}%
          </div>
        </div>

        {!metrics.categoryBreakdown.length ? (
          <div className="rounded-2xl border border-border/30 bg-secondary/25 p-4 text-sm text-muted-foreground">
            Não há categorias suficientes para exibir o ranking detalhado.
          </div>
        ) : (
          <ChartContainer config={topCategoriesConfig} className="h-[260px] w-full sm:h-[320px]">
            <BarChart
              data={metrics.categoryBreakdown.slice(0, 6).map((category) => ({
                ...category,
                fill: resolveCategoryColorPresentation(category.color).solid,
              }))}
              layout="vertical"
              margin={isMobile ? { top: 8, right: 8, left: 8, bottom: 0 } : { top: 8, right: 16, left: 16, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `${Math.round(value)}%`}
                tick={{ fontSize: isMobile ? 10 : 12 }}
              />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={isMobile ? 92 : 140}
                tick={{ fontSize: isMobile ? 10 : 12 }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(_, __, item) => {
                      const payload = item.payload as CategoryPieChartItem;

                      return (
                        <div className="min-w-[10rem] space-y-1">
                          <div className="font-medium text-foreground">{payload.label}</div>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-medium text-foreground">{payload.formattedTotal}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-muted-foreground">Participacao</span>
                            <span className="font-medium text-foreground">{payload.percentage}%</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar dataKey="percentage" radius={[0, 14, 14, 0]} maxBarSize={28}>
                {metrics.categoryBreakdown.slice(0, 6).map((category) => (
                  <Cell key={category.id} fill={resolveCategoryColorPresentation(category.color).solid} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </section>

      <section data-tour-id="expense-metrics-ranking" className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Leituras rápidas</h2>
              <p className="text-sm text-muted-foreground">Sinais sintéticos para revisar recorrência, concentração e relevância</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Wallet size={18} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border/30 bg-secondary/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Categoria lider</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{metrics.topCategory?.label ?? "Sem dados"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {metrics.topCategory
                  ? `${metrics.topCategory.formattedTotal} (${metrics.topCategory.percentage}% do total de despesas)`
                  : "Nenhuma categoria dominante no recorte atual."}
              </p>
            </div>

            <div className="rounded-2xl border border-border/30 bg-secondary/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Conta mais pressionada</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{topAccount?.label ?? "Sem dados"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {topAccount ? `${formatCurrency(topAccount.total)} em ${topAccount.count} lançamentos` : "Sem volume relevante por conta."}
              </p>
            </div>

            <div className="rounded-2xl border border-border/30 bg-secondary/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Maior despesa individual</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{metrics.largestExpense?.description ?? "Sem dados"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {metrics.largestExpense
                  ? `${formatCurrency(Math.abs(metrics.largestExpense.amount))} em ${metrics.largestExpense.occurredOn.split("-").reverse().join("/")}`
                  : "Nenhum gasto individual no período."}
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Ranking por conta</h2>
              <p className="text-sm text-muted-foreground">Distribuicao do volume de despesas por origem de pagamento</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-info/10 text-info">
              <Landmark size={18} />
            </div>
          </div>

          {!metrics.accountBreakdown.length ? (
            <div className="rounded-2xl border border-border/30 bg-secondary/25 p-4 text-sm text-muted-foreground">
              Não há despesas suficientes para montar o ranking por conta.
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.accountBreakdown.map((account, index) => {
                const share = metrics.totalExpenses > 0 ? Math.round((account.total / metrics.totalExpenses) * 100) : 0;

                return (
                  <div key={account.id} className="rounded-2xl border border-border/30 bg-secondary/20 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">#{index + 1}</p>
                        <p className="truncate text-base font-medium text-foreground">{account.label}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-foreground">{formatCurrency(account.total)}</p>
                        <p className="text-sm text-muted-foreground">{account.count} lançamentos</p>
                      </div>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-secondary/70">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">{share}% das despesas filtradas</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

    </AppShell>
  );
}
