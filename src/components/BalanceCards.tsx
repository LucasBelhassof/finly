import { ArrowUpRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { SummaryCard } from "@/types/api";

interface BalanceCardsProps {
  cards?: SummaryCard[];
  isLoading?: boolean;
  isError?: boolean;
}

const fallbackLabels = ["Saldo Total", "Receitas", "Despesas"];

function BalanceCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {fallbackLabels.map((label) => (
        <div key={label} className="glass-card p-4 animate-fade-in sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <Skeleton className="mb-2 h-8 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

export default function BalanceCards({ cards = [], isLoading, isError }: BalanceCardsProps) {
  if (isLoading) {
    return <BalanceCardsSkeleton />;
  }

  if (!cards.length) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {fallbackLabels.map((label) => (
          <div key={label} className="glass-card p-4 animate-fade-in sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{label}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary" />
            </div>
            <p className="mb-1 break-words text-2xl font-bold text-foreground">--</p>
            <p className="text-xs text-muted-foreground">
              {isError ? "Nao foi possivel carregar os cards agora." : "Sem dados disponiveis no momento."}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="glass-card group animate-fade-in p-4 transition-all duration-300 hover:glow-border sm:p-5"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{card.label}</span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                card.positive ? "bg-income/10" : "bg-expense/10"
              }`}
            >
              <card.icon size={16} className={card.positive ? "text-income" : "text-expense"} />
            </div>
          </div>
          <p className="mb-1 break-words text-2xl font-bold text-foreground">{card.formattedValue}</p>
          <div className="flex flex-wrap items-center gap-1">
            <ArrowUpRight size={14} className={card.positive ? "text-income" : "rotate-90 text-expense"} />
            <span className={`text-xs font-medium ${card.positive ? "text-income" : "text-expense"}`}>
              {card.change}
            </span>
            <span className="ml-1 text-xs text-muted-foreground">{card.description}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
