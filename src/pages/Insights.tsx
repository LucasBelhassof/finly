import AppShell from "@/components/AppShell";
import AiInsights from "@/components/AiInsights";
import SpendingChart from "@/components/SpendingChart";
import { useInsights, useSpending } from "@/hooks/use-insights";

export default function InsightsPage() {
  const { data: insights = [], isLoading: insightsLoading, isError: insightsError } = useInsights();
  const { data: spending = [], isLoading: spendingLoading, isError: spendingError } = useSpending();

  const topCategory = spending[0];

  return (
    <AppShell title="Insights" description="Leituras automaticas sobre padroes e oportunidades">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Insights ativos</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{insights.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Categoria principal</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{topCategory?.label ?? "--"}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Peso da categoria</p>
          <p className="mt-1 text-2xl font-bold text-warning">{topCategory?.percentage ?? 0}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AiInsights insights={insights} isLoading={insightsLoading} isError={insightsError} />
        <div className="space-y-6">
          <SpendingChart spending={spending} isLoading={spendingLoading} isError={spendingError} />

          <div className="glass-card p-5">
            <h2 className="mb-3 text-lg font-semibold text-foreground">Leitura rapida</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {topCategory
                ? `${topCategory.label} concentra ${topCategory.percentage}% do gasto do periodo e soma ${topCategory.formattedTotal}.`
                : "Ainda nao ha dados suficientes para resumir os gastos por categoria."}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
