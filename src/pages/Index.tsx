import AppShell from "@/components/AppShell";
import BalanceCards from "@/components/BalanceCards";
import BankConnection from "@/components/BankConnection";
import DashboardChatCard from "@/components/DashboardChatCard";
import ExpensesList from "@/components/ExpensesList";
import TransactionsDateFilter from "@/components/transactions/TransactionsDateFilter";
import TransactionsMonthYearFilter from "@/components/transactions/TransactionsMonthYearFilter";
import SpendingChart from "@/components/SpendingChart";
import { useDashboard } from "@/hooks/use-dashboard";
import { useUrlPeriodFilter } from "@/hooks/use-url-period-filter";
import { resolveDayPeriodGreeting } from "@/lib/greeting";
import {
  getCurrentMonthSelection,
  resolveMonthYearRange,
} from "@/lib/transactions-date-filter";

export default function Index() {
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
    dateRange: resolveMonthYearRange(currentSelection.monthIndex, currentSelection.year),
  });
  const { data, isLoading, isError } = useDashboard({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

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
          <DashboardChatCard />
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
