import { Skeleton } from "@/components/ui/skeleton";
import { appRoutes } from "@/lib/routes";
import type { TransactionItem } from "@/types/api";
import { Link } from "react-router-dom";

interface ExpensesListProps {
  transactions?: TransactionItem[];
  isLoading?: boolean;
  isError?: boolean;
}

function ExpensesListSkeleton() {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Ultimas Transacoes</h3>
        <Skeleton className="h-4 w-16" />
      </div>

      <div className="space-y-1">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-lg p-2.5">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-4 w-20" />
              <Skeleton className="ml-auto h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExpensesList({ transactions = [], isLoading, isError }: ExpensesListProps) {
  if (isLoading) {
    return <ExpensesListSkeleton />;
  }

  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Ultimas Transacoes</h3>
        <Link to={appRoutes.transactions} className="text-xs text-primary hover:underline">
          Ver todas
        </Link>
      </div>

      {!transactions.length ? (
        <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
          {isError
            ? "Nao foi possivel carregar as transacoes agora."
            : "Nenhuma transacao recente foi encontrada."}
        </div>
      ) : (
        <div className="space-y-1">
          {transactions.map((transaction) => {
            const Icon = transaction.category.icon;

            return (
              <Link
                key={transaction.id}
                to={appRoutes.transactions}
                className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-secondary/50"
                aria-label={`Abrir transacoes e ver ${transaction.description}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Icon size={16} className={transaction.category.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{transaction.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {transaction.category.label} · {transaction.account.name}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${
                      transaction.amount < 0 ? "text-expense" : "text-income"
                    }`}
                  >
                    {transaction.formattedAmount}
                  </p>
                  <p className="text-xs text-muted-foreground">{transaction.relativeDate}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
