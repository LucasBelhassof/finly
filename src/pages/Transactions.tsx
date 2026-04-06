import AppShell from "@/components/AppShell";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactions } from "@/hooks/use-transactions";

function TransactionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="glass-card p-5">
            <Skeleton className="mb-3 h-4 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>

      <div className="glass-card p-5">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-lg p-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const { data: transactions = [], isLoading, isError } = useTransactions();

  const expenses = transactions.filter((transaction) => transaction.amount < 0);
  const incomes = transactions.filter((transaction) => transaction.amount > 0);
  const totalExpenses = expenses.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const totalIncomes = incomes.reduce((sum, transaction) => sum + transaction.amount, 0);

  if (isLoading) {
    return (
      <AppShell title="Transacoes" description="Acompanhe todas as movimentacoes recentes">
        <TransactionsSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell title="Transacoes" description="Acompanhe todas as movimentacoes recentes">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Movimentacoes</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{transactions.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Entradas</p>
          <p className="mt-1 text-2xl font-bold text-income">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalIncomes)}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Saidas</p>
          <p className="mt-1 text-2xl font-bold text-expense">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalExpenses)}
          </p>
        </div>
      </div>

      <div className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Historico</h2>
          <span className="text-xs text-muted-foreground">Ultimos {transactions.length} registros</span>
        </div>

        {!transactions.length ? (
          <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
            {isError ? "Nao foi possivel carregar as transacoes agora." : "Nenhuma transacao encontrada."}
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => {
              const Icon = transaction.category.icon;

              return (
                <div
                  key={transaction.id}
                  className="flex items-center gap-3 rounded-xl border border-border/30 bg-secondary/20 p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Icon size={16} className={transaction.category.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{transaction.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.category.label} • {transaction.relativeDate}
                    </p>
                  </div>
                  <p className={`text-sm font-semibold ${transaction.amount < 0 ? "text-expense" : "text-income"}`}>
                    {transaction.formattedAmount}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
