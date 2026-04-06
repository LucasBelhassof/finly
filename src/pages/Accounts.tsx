import AppShell from "@/components/AppShell";
import BankConnection from "@/components/BankConnection";
import { useBanks } from "@/hooks/use-banks";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function AccountsPage() {
  const { data: banks = [], isLoading, isError } = useBanks();

  const connectedBanks = banks.filter((bank) => bank.connected);
  const totalBalance = connectedBanks.reduce((sum, bank) => sum + bank.currentBalance, 0);

  return (
    <AppShell title="Contas" description="Acompanhe conexoes bancarias e saldos consolidados">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Bancos</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{banks.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Conectados</p>
          <p className="mt-1 text-2xl font-bold text-income">{connectedBanks.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Saldo consolidado</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{currencyFormatter.format(totalBalance)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <BankConnection banks={banks} isLoading={isLoading} isError={isError} />

        <div className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Detalhamento</h2>
            <span className="text-xs text-muted-foreground">Open Finance</span>
          </div>

          {!banks.length ? (
            <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
              {isError ? "Nao foi possivel carregar as contas agora." : "Nenhuma conta cadastrada."}
            </div>
          ) : (
            <div className="space-y-3">
              {banks.map((bank) => (
                <div
                  key={bank.id}
                  className="flex items-center justify-between rounded-xl border border-border/30 bg-secondary/20 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${bank.color}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{bank.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {bank.connected ? "Conectado" : "Pendente de conexao"}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {bank.connected ? bank.formattedBalance : "--"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
