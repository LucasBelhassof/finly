import { AlertTriangle, CalendarClock } from "lucide-react";

import type { InstallmentsOverview } from "@/types/api";

import { formatCurrency, formatMonthKey } from "./formatters";

interface InstallmentsInsightsProps {
  overview: InstallmentsOverview;
}

export default function InstallmentsInsights({ overview }: InstallmentsInsightsProps) {
  const concentration = overview.alerts.concentration;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="glass-card rounded-2xl border border-border/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={16} className={concentration.triggered ? "text-warning" : "text-muted-foreground"} />
          <h2 className="text-lg font-semibold text-foreground">Alerta de concentracao</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {concentration.triggered && concentration.cardName
            ? `${concentration.cardName} concentra ${(concentration.shareRatio * 100).toFixed(1).replace(".", ",")}% do compromisso mensal, somando ${formatCurrency(concentration.monthlyAmount)}.`
            : "Nenhum cartao excede o limite de 50% do compromisso mensal neste recorte."}
        </p>
      </div>

      <div className="glass-card rounded-2xl border border-border/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock size={16} className="text-info" />
          <h2 className="text-lg font-semibold text-foreground">Insight de quitacao</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {overview.payoffProjectionMonth
            ? `Mantido o estado atual, voce deve ficar sem parcelamentos ativos a partir de ${formatMonthKey(overview.payoffProjectionMonth)}.`
            : "Nao existem parcelamentos ativos no recorte atual."}
        </p>
      </div>
    </div>
  );
}
