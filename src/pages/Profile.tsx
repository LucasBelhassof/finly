import { BellRing, Settings, ShieldCheck, UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/hooks/use-dashboard";
import { appRoutes } from "@/lib/routes";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { data } = useDashboard();
  const userName = data?.user.name ?? "Joao";
  const userEmail = "joao@email.com";
  const userId = data?.user.id ? String(data.user.id) : "--";

  return (
    <AppShell title="Perfil" description="Informacoes da conta e atalhos pessoais">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="glass-card rounded-2xl border border-border/40 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <UserCircle2 size={32} />
            </div>
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-semibold text-foreground">{userName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{userEmail}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">ID do usuário: {userId}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
              <p className="text-sm text-muted-foreground">Mês de referência</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{data?.referenceMonth ?? "--"}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
              <p className="text-sm text-muted-foreground">Contas vinculadas</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{data?.banks.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-secondary/20 p-4">
              <p className="text-sm text-muted-foreground">Insights gerados</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{data?.insights.length ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5">
            <h3 className="text-lg font-semibold text-foreground">Ações da conta</h3>
            <div className="mt-4 space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start rounded-xl border-border/60 bg-secondary/20"
                onClick={() => navigate(appRoutes.settings)}
              >
                <Settings size={16} />
                Abrir Configurações
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-xl border-border/60 bg-secondary/20" disabled>
                <BellRing size={16} />
                Preferências de notificação
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-xl border-border/60 bg-secondary/20" disabled>
                <ShieldCheck size={16} />
                Segurança da conta
              </Button>
            </div>
          </div>

          <div className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5">
            <h3 className="text-lg font-semibold text-foreground">Resumo</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Esta área concentra informações do usuário e atalhos pessoais. Ajustes técnicos e parâmetros do ambiente
              continuam disponíveis em Configurações.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
