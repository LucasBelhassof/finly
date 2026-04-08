import { Skeleton } from "@/components/ui/skeleton";
import type { SpendingItem } from "@/types/api";

interface SpendingChartProps {
  spending?: SpendingItem[];
  isLoading?: boolean;
  isError?: boolean;
}

function SpendingChartSkeleton() {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="mb-4 font-semibold text-foreground">Gastos por Categoria</h3>
      <Skeleton className="mb-5 h-3 w-full rounded-full" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SpendingChart({ spending = [], isLoading, isError }: SpendingChartProps) {
  if (isLoading) {
    return <SpendingChartSkeleton />;
  }

  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="mb-4 font-semibold text-foreground">Gastos por Categoria</h3>

      {!spending.length ? (
        <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
          {isError
            ? "Nao foi possivel carregar o consolidado por categoria."
            : "Ainda nao existem gastos categorizados para exibir."}
        </div>
      ) : (
        <>
          <div className="mb-5 flex h-3 overflow-hidden rounded-full gap-0.5">
            {spending.map((item) => (
              <div
                key={item.slug}
                className={`${item.color} rounded-full transition-all`}
                style={{ width: `${item.percentage}%` }}
                title={`${item.label}: ${item.formattedTotal}`}
              />
            ))}
          </div>

          <div className="space-y-3">
            {spending.map((item) => (
              <div key={item.slug} className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
                <span className="flex-1 text-sm text-foreground">{item.label}</span>
                <span className="text-sm font-medium text-muted-foreground">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
