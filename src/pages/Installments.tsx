import { useMemo, useState } from "react";

import InstallmentsCharts from "@/components/installments/InstallmentsCharts";
import InstallmentsFilters from "@/components/installments/InstallmentsFilters";
import { formatCurrency, formatMonthKey } from "@/components/installments/formatters";
import InstallmentsInsights from "@/components/installments/InstallmentsInsights";
import InstallmentsSummaryCards from "@/components/installments/InstallmentsSummaryCards";
import InstallmentsTable from "@/components/installments/InstallmentsTable";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInstallmentsOverview } from "@/hooks/use-installments";
import type { InstallmentOverviewItem, InstallmentsOverviewFilters } from "@/types/api";

const defaultFilters: InstallmentsOverviewFilters = {
  cardId: "all",
  categoryId: "all",
  status: "all",
  installmentAmountMin: null,
  installmentAmountMax: null,
  purchaseStart: null,
  purchaseEnd: null,
  sortBy: "smart",
  sortOrder: "desc",
};

function InstallmentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass-card rounded-2xl border border-border/40 p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="glass-card rounded-2xl border border-border/40 p-4">
        <Skeleton className="h-28 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl xl:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl xl:col-span-3" />
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

function buildCsv(filters: InstallmentsOverviewFilters, items: InstallmentOverviewItem[]) {
  const header = [
    "description",
    "card_name",
    "category",
    "purchase_date",
    "total_amount",
    "installment_amount",
    "current_installment",
    "installment_count",
    "remaining_installments",
    "remaining_balance",
    "next_due_date",
    "status",
  ];

  const rows = items.map((item) => [
    item.description,
    item.cardName,
    item.category,
    item.purchaseDate,
    item.totalAmount.toFixed(2),
    item.installmentAmount.toFixed(2),
    String(item.currentInstallment),
    String(item.installmentCount),
    String(item.remainingInstallments),
    item.remainingBalance.toFixed(2),
    item.nextDueDate ?? "",
    item.status,
  ]);

  const content = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filterSuffix = [filters.cardId, filters.categoryId, filters.status].join("-");

  link.href = url;
  link.download = `parcelamentos-${filterSuffix}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function InstallmentsPage() {
  const [filters, setFilters] = useState<InstallmentsOverviewFilters>(defaultFilters);
  const installmentsQuery = useInstallmentsOverview(filters);
  const overview = installmentsQuery.data;
  const next3Months = useMemo(() => overview?.charts.next3MonthsProjection ?? [], [overview]);

  if (installmentsQuery.isLoading) {
    return (
      <AppShell title="Parcelamentos" description="Acompanhe compras parceladas e compromissos futuros">
        <InstallmentsSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell title="Parcelamentos" description="Acompanhe compras parceladas e compromissos futuros">
      {overview ? (
        <>
          <InstallmentsSummaryCards overview={overview} />

          <InstallmentsFilters
            filters={filters}
            overview={overview}
            onChange={setFilters}
            onExportCsv={() => buildCsv(filters, overview.items)}
          />

          <InstallmentsInsights overview={overview} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {next3Months.map((item) => (
              <div key={item.month} className="glass-card rounded-2xl border border-border/40 p-5">
                <p className="text-sm text-muted-foreground">{formatMonthKey(item.month)}</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{formatCurrency(item.amount)}</p>
              </div>
            ))}
          </div>

          {overview.items.length ? (
            <>
              <InstallmentsCharts overview={overview} />
              <InstallmentsTable items={overview.items} />
            </>
          ) : (
            <div className="glass-card rounded-2xl border border-border/40 p-8 text-center">
              <h2 className="text-lg font-semibold text-foreground">Nenhum parcelamento encontrado</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Ajuste os filtros ou revise as transacoes de cartao parceladas para visualizar dados nesta tela.
              </p>
            </div>
          )}
        </>
      ) : installmentsQuery.isError ? (
        <div className="glass-card rounded-2xl border border-border/40 p-8 text-center">
          <h2 className="text-lg font-semibold text-foreground">Nao foi possivel carregar os parcelamentos</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {installmentsQuery.error instanceof Error ? installmentsQuery.error.message : "Tente novamente em instantes."}
          </p>
          <Button className="mt-4 rounded-xl" onClick={() => void installmentsQuery.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
    </AppShell>
  );
}
