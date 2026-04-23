import { Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { InsightItem } from "@/types/api";

interface AiInsightsProps {
  insights?: InsightItem[];
  isLoading?: boolean;
  isError?: boolean;
  showRecommendedActions?: boolean;
  isDisabled?: boolean;
  disabledReason?: string;
}

function getPriorityClasses(priority: InsightItem["priority"]) {
  switch (priority) {
    case "high":
      return "border-warning/30 bg-warning/10 text-warning";
    case "medium":
      return "border-info/30 bg-info/10 text-info";
    default:
      return "border-border/40 bg-secondary/70 text-muted-foreground";
  }
}

function getToneClasses(tone: string) {
  switch (tone) {
    case "warning":
      return "border-warning/30 bg-warning/10 text-warning";
    case "info":
      return "border-info/30 bg-info/10 text-info";
    case "success":
      return "border-income/30 bg-income/10 text-income";
    default:
      return "border-primary/20 bg-primary/10 text-primary";
  }
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

export default function AiInsights({
  insights = [],
  isLoading,
  isError,
  showRecommendedActions = false,
  isDisabled = false,
  disabledReason = "Os insights estao desabilitados ate a definicao da regra de negocio.",
}: AiInsightsProps) {
  if (isDisabled) {
    return (
      <div className="glass-card animate-fade-in p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Lightbulb size={14} className="text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">Insights da IA</h3>
        </div>

        <div className="rounded-xl border border-dashed border-border/50 bg-secondary/30 p-4">
          <p className="text-sm font-medium text-foreground">Recurso desabilitado</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{disabledReason}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <AiInsightsSkeleton />;
  }

  const recommendedActions = [...new Map(insights.filter((item) => item.action?.href).map((item) => [item.action?.kind, item.action])).values()];

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
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.tagColor}`}>{item.tag}</span>
                      <Badge variant="outline" className={getPriorityClasses(item.priority)}>
                        Prioridade {item.priorityLabel}
                      </Badge>
                      <Badge variant="outline" className={getToneClasses(item.tone)}>
                        {item.toneLabel}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                    {item.action?.href ? (
                      <div className="mt-3">
                        <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                          <Link to={item.action.href}>{item.action.label}</Link>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showRecommendedActions && recommendedActions.length ? (
        <div className="mt-5 rounded-xl border border-border/30 bg-secondary/30 p-4">
          <p className="text-sm font-medium text-foreground">Acoes recomendadas</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {recommendedActions.map((action) =>
              action?.href ? (
                <Button key={action.kind} asChild size="sm" variant="secondary" className="h-8">
                  <Link to={action.href}>{action.label}</Link>
                </Button>
              ) : null,
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
