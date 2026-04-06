import Sidebar from "@/components/Sidebar";
import BalanceCards from "@/components/BalanceCards";
import ExpensesList from "@/components/ExpensesList";
import SpendingChart from "@/components/SpendingChart";
import AiChat from "@/components/AiChat";
import AiInsights from "@/components/AiInsights";
import BankConnection from "@/components/BankConnection";
import { Bell } from "lucide-react";

const Index = () => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Bom dia, João 👋</h1>
              <p className="text-sm text-muted-foreground">Aqui está o resumo das suas finanças</p>
            </div>
            <button className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors relative">
              <Bell size={16} className="text-muted-foreground" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-expense border-2 border-background" />
            </button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          <BalanceCards />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Transactions + Chart */}
            <div className="lg:col-span-2 space-y-6">
              <ExpensesList />
              <AiInsights />
            </div>

            {/* Right: Chat + Bank + Chart */}
            <div className="space-y-6">
              <BankConnection />
              <SpendingChart />
              <div className="h-[420px]">
                <AiChat />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
