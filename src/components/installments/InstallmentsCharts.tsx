import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { useMemo, useState } from "react";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { DateRangePickerInput } from "@/components/ui/date-picker-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInstallmentsOverview } from "@/hooks/use-installments";
import { resolveInstallmentsChartPeriodRange } from "@/lib/installments-period-filter";
import type { InstallmentsOverview } from "@/types/api";
import type { InstallmentsChartPeriodPreset, InstallmentsPeriodRange } from "@/lib/installments-period-filter";

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

const defaultChartPeriodPreset: InstallmentsChartPeriodPreset = "next_6_months";
const defaultChartRange = resolveInstallmentsChartPeriodRange(defaultChartPeriodPreset);

export default function InstallmentsCharts({ overview }: InstallmentsChartsProps) {
  const [chartPeriodPreset, setChartPeriodPreset] = useState<InstallmentsChartPeriodPreset>(defaultChartPeriodPreset);
  const [chartCustomPeriodRange, setChartCustomPeriodRange] = useState<InstallmentsPeriodRange | null>(null);
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
  const chartFilters = useMemo(() => {
    const baseFilters = overview.appliedFilters;

    if (chartPeriodPreset === "custom") {
      const customRange = chartCustomPeriodRange ?? {
        startDate: baseFilters.purchaseStart ?? defaultChartRange.startDate,
        endDate: baseFilters.purchaseEnd ?? defaultChartRange.endDate,
      };

      return {
        ...baseFilters,
        purchaseStart: customRange.startDate,
        purchaseEnd: customRange.endDate,
      };
    }

    const range = resolveInstallmentsChartPeriodRange(chartPeriodPreset);
    return {
      ...baseFilters,
      purchaseStart: range.startDate,
      purchaseEnd: range.endDate,
    };
  }, [chartCustomPeriodRange, chartPeriodPreset, overview.appliedFilters]);
  const chartOverviewQuery = useInstallmentsOverview(chartFilters);
  const chartEvolution = chartOverviewQuery.data?.charts.monthlyCommitmentEvolution ?? [];
  const shouldShowCustomPeriodInput = chartPeriodPreset === "custom";

  const handleChartPresetChange = (preset: InstallmentsChartPeriodPreset) => {
    setChartPeriodPreset(preset);

    if (preset === "custom" && !chartCustomPeriodRange) {
      setChartCustomPeriodRange({
        startDate: overview.appliedFilters.purchaseStart ?? defaultChartRange.startDate,
        endDate: overview.appliedFilters.purchaseEnd ?? defaultChartRange.endDate,
      });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5 xl:col-span-2">
        <div className="mb-4 space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Evolucao mensal do compromisso</h2>
            <p className="text-sm text-muted-foreground">Comparativo mensal com filtro proprio apenas para este grafico.</p>
          </div>
          <div className={shouldShowCustomPeriodInput ? "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "grid grid-cols-1"}>
            <Select value={chartPeriodPreset} onValueChange={(value) => handleChartPresetChange(value as InstallmentsChartPeriodPreset)}>
              <SelectTrigger
                data-testid="installments-chart-period-preset-trigger"
                className="h-11 rounded-xl border-border/60 bg-secondary/35"
              >
                <SelectValue placeholder="Proximos 6 meses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next_6_months">Proximos 6 meses</SelectItem>
                <SelectItem value="current_year">Ano atual</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {shouldShowCustomPeriodInput ? (
              <DateRangePickerInput
                startValue={chartFilters.purchaseStart}
                endValue={chartFilters.purchaseEnd}
                onChange={({ startValue, endValue }) => {
                  if (!startValue || !endValue) {
                    return;
                  }

                  setChartCustomPeriodRange({
                    startDate: startValue,
                    endDate: endValue,
                  });
                }}
                className="h-11"
                placeholder="Selecione a competencia inicial e final"
              />
            ) : null}
          </div>
        </div>

        {chartOverviewQuery.isLoading ? (
          <div className="rounded-xl border border-border/30 bg-secondary/20 p-4 text-sm text-muted-foreground">
            Carregando comparativo mensal...
          </div>
        ) : !chartEvolution.length ? (
          <div className="rounded-xl border border-border/30 bg-secondary/20 p-4 text-sm text-muted-foreground">
            Nenhuma projecao disponivel para os filtros atuais.
          </div>
        ) : (
          <ChartContainer config={evolutionConfig} className="h-[260px] w-full">
            <AreaChart data={chartEvolution}>
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

      <div className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5">
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
                        <div className="flex min-w-[9rem] items-center justify-between gap-3">
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

      <div className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5 xl:col-span-3">
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
