import type { KeyboardEvent } from "react";
import { Cell, Pie, PieChart } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { resolveCategoryColorPresentation } from "@/lib/category-colors";
import { cn } from "@/lib/utils";

export type CategoryPieChartItem = {
  id: string;
  label: string;
  color: string;
  total: number;
  formattedTotal: string;
  percentage: number;
  count?: number;
};

interface CategoryPieChartProps {
  items: CategoryPieChartItem[];
  selectedItemId?: string;
  onSelectItem?: (id: string) => void;
  emptyMessage: string;
  isError?: boolean;
  emptyErrorMessage?: string;
  chartClassName?: string;
  legendClassName?: string;
}

export default function CategoryPieChart({
  items,
  selectedItemId,
  onSelectItem,
  emptyMessage,
  isError = false,
  emptyErrorMessage = "Nao foi possivel carregar o consolidado por categoria.",
  chartClassName,
  legendClassName,
}: CategoryPieChartProps) {
  const chartConfig = items.reduce<ChartConfig>((config, item) => {
    config[item.id] = {
      label: item.label,
      color: resolveCategoryColorPresentation(item.color).solid,
    };

    return config;
  }, {});

  if (!items.length) {
    return (
      <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
        {isError ? emptyErrorMessage : emptyMessage}
      </div>
    );
  }

  const hasSelectedItem = Boolean(selectedItemId && selectedItemId !== "all");

  return (
    <>
      <ChartContainer config={chartConfig} className={cn("mb-5 h-56 w-full", chartClassName)}>
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                formatter={(_, __, item) => {
                  const payload = item.payload as CategoryPieChartItem;
                  const color = resolveCategoryColorPresentation(payload.color);

                  return (
                    <div className="flex min-w-[9rem] items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color.solid }} />
                        <span className="text-muted-foreground">{payload.label}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-foreground">{payload.formattedTotal}</div>
                        <div className="text-[11px] text-muted-foreground">{payload.percentage}% do total</div>
                      </div>
                    </div>
                  );
                }}
              />
            }
          />
          <Pie data={items} dataKey="total" nameKey="id" innerRadius={54} outerRadius={96} paddingAngle={3} strokeWidth={0}>
            {items.map((item) => {
              const color = resolveCategoryColorPresentation(item.color);
              const selected = selectedItemId === item.id;

              return (
                <Cell
                  key={item.id}
                  fill={color.solid}
                  opacity={hasSelectedItem && !selected ? 0.45 : 1}
                  stroke={selected ? color.border : color.solid}
                  strokeWidth={selected ? 4 : 0}
                  role={onSelectItem ? "button" : undefined}
                  tabIndex={onSelectItem ? 0 : undefined}
                  aria-label={onSelectItem ? `Filtrar por categoria ${item.label}` : undefined}
                  aria-pressed={onSelectItem ? selected : undefined}
                  className={onSelectItem ? "cursor-pointer" : undefined}
                  onClick={onSelectItem ? () => onSelectItem(item.id) : undefined}
                  onKeyDown={
                    onSelectItem
                      ? (event: KeyboardEvent<SVGElement>) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectItem(item.id);
                          }
                        }
                      : undefined
                  }
                />
              );
            })}
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className={cn("space-y-3", legendClassName)}>
        {items.map((item) => {
          const color = resolveCategoryColorPresentation(item.color);
          const selected = selectedItemId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={onSelectItem ? () => onSelectItem(item.id) : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                onSelectItem ? "hover:bg-secondary/30" : "cursor-default",
              )}
              style={selected ? { backgroundColor: color.soft } : undefined}
              aria-label={onSelectItem ? `Filtrar por categoria ${item.label}` : undefined}
              aria-pressed={onSelectItem ? selected : undefined}
            >
              <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color.solid }} />
              <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.formattedTotal}</span>
                </div>
                <span className="text-sm font-medium text-muted-foreground">{item.percentage}%</span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
