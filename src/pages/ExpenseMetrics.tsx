import AppShell from "@/components/AppShell";

export default function ExpenseMetricsPage() {
  return (
    <AppShell title="Métricas" description="Indicadores para acompanhar a evolucao dos gastos">
      <div className="glass-card p-5">
        <h2 className="mb-3 text-lg font-semibold text-foreground">Métricas de gastos</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Os indicadores de gastos serao implementados em uma proxima etapa.
        </p>
      </div>
    </AppShell>
  );
}
