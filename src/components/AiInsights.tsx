import { Lightbulb } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { InsightItem } from "@/types/api";

interface AiInsightsProps {
  insights?: InsightItem[];
  isLoading?: boolean;
  isError?: boolean;
}

function AiInsightsSkeleton() {
  return (
    <div className="glass-card animate-fade-in p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Lightbulb size={14} className="text-primary" />
        </div>
        <h3 className="font-semibold text-foreground">Insights da IA</h3>
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border/30 bg-secondary/50 p-3.5">
            <div className="flex items-start gap-3">
              <Skeleton className="mt-0.5 h-8 w-8 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AiInsights({ insights = [], isLoading, isError }: AiInsightsProps) {
  if (isLoading) {
    return <AiInsightsSkeleton />;
  }

  return (
    <div className="glass-card animate-fade-in p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Lightbulb size={14} className="text-primary" />
        </div>
        <h3 className="font-semibold text-foreground">Insights da IA</h3>
      </div>

      {!insights.length ? (
        <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
          {isError ? "Nao foi possivel carregar os insights agora." : "Nenhum insight disponivel por enquanto."}
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-border/30 bg-secondary/50 p-3.5 transition-colors hover:bg-secondary/80"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.bgColor}`}>
                    <Icon size={15} className={item.iconColor} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.tagColor}`}>
                        {item.tag}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
