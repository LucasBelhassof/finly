import AppShell from "@/components/AppShell";
import { useHealth } from "@/hooks/use-health";

const apiUrl = import.meta.env.VITE_API_URL?.trim() || "http://localhost:3001";

function formatServerTime(value?: string) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export default function SettingsPage() {
  const { data, isLoading, isError } = useHealth();

  return (
    <AppShell title="Configurações" description="Status da integração e parametros do ambiente">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">API</p>
          <p className="mt-1 text-sm font-medium text-foreground break-all">{apiUrl}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Backend</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {isLoading ? "..." : data?.status === "ok" ? "Online" : "Indisponivel"}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Banco</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {isLoading ? "..." : data?.database === "connected" ? "Conectado" : "Indisponivel"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Diagnóstico</h2>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-secondary/30 px-4 py-3">
              <span className="text-muted-foreground">Status da API</span>
              <span className="font-medium text-foreground">{data?.status ?? (isLoading ? "Carregando" : "--")}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-secondary/30 px-4 py-3">
              <span className="text-muted-foreground">Conexao com banco</span>
              <span className="font-medium text-foreground">
                {data?.database ?? (isLoading ? "Carregando" : "--")}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-secondary/30 px-4 py-3">
              <span className="text-muted-foreground">Horario do servidor</span>
              <span className="font-medium text-foreground">{formatServerTime(data?.serverTime)}</span>
            </div>
          </div>

          {isError ? (
            <div className="mt-4 rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
              Nao foi possivel consultar o endpoint de health agora.
            </div>
          ) : null}
        </div>

        <div className="glass-card p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Observações</h2>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>As rotas da sidebar agora estão conectadas ao React Router e usam os dados reais da API.</p>
            <p>As migrations do Postgres podem ser reaplicadas com `npm run db:migrate`.</p>
            <p>Para recriar o schema inteiro do banco local, use `npm run db:fresh`.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
