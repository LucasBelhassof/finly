import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { InstallmentsOverview } from "@/types/api";

import { formatCurrency, formatMonthKey } from "./formatters";

interface InstallmentsChartsProps {
  overview: InstallmentsOverview;
}

const chartColors = [
  "hsl(var(--primary))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--income))",
  "hsl(var(--expense))",
];

export default function InstallmentsCharts({ overview }: InstallmentsChartsProps) {
  const evolutionConfig: ChartConfig = {
    amount: {
      label: "Compromisso",
      color: "hsl(var(--warning))",
    },
  };
  const categoriesConfig: ChartConfig = {
    amount: {
      label: "Compromisso",
      color: "hsl(var(--info))",
    },
  };
  const distributionConfig = overview.charts.cardDistribution.reduce<ChartConfig>((config, item, index) => {
    config[String(item.cardId)] = {
      label: item.cardName,
      color: chartColors[index % chartColors.length],
    };

    return config;
  }, {});
  const distributionData = overview.charts.cardDistribution.map((item, index) => ({
    ...item,
    fill: chartColors[index % chartColors.length],
    label: item.cardName,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="glass-card rounded-2xl border border-border/40 p-5 xl:col-span-2">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Evolucao mensal do compromisso</h2>
          <p className="text-sm text-muted-foreground">Projecao consolidada dos proximos meses com os filtros atuais.</p>
        </div>

        {!overview.charts.monthlyCommitmentEvolution.length ? (
          <div className="rounded-xl border border-border/30 bg-secondary/20 p-4 text-sm text-muted-foreground">
            Nenhuma projecao disponivel para os filtros atuais.
          </div>
        ) : (
          <ChartContainer config={evolutionConfig} className="h-[260px] w-full">
            <AreaChart data={overview.charts.monthlyCommitmentEvolution}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonthKey}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} labelFormatter={formatMonthKey} />}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="var(--color-amount)"
                fill="var(--color-amount)"
                fillOpacity={0.18}
                strokeWidth={2.5}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>

      <div className="glass-card rounded-2xl border border-border/40 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Distribuicao por cartao</h2>
          <p className="text-sm text-muted-foreground">Participacao no compromisso mensal dos parcelamentos ativos.</p>
        </div>

        {!distributionData.length ? (
          <div className="rounded-xl border border-border/30 bg-secondary/20 p-4 text-sm text-muted-foreground">
            Nao ha parcelamentos ativos para distribuir por cartao.
          </div>
        ) : (
          <ChartContainer config={distributionConfig} className="h-[260px] w-full">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(_, __, item) => {
                      const payload = item.payload as (typeof distributionData)[number];

                      return (
                        <div className="flex min-w-[12rem] items-center justify-between gap-3">
                          <span className="text-muted-foreground">{payload.cardName}</span>
                          <div className="text-right">
                            <div className="font-medium text-foreground">{formatCurrency(payload.amount)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {(payload.shareRatio * 100).toFixed(1).replace(".", ",")}%
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Pie data={distributionData} dataKey="amount" nameKey="label" innerRadius={58} outerRadius={95} strokeWidth={0}>
                {distributionData.map((item) => (
                  <Cell key={item.cardId} fill={item.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </div>

      <div className="glass-card rounded-2xl border border-border/40 p-5 xl:col-span-3">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Top categorias parceladas</h2>
          <p className="text-sm text-muted-foreground">Categorias com maior compromisso mensal no recorte atual.</p>
        </div>

        {!overview.charts.topCategories.length ? (
          <div className="rounded-xl border border-border/30 bg-secondary/20 p-4 text-sm text-muted-foreground">
            Nao ha categorias parceladas para exibir com os filtros atuais.
          </div>
        ) : (
          <ChartContainer config={categoriesConfig} className="h-[280px] w-full">
            <BarChart data={overview.charts.topCategories}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="category" axisLine={false} tickLine={false} />
              <YAxis hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
              <Bar dataKey="amount" radius={[10, 10, 0, 0]} fill="var(--color-amount)" />
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
