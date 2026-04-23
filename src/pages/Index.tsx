import AppShell from "@/components/AppShell";
import AiChat from "@/components/AiChat";
import AiInsights from "@/components/AiInsights";
import BalanceCards from "@/components/BalanceCards";
import BankConnection from "@/components/BankConnection";
import ExpensesList from "@/components/ExpensesList";
import SpendingChart from "@/components/SpendingChart";
import { useDashboard } from "@/hooks/use-dashboard";
import { useTransactions } from "@/hooks/use-transactions";

export default function Index() {
  const { data, isLoading, isError } = useDashboard();
  const { data: transactions, isLoading: isTransactionsLoading, isError: isTransactionsError } = useTransactions();

  return (
    <AppShell title="Bom dia" description="Aqui esta o resumo das suas financas" showGreeting>
      <div data-tour-id="dashboard-summary">
        <BalanceCards cards={data?.summaryCards} isLoading={isLoading} isError={isError} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div data-tour-id="dashboard-transactions">
            <ExpensesList transactions={data?.recentTransactions} isLoading={isLoading} isError={isError} />
          </div>
          <div data-tour-id="dashboard-insights">
            <AiInsights
              insights={data?.insights}
              isLoading={isLoading}
              isError={isError}
              isDisabled
              disabledReason="Os insights estao desabilitados ate a definicao da regra de negocio. Use o chat para analises financeiras por enquanto."
            />
          </div>
        </div>

        <div className="space-y-6">
          <div data-tour-id="dashboard-banks">
            <BankConnection banks={data?.banks} isLoading={isLoading} isError={isError} />
          </div>
          <SpendingChart
            transactions={transactions}
            banks={data?.banks}
            isLoading={isLoading || isTransactionsLoading}
            isError={isError || isTransactionsError}
          />
          <div className="h-[360px] sm:h-[420px]">
            <AiChat initialMessages={data?.chatMessages} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
