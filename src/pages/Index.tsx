import AppShell from "@/components/AppShell";
import AiChat from "@/components/AiChat";
import AiInsights from "@/components/AiInsights";
import BalanceCards from "@/components/BalanceCards";
import BankConnection from "@/components/BankConnection";
import ExpensesList from "@/components/ExpensesList";
import SpendingChart from "@/components/SpendingChart";
import { useDashboard } from "@/hooks/use-dashboard";

export default function Index() {
  const { data, isLoading, isError } = useDashboard();

  return (
    <AppShell title="Bom dia" description="Aqui esta o resumo das suas financas" showGreeting>
      <BalanceCards cards={data?.summaryCards} isLoading={isLoading} isError={isError} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ExpensesList transactions={data?.recentTransactions} isLoading={isLoading} isError={isError} />
          <AiInsights insights={data?.insights} isLoading={isLoading} isError={isError} />
        </div>

        <div className="space-y-6">
          <BankConnection banks={data?.banks} isLoading={isLoading} isError={isError} />
          <SpendingChart spending={data?.spendingByCategory} isLoading={isLoading} isError={isError} />
          <div className="h-[420px]">
            <AiChat initialMessages={data?.chatMessages} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
