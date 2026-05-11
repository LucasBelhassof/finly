import AppShell from "@/components/AppShell";
import BalanceCards from "@/components/BalanceCards";
import BankConnection from "@/components/BankConnection";
import DashboardChatCard from "@/components/DashboardChatCard";
import ExpensesList from "@/components/ExpensesList";
import PageFiltersPanel from "@/components/PageFiltersPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SpendingChart from "@/components/SpendingChart";
import { useDashboard } from "@/hooks/use-dashboard";
import { useTransactions } from "@/hooks/use-transactions";
import { useUrlPeriodFilter } from "@/hooks/use-url-period-filter";
import { resolveDayPeriodGreeting } from "@/lib/greeting";
import { getCurrentMonthSelection, resolveMonthYearRange } from "@/lib/transactions-date-filter";
import { useActionOnboardingProgress } from "@/modules/auth/hooks/use-action-onboarding-progress";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";
import { useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { SpendingItem, SummaryCard, TransactionItem } from "@/types/api";

type DashboardPurchaseTypeFilter = "all" | "bank_account" | "credit_card" | "cash";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getComparisonDescription(datePreset: string): string {
  switch (datePreset) {
    case "month":
      return "comparado ao mês anterior";
    case "year":
      return "comparado ao ano anterior";
    case "custom":
      return "comparado ao período anterior";
    default:
      return "comparado ao período anterior";
  }
}

function getPreviousPeriodRange(
  datePreset: string,
  dateRange: { startDate: string; endDate: string },
): { startDate: string; endDate: string } {
  const pad = (n: number) => String(n).padStart(2, "0");

  if (datePreset === "month") {
    const [yearStr, monthStr] = dateRange.startDate.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const lastDay = new Date(prevYear, prevMonth, 0).getDate();
    return {
      startDate: `${prevYear}-${pad(prevMonth)}-01`,
      endDate: `${prevYear}-${pad(prevMonth)}-${pad(lastDay)}`,
    };
  }

  if (datePreset === "year") {
    const year = Number(dateRange.startDate.split("-")[0]);
    return { startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31` };
  }

  const startMs = new Date(dateRange.startDate + "T00:00:00").getTime();
  const endMs = new Date(dateRange.endDate + "T00:00:00").getTime();
  const durationMs = endMs - startMs;
  const prevEndMs = startMs - 86400000;
  const prevStartMs = prevEndMs - durationMs;
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  return { startDate: fmt(prevStartMs), endDate: fmt(prevEndMs) };
}

function formatAbsoluteDelta(delta: number): string {
  if (delta === 0) return formatCurrency(0);
  return delta > 0 ? `+${formatCurrency(delta)}` : formatCurrency(delta);
}

function buildDashboardSummaryCards(
  templateCards: SummaryCard[],
  filteredTransactions: TransactionItem[],
  periodLabel: string,
  datePreset: string,
  previousPeriodTransactions?: TransactionItem[],
): SummaryCard[] {
  const totalIncomes = filteredTransactions
    .filter((transaction) => transaction.amount > 0)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpenses = filteredTransactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const balance = totalIncomes - totalExpenses;

  const previousTotalIncomes = previousPeriodTransactions
    ? previousPeriodTransactions
        .filter((transaction) => transaction.amount > 0)
        .reduce((sum, transaction) => sum + transaction.amount, 0)
    : 0;
  const previousTotalExpenses = previousPeriodTransactions
    ? previousPeriodTransactions
        .filter((transaction) => transaction.amount < 0)
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)
    : 0;
  const previousBalance = previousTotalIncomes - previousTotalExpenses;

  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const incomeChange = calculatePercentageChange(totalIncomes, previousTotalIncomes);
  const expenseChange = calculatePercentageChange(totalExpenses, previousTotalExpenses);
  const balanceChange = calculatePercentageChange(balance, previousBalance);

  const templatesByKind = {
    income: templateCards.find((card) => card.label.toLowerCase().includes("receita")) ?? null,
    expense: templateCards.find((card) => card.label.toLowerCase().includes("despesa")) ?? null,
    balance: templateCards.find((card) => card.label.toLowerCase().includes("saldo")) ?? null,
  };

  const comparisonDescription = getComparisonDescription(datePreset);

  return [
    {
      ...(templatesByKind.income ?? templateCards[0] ?? {}),
      label: templatesByKind.income?.label ?? "Receitas",
      value: totalIncomes,
      formattedValue: formatCurrency(totalIncomes),
      positive: true,
      change: `${incomeChange >= 0 ? "+" : ""}${incomeChange}%`,
      description: comparisonDescription,
      changePositive: incomeChange >= 0,
      previousFormattedValue:
        previousPeriodTransactions !== undefined ? formatCurrency(previousTotalIncomes) : undefined,
      absoluteDeltaFormatted:
        previousPeriodTransactions !== undefined ? formatAbsoluteDelta(totalIncomes - previousTotalIncomes) : undefined,
      icon: (templatesByKind.income ?? templateCards[0])?.icon,
    },
    {
      ...(templatesByKind.expense ?? templateCards[1] ?? {}),
      label: templatesByKind.expense?.label ?? "Despesas",
      value: totalExpenses,
      formattedValue: formatCurrency(totalExpenses),
      positive: false,
      change: `${expenseChange >= 0 ? "+" : ""}${expenseChange}%`,
      description: comparisonDescription,
      changePositive: expenseChange <= 0,
      previousFormattedValue:
        previousPeriodTransactions !== undefined ? formatCurrency(previousTotalExpenses) : undefined,
      absoluteDeltaFormatted:
        previousPeriodTransactions !== undefined
          ? formatAbsoluteDelta(totalExpenses - previousTotalExpenses)
          : undefined,
      icon: (templatesByKind.expense ?? templateCards[1])?.icon,
    },
    {
      ...(templatesByKind.balance ?? templateCards[2] ?? {}),
      label: templatesByKind.balance?.label ?? "Saldo acumulado",
      value: balance,
      formattedValue: formatCurrency(balance),
      positive: balance >= 0,
      change: `${balanceChange >= 0 ? "+" : ""}${balanceChange}%`,
      description: comparisonDescription,
      changePositive: balanceChange >= 0,
      previousFormattedValue: previousPeriodTransactions !== undefined ? formatCurrency(previousBalance) : undefined,
      absoluteDeltaFormatted:
        previousPeriodTransactions !== undefined ? formatAbsoluteDelta(balance - previousBalance) : undefined,
      icon: (templatesByKind.balance ?? templateCards[2])?.icon,
    },
  ];
}

function buildSpendingItems(transactions: TransactionItem[]): SpendingItem[] {
  const expenseTransactions = transactions.filter((transaction) => transaction.amount < 0);
  const grouped = new Map<string, { slug: string; label: string; color: string; total: number }>();

  expenseTransactions.forEach((transaction) => {
    const key = transaction.category.groupSlug || transaction.category.slug || String(transaction.category.id);
    const current = grouped.get(key);
    const nextTotal = (current?.total ?? 0) + Math.abs(transaction.amount);

    grouped.set(key, {
      slug: key,
      label: transaction.category.groupLabel || transaction.category.label,
      color: transaction.category.groupColor || transaction.category.color,
      total: nextTotal,
    });
  });

  const totalExpenses = expenseTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  return Array.from(grouped.values())
    .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label, "pt-BR"))
    .map((item) => ({
      slug: item.slug,
      label: item.label,
      color: item.color,
      total: item.total,
      formattedTotal: formatCurrency(item.total),
      percentage: totalExpenses > 0 ? Math.round((item.total / totalExpenses) * 100) : 0,
    }));
}

export default function Index() {
  const { user } = useAuthSession();
  const { completeActionStep } = useActionOnboardingProgress();
  const currentSelection = getCurrentMonthSelection();
  const defaultDateRange = resolveMonthYearRange(currentSelection.monthIndex, currentSelection.year);
  const [, setSearchParams] = useSearchParams();
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
    dateRange: resolveMonthYearRange(currentSelection.monthIndex, currentSelection.year),
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    void completeActionStep("dashboard");
  }, [completeActionStep, user]);
  const { data, isLoading, isError } = useDashboard({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const { data: transactions = [], isLoading: isTransactionsLoading, isError: isTransactionsError } = useTransactions();
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [selectedPurchaseType, setSelectedPurchaseType] = useState<DashboardPurchaseTypeFilter>("all");
  const [selectedCreditCardId, setSelectedCreditCardId] = useState("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");

  const supportedTransactions = useMemo(
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
  const accountOptions = useMemo(() => {
    const banks = data?.banks ?? [];

    return banks.filter((bank) => bank.accountType === "bank_account" || bank.accountType === "cash");
  }, [data?.banks]);
  const creditCardOptions = useMemo(() => {
    const banks = data?.banks ?? [];

    return banks.filter((bank) => bank.accountType === "credit_card");
  }, [data?.banks]);
  const selectedAccount = useMemo(
    () => accountOptions.find((bank) => String(bank.id) === selectedAccountId) ?? null,
    [accountOptions, selectedAccountId],
  );
  const selectedAccountLinkedCardIds = useMemo(
    () =>
      new Set(
        creditCardOptions
          .filter((card) => String(card.parentBankConnectionId) === String(selectedAccount?.id))
          .map((card) => String(card.id)),
      ),
    [creditCardOptions, selectedAccount],
  );
  const availableCreditCardOptions = useMemo(() => {
    if (!selectedAccount || selectedAccount.accountType !== "bank_account") {
      return creditCardOptions;
    }

    return creditCardOptions.filter((card) => String(card.parentBankConnectionId) === String(selectedAccount.id));
  }, [creditCardOptions, selectedAccount]);
  const availablePurchaseTypeOptions = useMemo(() => {
    if (selectedAccount?.accountType === "cash") {
      return [{ value: "cash" as const, label: "Caixa / dinheiro" }];
    }

    if (selectedAccount?.accountType === "bank_account") {
      return [
        { value: "all" as const, label: "Todos os tipos" },
        { value: "bank_account" as const, label: "Conta corrente" },
        ...(availableCreditCardOptions.length > 0 ? [{ value: "credit_card" as const, label: "Cartão" }] : []),
      ];
    }

    const hasBankAccounts = accountOptions.some((bank) => bank.accountType === "bank_account");
    const hasCreditCards = creditCardOptions.length > 0;
    const hasCashAccounts = accountOptions.some((bank) => bank.accountType === "cash");

    return [
      { value: "all" as const, label: "Todos os tipos" },
      ...(hasBankAccounts ? [{ value: "bank_account" as const, label: "Conta corrente" }] : []),
      ...(hasCreditCards ? [{ value: "credit_card" as const, label: "Cartão" }] : []),
      ...(hasCashAccounts ? [{ value: "cash" as const, label: "Caixa / dinheiro" }] : []),
    ];
  }, [accountOptions, availableCreditCardOptions.length, creditCardOptions.length, selectedAccount]);
  const dashboardTransactions = useMemo(
    () =>
      supportedTransactions.filter((transaction) => {
        const transactionAccountId = String(transaction.account.id);
        const isSelectedAccountTransaction = selectedAccount
          ? transactionAccountId === String(selectedAccount.id)
          : false;
        const isLinkedCardTransaction = selectedAccountLinkedCardIds.has(transactionAccountId);
        const matchesDate =
          transaction.occurredOn >= dateRange.startDate && transaction.occurredOn <= dateRange.endDate;
        const matchesPurchaseType =
          selectedPurchaseType === "all" || transaction.account.accountType === selectedPurchaseType;
        const matchesAccount =
          selectedAccountId === "all"
            ? true
            : selectedAccount?.accountType === "bank_account"
              ? isSelectedAccountTransaction || isLinkedCardTransaction
              : isSelectedAccountTransaction;
        const matchesCreditCard =
          selectedPurchaseType !== "credit_card" ||
          selectedCreditCardId === "all" ||
          transactionAccountId === selectedCreditCardId;
        const matchesCategory = selectedCategoryId === "all" || String(transaction.category.id) === selectedCategoryId;

        return matchesDate && matchesPurchaseType && matchesAccount && matchesCreditCard && matchesCategory;
      }),
    [
      dateRange.endDate,
      dateRange.startDate,
      selectedAccount,
      selectedAccountId,
      selectedAccountLinkedCardIds,
      selectedCreditCardId,
      selectedPurchaseType,
      selectedCategoryId,
      supportedTransactions,
    ],
  );
  const categoryOptions = useMemo(() => {
    const grouped = new Map<string, { value: string; label: string }>();

    dashboardTransactions.forEach((transaction) => {
      const value = String(transaction.category.id);
      const label = transaction.category.label;

      if (!grouped.has(value)) {
        grouped.set(value, { value, label });
      }
    });

    return Array.from(grouped.values()).sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
  }, [dashboardTransactions]);
  const previousPeriodRange = useMemo(() => getPreviousPeriodRange(datePreset, dateRange), [datePreset, dateRange]);
  const previousDashboardTransactions = useMemo(
    () =>
      supportedTransactions.filter((transaction) => {
        const transactionAccountId = String(transaction.account.id);
        const isSelectedAccountTransaction = selectedAccount
          ? transactionAccountId === String(selectedAccount.id)
          : false;
        const isLinkedCardTransaction = selectedAccountLinkedCardIds.has(transactionAccountId);
        const matchesDate =
          transaction.occurredOn >= previousPeriodRange.startDate &&
          transaction.occurredOn <= previousPeriodRange.endDate;
        const matchesPurchaseType =
          selectedPurchaseType === "all" || transaction.account.accountType === selectedPurchaseType;
        const matchesAccount =
          selectedAccountId === "all"
            ? true
            : selectedAccount?.accountType === "bank_account"
              ? isSelectedAccountTransaction || isLinkedCardTransaction
              : isSelectedAccountTransaction;
        const matchesCreditCard =
          selectedPurchaseType !== "credit_card" ||
          selectedCreditCardId === "all" ||
          transactionAccountId === selectedCreditCardId;
        const matchesCategory = selectedCategoryId === "all" || String(transaction.category.id) === selectedCategoryId;

        return matchesDate && matchesPurchaseType && matchesAccount && matchesCreditCard && matchesCategory;
      }),
    [
      previousPeriodRange,
      selectedAccount,
      selectedAccountId,
      selectedAccountLinkedCardIds,
      selectedCreditCardId,
      selectedPurchaseType,
      selectedCategoryId,
      supportedTransactions,
    ],
  );
  const filteredSummaryCards = useMemo(
    () =>
      buildDashboardSummaryCards(
        data?.summaryCards ?? [],
        dashboardTransactions,
        `${dateRange.startDate.split("-").reverse().join("/")} - ${dateRange.endDate.split("-").reverse().join("/")}`,
        datePreset,
        previousDashboardTransactions,
      ),
    [
      dashboardTransactions,
      data?.summaryCards,
      dateRange.endDate,
      dateRange.startDate,
      datePreset,
      previousDashboardTransactions,
    ],
  );
  const filteredRecentTransactions = useMemo(
    () => [...dashboardTransactions].sort((left, right) => right.occurredOn.localeCompare(left.occurredOn)).slice(0, 8),
    [dashboardTransactions],
  );
  const filteredSpendingItems = useMemo(() => buildSpendingItems(dashboardTransactions), [dashboardTransactions]);

  useEffect(() => {
    const selectedAccountStillAvailable =
      selectedAccountId === "all" || accountOptions.some((bank) => String(bank.id) === selectedAccountId);

    if (!selectedAccountStillAvailable) {
      setSelectedAccountId("all");
    }
  }, [accountOptions, selectedAccountId]);

  useEffect(() => {
    const selectedPurchaseTypeStillAvailable = availablePurchaseTypeOptions.some(
      (option) => option.value === selectedPurchaseType,
    );

    if (!selectedPurchaseTypeStillAvailable) {
      setSelectedPurchaseType(selectedAccount?.accountType === "cash" ? "cash" : "all");
    }
  }, [availablePurchaseTypeOptions, selectedAccount, selectedPurchaseType]);

  useEffect(() => {
    if (selectedPurchaseType !== "credit_card") {
      if (selectedCreditCardId !== "all") {
        setSelectedCreditCardId("all");
      }
      return;
    }

    const selectedCreditCardStillAvailable =
      selectedCreditCardId === "all" ||
      availableCreditCardOptions.some((bank) => String(bank.id) === selectedCreditCardId);

    if (!selectedCreditCardStillAvailable) {
      setSelectedCreditCardId("all");
    }
  }, [availableCreditCardOptions, selectedCreditCardId, selectedPurchaseType]);

  useEffect(() => {
    const selectedCategoryStillAvailable =
      selectedCategoryId === "all" || categoryOptions.some((category) => category.value === selectedCategoryId);

    if (!selectedCategoryStillAvailable) {
      setSelectedCategoryId("all");
    }
  }, [categoryOptions, selectedCategoryId]);

  const handleResetFilters = () => {
    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set("month", String(currentSelection.monthIndex));
    nextSearchParams.set("year", String(currentSelection.year));
    nextSearchParams.set("preset", "month");
    nextSearchParams.set("startDate", defaultDateRange.startDate);
    nextSearchParams.set("endDate", defaultDateRange.endDate);
    setSearchParams(nextSearchParams, { replace: true });
    setSelectedAccountId("all");
    setSelectedPurchaseType("all");
    setSelectedCreditCardId("all");
    setSelectedCategoryId("all");
  };

  return (
    <AppShell title={resolveDayPeriodGreeting()} description="Aqui está o resumo das suas finanças" showGreeting>
      <PageFiltersPanel
        dataTourId="dashboard-filters"
        selectedMonthIndex={selectedMonthIndex}
        selectedYear={selectedYear}
        datePreset={datePreset}
        dateRange={dateRange}
        onMonthChange={handleMonthChange}
        onYearChange={handleYearChange}
        onSelectPreset={handlePresetChange}
        onApplyCustomRange={handleCustomRangeApply}
        primaryFilters={
          <>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:min-w-[220px] xl:flex-1">
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

            <Select
              value={selectedPurchaseType}
              onValueChange={(value) => setSelectedPurchaseType(value as DashboardPurchaseTypeFilter)}
            >
              <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:min-w-[220px] xl:flex-1">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                {availablePurchaseTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPurchaseType === "credit_card" ? (
              <Select value={selectedCreditCardId} onValueChange={setSelectedCreditCardId}>
                <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:min-w-[220px] xl:flex-1">
                  <SelectValue placeholder="Todos os cartões" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cartões</SelectItem>
                  {availableCreditCardOptions.map((card) => (
                    <SelectItem key={card.id} value={String(card.id)}>
                      {card.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:min-w-[220px] xl:flex-1">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        onResetFilters={handleResetFilters}
        periodLabel={`${dateRange.startDate.split("-").reverse().join("/")} - ${dateRange.endDate
          .split("-")
          .reverse()
          .join("/")}`}
      />

      <div data-tour-id="dashboard-summary">
        <BalanceCards
          cards={filteredSummaryCards}
          isLoading={isLoading || isTransactionsLoading}
          isError={isError || isTransactionsError}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div data-tour-id="dashboard-transactions">
            <ExpensesList
              transactions={filteredRecentTransactions}
              isLoading={isLoading || isTransactionsLoading}
              isError={isError || isTransactionsError}
            />
          </div>
          {/* <div data-tour-id="dashboard-insights">
            <AiInsights
              insights={data?.insights}
              isLoading={isLoading}
              isError={isError}
              isDisabled
              disabledReason="Os insights estão desabilitados até a definição da regra de negócio. Use o chat para análises financeiras por enquanto."
            />
          </div> */}
          <DashboardChatCard />
        </div>

        <div className="space-y-6">
          <div data-tour-id="dashboard-banks">
            <BankConnection banks={data?.banks} isLoading={isLoading} isError={isError} />
          </div>
          <SpendingChart
            spendingItems={filteredSpendingItems}
            banks={data?.banks}
            isLoading={isLoading || isTransactionsLoading}
            isError={isError || isTransactionsError}
          />
        </div>
      </div>
    </AppShell>
  );
}
