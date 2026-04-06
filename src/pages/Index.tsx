import { Bell } from "lucide-react";
import { useEffect } from "react";

import AiChat from "@/components/AiChat";
import AiInsights from "@/components/AiInsights";
import BalanceCards from "@/components/BalanceCards";
import BankConnection from "@/components/BankConnection";
import ExpensesList from "@/components/ExpensesList";
import Sidebar from "@/components/Sidebar";
import SpendingChart from "@/components/SpendingChart";
import { toast } from "@/components/ui/sonner";
import { useDashboard } from "@/hooks/use-dashboard";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function Index() {
  const { data, isLoading, isError, error } = useDashboard();

  useEffect(() => {
    if (!isError) {
      return;
    }

    toast.error("Nao foi possivel carregar o dashboard.", {
      description: getErrorMessage(error, "Tente novamente em instantes."),
    });
  }, [error, isError]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 px-6 py-4 backdrop-blur-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Bom dia, {data?.user.name ?? "Joao"} {"\u{1F44B}"}
              </h1>
              <p className="text-sm text-muted-foreground">Aqui esta o resumo das suas financas</p>
            </div>
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-secondary transition-colors hover:bg-secondary/80"
            >
              <Bell size={16} className="text-muted-foreground" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-expense" />
            </button>
          </div>
        </header>

        <div className="space-y-6 p-6">
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
        </div>
      </main>
    </div>
  );
}
