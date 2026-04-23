import { Link } from "react-router-dom";

import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { appRoutes } from "@/lib/routes";

export default function InsightsPage() {
  return (
    <AppShell title="Insights" description="Area temporariamente desabilitada">
      <div data-tour-id="insights-summary" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="mt-1 text-2xl font-bold text-foreground">Desabilitado</p>
        </div>
        <div className="glass-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Motivo</p>
          <p className="mt-1 text-base font-semibold text-foreground">Sem regra de negocio definida</p>
        </div>
        <div className="glass-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Alternativa atual</p>
          <p className="mt-1 text-base font-semibold text-primary">Use o chat financeiro</p>
        </div>
      </div>

      <div data-tour-id="insights-recommendations" className="glass-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Insights em espera</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Esta area foi mantida visivel, mas o recurso esta desligado porque ainda nao existe uma regra de negocio fechada para gerar insights confiaveis.
          Enquanto isso, o chat usa os dados financeiros reais do usuario para analisar gastos, montar planos e orientar proximos passos.
        </p>
        <div className="mt-5">
          <Button asChild>
            <Link to={appRoutes.chat}>Abrir chat financeiro</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
