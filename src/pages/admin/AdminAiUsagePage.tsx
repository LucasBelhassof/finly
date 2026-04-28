import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePickerInput } from "@/components/ui/date-picker-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminAiUsage } from "@/hooks/use-admin";
import type { AdminAiUsageData } from "@/types/api";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});
const chartPalette = ["#0f766e", "#ea580c", "#2563eb", "#dc2626", "#65a30d", "#7c3aed"];

function formatSurfaceLabel(surface: string, operation: string) {
  const key = `${surface}:${operation}`;

  switch (key) {
    case "chat:reply":
      return "Resposta do chat";
    case "chat:title":
      return "Titulo de conversa";
    case "chat:summary":
      return "Resumo de chat";
    case "plans:draft":
      return "Rascunho de plano";
    case "plans:draft_revision":
      return "Revisao de rascunho";
    case "plans:link_suggestion":
      return "Sugestao de vinculo";
    case "plans:assessment":
      return "Avaliacao de plano";
    case "imports:category_suggestions":
      return "Sugestoes da importacao";
    default:
      return `${surface} / ${operation}`;
  }
}

function formatModelLabel(provider: string, model: string) {
  if (!provider && !model) {
    return "Nao informado";
  }

  if (!provider) {
    return model;
  }

  return model ? `${provider} / ${model}` : provider;
}

type ChartMeta = {
  label: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
};

function UsageTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; color?: string; payload?: Record<string, unknown> }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const meta = (payload[0]?.payload?.__meta ?? {}) as Record<string, ChartMeta>;
  const entries = payload
    .map((item) => {
      const dataKey = typeof item.dataKey === "string" ? item.dataKey : "";
      return {
        color: item.color ?? "#64748b",
        data: meta[dataKey],
      };
    })
    .filter((item) => item.data);

  if (!entries.length) {
    return null;
  }

  return (
    <div className="min-w-[270px] rounded-lg border border-border/60 bg-background px-3 py-2 shadow-xl">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="mt-2 space-y-3">
        {entries.map((item) => (
          <div key={item.data.label} className="rounded-md border border-border/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <p className="text-sm font-medium text-foreground">{item.data.label}</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Requisicoes</span>
              <span className="text-right font-medium text-foreground">{numberFormatter.format(item.data.requests)}</span>
              <span>Tokens entrada</span>
              <span className="text-right font-medium text-foreground">{numberFormatter.format(item.data.inputTokens)}</span>
              <span>Tokens saida</span>
              <span className="text-right font-medium text-foreground">{numberFormatter.format(item.data.outputTokens)}</span>
              <span>Tokens totais</span>
              <span className="text-right font-medium text-foreground">{numberFormatter.format(item.data.totalTokens)}</span>
              <span>Custo</span>
              <span className="text-right font-medium text-foreground">{usdFormatter.format(item.data.estimatedCostUsd)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildChartState(data: AdminAiUsageData | undefined) {
  const rows = data?.dailyByModel ?? [];
  const modelEntries = rows.reduce<Array<{ modelId: string; key: string; label: string; color: string }>>((accumulator, item) => {
    const modelId = `${item.provider}::${item.model}`;

    if (accumulator.some((entry) => entry.modelId === modelId)) {
      return accumulator;
    }

    accumulator.push({
      modelId,
      key: `model_${accumulator.length}`,
      label: formatModelLabel(item.provider, item.model),
      color: chartPalette[accumulator.length % chartPalette.length],
    });

    return accumulator;
  }, []);

  const entryByModelId = new Map(modelEntries.map((entry) => [entry.modelId, entry]));

  const groupedByDate = new Map<
    string,
    {
      date: string;
      __meta: Record<string, ChartMeta>;
      [key: string]: string | number | Record<string, ChartMeta>;
    }
  >();

  rows.forEach((item) => {
    const modelKey = `${item.provider}::${item.model}`;
    const chartEntry = entryByModelId.get(modelKey);

    if (!chartEntry) {
      return;
    }

    const entry = groupedByDate.get(item.date) ?? {
      date: item.date,
      __meta: {},
    };

    entry[chartEntry.key] = item.requests;
    entry.__meta[chartEntry.key] = {
      label: chartEntry.label,
      requests: item.requests,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      totalTokens: item.totalTokens,
      estimatedCostUsd: item.estimatedCostUsd,
    };

    groupedByDate.set(item.date, entry);
  });

  const chartData = Array.from(groupedByDate.values()).sort((left, right) => String(left.date).localeCompare(String(right.date)));

  return {
    chartData,
    modelEntries,
  };
}

export default function AdminAiUsagePage() {
  const [appliedRange, setAppliedRange] = useState<{ startValue: string | null; endValue: string | null }>({
    startValue: null,
    endValue: null,
  });
  const { data, isLoading, isError, error } = useAdminAiUsage(appliedRange.startValue ?? undefined, appliedRange.endValue ?? undefined);

  const { chartData, modelEntries } = useMemo(() => buildChartState(data), [data]);
  const cards = useMemo(
    () => [
      { label: "Requisicoes IA", value: numberFormatter.format(data?.summary.totalRequests ?? 0) },
      { label: "Tokens totais", value: numberFormatter.format(data?.summary.totalTokens ?? 0) },
      { label: "Custo estimado", value: usdFormatter.format(data?.summary.estimatedCostUsd ?? 0) },
      { label: "Falhas", value: numberFormatter.format(data?.summary.failedRequests ?? 0) },
    ],
    [data],
  );

  const hasPartialCoverage = (data?.summary.untrackedUsageRequests ?? 0) > 0;

  return (
    <AdminLayout
      title="Consumo de IA"
      description="Leitura operacional da IA por periodo, com foco em volume diario de requisicoes por modelo."
    >
      <Card>
        <CardHeader>
          <CardTitle>Periodo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="w-full lg:max-w-md">
            <DateRangePickerInput
              startValue={appliedRange.startValue}
              endValue={appliedRange.endValue}
              onChange={setAppliedRange}
              placeholder="Selecionar periodo"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const emptyRange = { startValue: null, endValue: null };
                setAppliedRange(emptyRange);
              }}
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasPartialCoverage ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Parte das requisicoes deste periodo nao trouxe tokens ou custo do provider. O tooltip e os totais refletem apenas o que foi rastreado.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{isLoading ? "..." : card.value}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-2">
          <CardTitle>Uso diario da IA</CardTitle>
          <p className="text-sm text-muted-foreground">
            Eixo X com os dias do periodo e eixo Y com o numero de requisicoes. Cada modelo aparece como uma linha separada.
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 8, right: 20, top: 12, bottom: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip content={<UsageTooltip />} />
                <Legend />
                {modelEntries.map((entry) => (
                  <Line
                    key={entry.key}
                    type="monotone"
                    dataKey={entry.key}
                    name={entry.label}
                    stroke={entry.color}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {!isLoading && chartData.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhum uso de IA encontrado no periodo.</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Uso por modelo</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Requisicoes</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.byModel ?? []).map((item) => (
                  <TableRow key={`${item.provider}:${item.model}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{formatModelLabel(item.provider, item.model)}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString("pt-BR") : "Sem uso recente"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{numberFormatter.format(item.requests)}</TableCell>
                    <TableCell>{numberFormatter.format(item.totalTokens)}</TableCell>
                    <TableCell>{usdFormatter.format(item.estimatedCostUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Serie agregada do periodo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.dailySeries ?? []).map((item) => (
              <div key={item.date} className="rounded-lg border border-border/60 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{item.date}</p>
                  <Badge variant={item.failures > 0 ? "destructive" : "outline"}>{item.failures} falhas</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {numberFormatter.format(item.requests)} requisicoes • {numberFormatter.format(item.totalTokens)} tokens •{" "}
                  {usdFormatter.format(item.estimatedCostUsd)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Uso por fluxo</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fluxo</TableHead>
                  <TableHead>Requisicoes</TableHead>
                  <TableHead>Falhas</TableHead>
                  <TableHead>Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.byOperation ?? []).map((item) => (
                  <TableRow key={`${item.surface}:${item.operation}`}>
                    <TableCell>{formatSurfaceLabel(item.surface, item.operation)}</TableCell>
                    <TableCell>{numberFormatter.format(item.requests)}</TableCell>
                    <TableCell>{numberFormatter.format(item.failures)}</TableCell>
                    <TableCell>{usdFormatter.format(item.estimatedCostUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Falhas recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.recentFailures ?? []).map((item, index) => (
              <div key={`${item.createdAt}-${index}`} className="rounded-lg border border-border/60 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{formatSurfaceLabel(item.surface, item.operation)}</p>
                  <Badge variant="destructive">{item.errorCode ?? "erro"}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatModelLabel(item.provider ?? "", item.model ?? "")} • {item.user?.name ?? "Usuario"} •{" "}
                  {new Date(item.createdAt).toLocaleString("pt-BR")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{item.errorMessage ?? "Falha sem detalhe adicional."}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data table de uso por usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Requisicoes</TableHead>
                  <TableHead>Sucessos</TableHead>
                  <TableHead>Falhas</TableHead>
                  <TableHead>Mensagens</TableHead>
                  <TableHead>Tokens entrada</TableHead>
                  <TableHead>Tokens saida</TableHead>
                  <TableHead>Tokens totais</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Ultimo uso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.userUsage ?? []).map((item) => (
                  <TableRow key={`user-usage-${String(item.id)}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{numberFormatter.format(item.requests)}</TableCell>
                    <TableCell>{numberFormatter.format(item.successfulRequests)}</TableCell>
                    <TableCell>{numberFormatter.format(item.failedRequests)}</TableCell>
                    <TableCell>{numberFormatter.format(item.assistantMessages)}</TableCell>
                    <TableCell>{numberFormatter.format(item.inputTokens)}</TableCell>
                    <TableCell>{numberFormatter.format(item.outputTokens)}</TableCell>
                    <TableCell>{numberFormatter.format(item.totalTokens)}</TableCell>
                    <TableCell>{usdFormatter.format(item.estimatedCostUsd)}</TableCell>
                    <TableCell>{item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString("pt-BR") : "Sem uso"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!isLoading && (data?.userUsage.length ?? 0) === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhum usuario com uso de IA no periodo.</p>
          ) : null}
        </CardContent>
      </Card>

      {isError ? (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            {error instanceof Error ? error.message : "Nao foi possivel carregar o consumo de IA."}
          </CardContent>
        </Card>
      ) : null}
    </AdminLayout>
  );
}
