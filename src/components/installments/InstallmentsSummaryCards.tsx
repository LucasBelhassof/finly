import type { InstallmentsOverview } from "@/types/api";

import { formatCurrency } from "./formatters";

interface InstallmentsSummaryCardsProps {
  overview: InstallmentsOverview;
}

export default function InstallmentsSummaryCards({ overview }: InstallmentsSummaryCardsProps) {
  const cards = [
    {
      label: "Parcelamentos ativos",
      value: String(overview.activeInstallmentsCount),
      accent: "text-foreground",
    },
    {
      label: "Compromisso mensal",
      value: formatCurrency(overview.monthlyCommitment),
      accent: "text-warning",
    },
    {
      label: "Saldo total a pagar",
      value: formatCurrency(overview.remainingBalanceTotal),
      accent: "text-expense",
    },
    {
      label: "Total original parcelado",
      value: formatCurrency(overview.originalAmountTotal),
      accent: "text-info",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">{card.label}</p>
          <p className={`mt-2 break-words text-[1.65rem] font-semibold sm:text-[1.9rem] ${card.accent}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
