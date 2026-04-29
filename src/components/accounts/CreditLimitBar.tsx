import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CreditLimitBarProps {
  currentBalance: number;
  creditLimit: number;
  formattedCreditLimit: string | null;
  barContainerClassName?: string;
  className?: string;
}

export default function CreditLimitBar({
  currentBalance,
  creditLimit,
  formattedCreditLimit,
  barContainerClassName,
  className,
}: CreditLimitBarProps) {
  const used = Math.max(0, currentBalance);
  const pct = Math.min(100, (used / creditLimit) * 100);
  const available = Math.max(0, creditLimit - used);
  const availablePct = Math.max(0, 100 - pct);

  const barColor = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-income";
  const formattedUsed = used.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formattedLimit =
    formattedCreditLimit ?? creditLimit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formattedAvailable = available.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const resolvedBarContainerClassName = barContainerClassName ?? "w-56 max-w-full";

  return (
    <div className={cn("mt-2 space-y-1.5", className)}>
      <div className={cn(resolvedBarContainerClassName, "space-y-1")}>
        <div className="text-xs text-muted-foreground">
          <span>
            {formattedUsed} de {formattedLimit}
          </span>
        </div>
        <div className="text-[11px] font-medium text-muted-foreground">
          <span>{pct.toFixed(0)}% usado</span>
        </div>
      </div>
      <TooltipProvider delayDuration={120}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(resolvedBarContainerClassName, "cursor-default")}>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-border/40">
                <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="space-y-1 text-xs">
            <p>{pct.toFixed(0)}% do limite usado</p>
            <p>{availablePct.toFixed(0)}% disponivel</p>
            <p className="text-muted-foreground">{formattedAvailable} livre</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
