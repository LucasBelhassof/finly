import { ArrowDownRight, ArrowUpRight, CalendarRange, Landmark, Scale, TrendingDown, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import AppShell from "@/components/AppShell";
import CategoryPieChart, { type CategoryPieChartItem } from "@/components/CategoryPieChart";
import TransactionsDateFilter from "@/components/transactions/TransactionsDateFilter";
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
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { resolveCategoryColorPresentation } from "@/lib/category-colors";
import { formatDateRangeLabel, resolvePresetRange, type TransactionsDateFilterPreset } from "@/lib/transactions-date-filter";
import { cn } from "@/lib/utils";
import type { BankItem, TransactionItem } from "@/types/api";

type MetricTypeFilter = "all" | "income" | "expense";

type TrendPoint = {
  label: string;
  amount: number;
  formattedAmount: string;
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
  const grouped = new Map<string, number>();
  const useMonthlyBuckets = preset === "year";

  transactions.forEach((transaction) => {
    const key = useMonthlyBuckets ? getMonthKey(transaction.occurredOn) : transaction.occurredOn;
    grouped.set(key, (grouped.get(key) ?? 0) + Math.abs(transaction.amount));
  });

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, amount]) => ({
      label: useMonthlyBuckets ? formatShortMonth(key) : formatShortDay(key),
      amount,
      formattedAmount: formatCurrency(amount),
    }));
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

  const [datePreset, setDatePreset] = useState<TransactionsDateFilterPreset>("month");
  const [dateRange, setDateRange] = useState(() => resolvePresetRange("month"));
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
        color: typeFilter === "income" ? "hsl(var(--income))" : "hsl(var(--primary))",
      },
    }),
    [typeFilter],
  );

  const accountOptions = useMemo(
    () =>
      banks.filter(
        (bank) => bank.accountType === "bank_account" || bank.accountType === "credit_card" || bank.accountType === "cash",
      ),
    [banks],
  );

  const handlePresetChange = (preset: Exclude<TransactionsDateFilterPreset, "custom">) => {
    setDatePreset(preset);
    setDateRange(resolvePresetRange(preset));
  };

  const handleCustomRangeApply = (range: { startDate: string; endDate: string }) => {
    setDatePreset("custom");
    setDateRange(range);
  };

  if (isTransactionsLoading || isBanksLoading) {
    return (
      <AppShell title="Metricas" description="Leitura operacional das despesas, receitas e concentracao por conta">
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
        : "Nenhuma movimentacao encontrada para os filtros selecionados.";

  return (
    <AppShell title="Metricas" description="Leitura operacional das despesas, receitas e concentracao por conta">
      <section className="glass-card rounded-[28px] border border-border/40 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <TransactionsDateFilter
            preset={datePreset}
            range={dateRange}
            onSelectPreset={handlePresetChange}
            onApplyCustomRange={handleCustomRangeApply}
          />

          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="h-11 rounded-2xl border-border/60 bg-secondary/30">
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

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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

          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground sm:ml-auto">
            {formatDateRangeLabel(dateRange, datePreset)}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Despesas no periodo</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-expense/10 text-expense">
              <TrendingDown size={18} />
            </div>
          </div>
          <p className="text-[2rem] font-semibold text-foreground">{formatCurrency(metrics.totalExpenses)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {expenseTransactions.length} lancamentos filtrados
          </p>
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Saldo filtrado</span>
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
            <span className="text-sm text-muted-foreground">Ticket medio de despesa</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Scale size={18} />
            </div>
          </div>
          <p className="text-[2rem] font-semibold text-foreground">{formatCurrency(metrics.averageExpense)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Mediana: {formatCurrency(metrics.medianExpense)}</p>
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Dias com movimentacao</span>
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {typeFilter === "income" ? "Tendencia de receitas" : "Tendencia de movimentacao"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {datePreset === "year" ? "Consolidado mensal" : "Consolidado diario"} da faixa selecionada
              </p>
            </div>
            <div className="rounded-2xl bg-secondary/50 px-3 py-2 text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pico</div>
              <div className="text-sm font-medium text-foreground">
                {chartData.length ? chartData.reduce((highest, item) => (item.amount > highest.amount ? item : highest)).formattedAmount : "--"}
              </div>
            </div>
          </div>

          {!chartData.length ? (
            <div className="rounded-2xl border border-border/30 bg-secondary/25 p-4 text-sm text-muted-foreground">
              {isTransactionsError ? "Nao foi possivel carregar as metricas agora." : emptyStateMessage}
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
                          <div className="flex min-w-[8rem] items-center justify-between gap-3">
                            <span className="text-muted-foreground">{payload.label}</span>
                            <span className="font-medium text-foreground">{payload.formattedAmount}</span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Bar dataKey="amount" radius={[12, 12, 4, 4]} fill="var(--color-amount)" maxBarSize={isMobile ? 24 : 40} />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-foreground">Concentracao por categoria</h2>
            <p className="text-sm text-muted-foreground">Despesas agrupadas por familias para expor dependencia e dispersao</p>
          </div>

          <CategoryPieChart
            items={metrics.categoryBreakdown}
            emptyMessage="Nao ha despesas suficientes para compor o concentrado por categoria."
            isError={isTransactionsError}
            chartClassName="mb-2 h-[200px] sm:h-[240px]"
          />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Leituras rapidas</h2>
              <p className="text-sm text-muted-foreground">Sinais sinteticos para revisar recorrencia, concentracao e relevancia</p>
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
                {topAccount ? `${formatCurrency(topAccount.total)} em ${topAccount.count} lancamentos` : "Sem volume relevante por conta."}
              </p>
            </div>

            <div className="rounded-2xl border border-border/30 bg-secondary/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Maior despesa individual</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{metrics.largestExpense?.description ?? "Sem dados"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {metrics.largestExpense
                  ? `${formatCurrency(Math.abs(metrics.largestExpense.amount))} em ${metrics.largestExpense.occurredOn.split("-").reverse().join("/")}`
                  : "Nenhum gasto individual no periodo."}
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
              Nao ha despesas suficientes para montar o ranking por conta.
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
                        <p className="text-sm text-muted-foreground">{account.count} lancamentos</p>
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

      <section className="glass-card rounded-[28px] border border-border/40 p-4 sm:p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Top categorias</h2>
            <p className="text-sm text-muted-foreground">Leitura tabular do peso relativo das categorias de despesa</p>
          </div>
          <div className="rounded-2xl bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
            Concentracao: {Math.round(metrics.concentrationRatio * 100)}%
          </div>
        </div>

        {!metrics.categoryBreakdown.length ? (
          <div className="rounded-2xl border border-border/30 bg-secondary/25 p-4 text-sm text-muted-foreground">
            Nao ha categorias suficientes para exibir o ranking detalhado.
          </div>
        ) : (
          <div className="space-y-3">
            {metrics.categoryBreakdown.slice(0, 6).map((category) => {
              const color = resolveCategoryColorPresentation(category.color);

              return (
                <div
                  key={category.id}
                  className="grid items-center gap-3 rounded-2xl border border-border/30 bg-secondary/20 px-4 py-3 md:grid-cols-[minmax(0,1fr)_120px_88px]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color.solid }} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{category.label}</p>
                      <p className="text-sm text-muted-foreground">{category.formattedTotal}</p>
                    </div>
                  </div>
                  <div className="hidden text-right text-sm text-muted-foreground md:block">{category.percentage}% do total</div>
                  <div className="flex items-center gap-2 md:justify-end">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary/70 md:max-w-[72px]">
                      <div className="h-full rounded-full" style={{ width: `${category.percentage}%`, backgroundColor: color.solid }} />
                    </div>
                    <span className="text-sm font-medium text-foreground">{category.percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
