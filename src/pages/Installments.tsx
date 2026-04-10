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
import { resolveInstallmentsPeriodRange } from "@/lib/installments-period-filter";
import type { InstallmentOverviewItem, InstallmentsOverviewFilters } from "@/types/api";
import type { InstallmentsPeriodPreset, InstallmentsPeriodRange } from "@/lib/installments-period-filter";

const defaultPeriodPreset: InstallmentsPeriodPreset = "current_month";
const defaultPeriodRange = resolveInstallmentsPeriodRange(defaultPeriodPreset);
const defaultFilters: InstallmentsOverviewFilters = {
  cardId: "all",
  categoryId: "all",
  status: "all",
  installmentAmountMin: null,
  installmentAmountMax: null,
  installmentCountMode: "all",
  installmentCountValue: null,
  purchaseStart: defaultPeriodRange.startDate,
  purchaseEnd: defaultPeriodRange.endDate,
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
    "installment_month",
    "installment_due_date",
    "total_amount",
    "installment_amount",
    "display_installment_number",
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
    item.installmentMonth ?? "",
    item.installmentDueDate ?? "",
    item.totalAmount.toFixed(2),
    item.installmentAmount.toFixed(2),
    String(item.displayInstallmentNumber),
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
  const [draftFilters, setDraftFilters] = useState<InstallmentsOverviewFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<InstallmentsOverviewFilters>(defaultFilters);
  const [draftPeriodPreset, setDraftPeriodPreset] = useState<InstallmentsPeriodPreset>(defaultPeriodPreset);
  const [customPeriodRange, setCustomPeriodRange] = useState<InstallmentsPeriodRange | null>(null);
  const installmentsQuery = useInstallmentsOverview(appliedFilters);
  const overview = installmentsQuery.data;
  const next3Months = useMemo(() => overview?.charts.next3MonthsProjection ?? [], [overview]);

  const handlePeriodPresetChange = (preset: InstallmentsPeriodPreset) => {
    setDraftPeriodPreset(preset);

    if (preset === "custom") {
      setDraftFilters((current) => ({
        ...current,
        purchaseStart: customPeriodRange?.startDate ?? current.purchaseStart,
        purchaseEnd: customPeriodRange?.endDate ?? current.purchaseEnd,
      }));
      return;
    }

    const nextRange = resolveInstallmentsPeriodRange(preset);
    setDraftFilters((current) => ({
      ...current,
      purchaseStart: nextRange.startDate,
      purchaseEnd: nextRange.endDate,
    }));
  };

  const handleCustomPeriodChange = (range: InstallmentsPeriodRange) => {
    setCustomPeriodRange(range);
    setDraftPeriodPreset("custom");
    setDraftFilters((current) => {
      const nextFilters = {
        ...current,
        purchaseStart: range.startDate,
        purchaseEnd: range.endDate,
      };

      setAppliedFilters(nextFilters);
      return nextFilters;
    });
  };

  const handleFiltersChange = (nextFilters: InstallmentsOverviewFilters) => {
    setDraftFilters(nextFilters);
  };

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
  };

  const handleResetFilters = () => {
    setDraftPeriodPreset(defaultPeriodPreset);
    setDraftFilters({
      ...defaultFilters,
    });
    setAppliedFilters({
      ...defaultFilters,
    });
  };

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
            filters={draftFilters}
            periodPreset={draftPeriodPreset}
            overview={overview}
            onChange={handleFiltersChange}
            onPeriodPresetChange={handlePeriodPresetChange}
            onCustomPeriodChange={handleCustomPeriodChange}
            onApplyFilters={handleApplyFilters}
            onResetFilters={handleResetFilters}
            onExportCsv={() => buildCsv(appliedFilters, overview.items)}
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
                Ajuste o período das parcelas ou revise as transacoes de cartao parceladas para visualizar dados nesta tela.
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
