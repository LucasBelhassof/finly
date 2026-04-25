import { useState } from "react";
import { Link } from "react-router-dom";

import AppShell from "@/components/AppShell";
import BalanceCards from "@/components/BalanceCards";
import BankConnection from "@/components/BankConnection";
import { Button } from "@/components/ui/button";
import ExpensesList from "@/components/ExpensesList";
import TransactionsDateFilter from "@/components/transactions/TransactionsDateFilter";
import TransactionsMonthYearFilter from "@/components/transactions/TransactionsMonthYearFilter";
import SpendingChart from "@/components/SpendingChart";
import { useDashboard } from "@/hooks/use-dashboard";
import { resolveDayPeriodGreeting } from "@/lib/greeting";
import { appRoutes } from "@/lib/routes";
import {
  TRANSACTIONS_YEAR_SELECTION,
  getCurrentMonthSelection,
  resolveMonthYearRange,
  resolvePresetRange,
  type TransactionsDateFilterPreset,
} from "@/lib/transactions-date-filter";

export default function Index() {
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => getCurrentMonthSelection().monthIndex);
  const [selectedYear, setSelectedYear] = useState(() => getCurrentMonthSelection().year);
  const [datePreset, setDatePreset] = useState<TransactionsDateFilterPreset>("month");
  const [dateRange, setDateRange] = useState(() =>
    resolveMonthYearRange(getCurrentMonthSelection().monthIndex, getCurrentMonthSelection().year),
  );
  const { data, isLoading, isError } = useDashboard({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

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

  const handlePresetChange = (preset: Exclude<TransactionsDateFilterPreset, "custom">) => {
    setDatePreset(preset);
    setDateRange(resolvePresetRange(preset));
  };

  const handleCustomRangeApply = (range: { startDate: string; endDate: string }) => {
    setDatePreset("custom");
    setDateRange(range);
  };

  return (
    <AppShell title={resolveDayPeriodGreeting()} description="Aqui está o resumo das suas finanças" showGreeting>
      <section data-tour-id="dashboard-filters" className="glass-card rounded-[28px] border border-border/40 p-4">
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
          </div>

          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            {dateRange.startDate.split("-").reverse().join("/")} - {dateRange.endDate.split("-").reverse().join("/")}
          </div>
        </div>
      </section>

      <div data-tour-id="dashboard-summary">
        <BalanceCards cards={data?.summaryCards} isLoading={isLoading} isError={isError} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div data-tour-id="dashboard-transactions">
            <ExpensesList transactions={data?.recentTransactions} isLoading={isLoading} isError={isError} />
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
          <div className="glass-card flex min-h-[220px] flex-col justify-between p-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Chat financeiro</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Abra uma conversa persistente para analisar gastos, contas e metas com uma URL propria.
              </p>
            </div>
            <div className="mt-5">
              <Button asChild>
                <Link to={appRoutes.chat}>Abrir chat</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div data-tour-id="dashboard-banks">
            <BankConnection banks={data?.banks} isLoading={isLoading} isError={isError} />
          </div>
          <SpendingChart
            spendingItems={data?.spendingByCategory}
            banks={data?.banks}
            isLoading={isLoading}
            isError={isError}
          />
        </div>
      </div>
    </AppShell>
  );
}
