import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import AppShell from "@/components/AppShell";
import MetricInfoTooltip from "@/components/MetricInfoTooltip";
import InstallmentsCharts from "@/components/installments/InstallmentsCharts";
import InstallmentsFilters from "@/components/installments/InstallmentsFilters";
import { formatCurrency, formatMonthKey } from "@/components/installments/formatters";
import InstallmentsInsights from "@/components/installments/InstallmentsInsights";
import InstallmentsSummaryCards from "@/components/installments/InstallmentsSummaryCards";
import InstallmentsTable from "@/components/installments/InstallmentsTable";
import TransactionsDateFilter from "@/components/transactions/TransactionsDateFilter";
import TransactionsMonthYearFilter from "@/components/transactions/TransactionsMonthYearFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useInstallmentsOverview } from "@/hooks/use-installments";
import { useUrlPeriodFilter } from "@/hooks/use-url-period-filter";
import {
  getCurrentMonthSelection,
  resolveMonthYearRange,
  TRANSACTIONS_YEAR_SELECTION,
} from "@/lib/transactions-date-filter";
import type { InstallmentOverviewItem, InstallmentsOverviewFilters } from "@/types/api";

const FILTER_QUERY_PARAM_KEYS = {
  categoryId: "categoryId",
  search: "search",
} as const;

function createDefaultFilters(dateRange: { startDate: string; endDate: string }): InstallmentsOverviewFilters {
  return {
    cardId: "all",
    categoryId: "all",
    search: "",
    status: "all",
    installmentAmountMin: null,
    installmentAmountMax: null,
    installmentCountMode: "all",
    installmentCountValue: null,
    purchaseStart: dateRange.startDate,
    purchaseEnd: dateRange.endDate,
    sortBy: "smart",
    sortOrder: "desc",
  };
}

function formatAppliedRangeLabel(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) {
    return "";
  }

  return `${startDate.split("-").reverse().join("/")} - ${endDate.split("-").reverse().join("/")}`;
}

function mergeImmediateFilters(
  filters: InstallmentsOverviewFilters,
  immediateFilters: Pick<InstallmentsOverviewFilters, "categoryId" | "search" | "purchaseStart" | "purchaseEnd">,
) {
  if (
    filters.categoryId === immediateFilters.categoryId &&
    filters.search === immediateFilters.search &&
    filters.purchaseStart === immediateFilters.purchaseStart &&
    filters.purchaseEnd === immediateFilters.purchaseEnd
  ) {
    return filters;
  }

  return {
    ...filters,
    ...immediateFilters,
  };
}

function updateUrlFilterParams(
  searchParams: URLSearchParams,
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  updates: Partial<Record<(typeof FILTER_QUERY_PARAM_KEYS)[keyof typeof FILTER_QUERY_PARAM_KEYS], string | null>>,
) {
  const nextSearchParams = new URLSearchParams(searchParams);

  Object.entries(updates).forEach(([key, value]) => {
    if (!value) {
      nextSearchParams.delete(key);
      return;
    }

    nextSearchParams.set(key, value);
  });

  setSearchParams(nextSearchParams, { replace: true });
}

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
  const currentSelection = getCurrentMonthSelection();
  const defaultDateRange = resolveMonthYearRange(currentSelection.monthIndex, currentSelection.year);
  const defaultFilters = useMemo(() => createDefaultFilters(defaultDateRange), [defaultDateRange.endDate, defaultDateRange.startDate]);
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    selectedMonthIndex,
    selectedYear,
    datePreset,
    dateRange,
    handleMonthChange,
    handleYearChange,
    handlePresetChange,
    handleCustomRangeApply,
  } = useUrlPeriodFilter({
    selectedMonthIndex: currentSelection.monthIndex,
    selectedYear: currentSelection.year,
    datePreset: currentSelection.monthIndex === TRANSACTIONS_YEAR_SELECTION ? "year" : "month",
    dateRange: defaultDateRange,
  });
  const selectedCategoryId = searchParams.get(FILTER_QUERY_PARAM_KEYS.categoryId)?.trim() || "all";
  const search = searchParams.get(FILTER_QUERY_PARAM_KEYS.search) ?? "";
  const immediateFilters = useMemo(
    () => ({
      categoryId: selectedCategoryId,
      search,
      purchaseStart: dateRange.startDate,
      purchaseEnd: dateRange.endDate,
    }),
    [dateRange.endDate, dateRange.startDate, search, selectedCategoryId],
  );
  const [draftFilters, setDraftFilters] = useState<InstallmentsOverviewFilters>({
    ...createDefaultFilters(defaultDateRange),
    ...immediateFilters,
  });
  const [appliedFilters, setAppliedFilters] = useState<InstallmentsOverviewFilters>({
    ...createDefaultFilters(defaultDateRange),
    ...immediateFilters,
  });
  const installmentsQuery = useInstallmentsOverview(appliedFilters);
  const overview = installmentsQuery.data;
  const next3Months = useMemo(() => overview?.charts.next3MonthsProjection ?? [], [overview]);
  const appliedRangeLabel = formatAppliedRangeLabel(appliedFilters.purchaseStart, appliedFilters.purchaseEnd);

  useEffect(() => {
    setDraftFilters((current) => mergeImmediateFilters(current, immediateFilters));
    setAppliedFilters((current) => mergeImmediateFilters(current, immediateFilters));
  }, [immediateFilters]);

  const handleFiltersChange = (nextFilters: InstallmentsOverviewFilters) => {
    setDraftFilters(nextFilters);
  };

  const handleApplyFilters = (nextFilters: InstallmentsOverviewFilters) => {
    setAppliedFilters(nextFilters);
  };

  const handleResetFilters = () => {
    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set("month", String(currentSelection.monthIndex));
    nextSearchParams.set("year", String(currentSelection.year));
    nextSearchParams.set("preset", "month");
    nextSearchParams.set("startDate", defaultDateRange.startDate);
    nextSearchParams.set("endDate", defaultDateRange.endDate);

    setSearchParams(nextSearchParams, { replace: true });
    setDraftFilters({
      ...defaultFilters,
    });
    setAppliedFilters({
      ...defaultFilters,
    });
  };

  const headerContent = (
    <section data-tour-id="installments-filters" className="glass-card rounded-[28px] border border-border/40 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <TransactionsMonthYearFilter
            selectedMonthIndex={selectedMonthIndex}
            selectedYear={selectedYear}
            onMonthChange={handleMonthChange}
            onYearChange={handleYearChange}
          />

          <TransactionsDateFilter
            preset={datePreset}
            range={dateRange}
            onSelectPreset={handlePresetChange}
            onApplyCustomRange={handleCustomRangeApply}
            showPresetButtons={false}
          />

          <Select
            value={selectedCategoryId}
            onValueChange={(value) =>
              updateUrlFilterParams(searchParams, setSearchParams, {
                [FILTER_QUERY_PARAM_KEYS.categoryId]: value === "all" ? null : value,
              })
            }
          >
            <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:flex-1">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {overview?.filterOptions.categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-full xl:max-w-sm xl:flex-1">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) =>
                updateUrlFilterParams(searchParams, setSearchParams, {
                  [FILTER_QUERY_PARAM_KEYS.search]: event.target.value.trim() || null,
                })
              }
              placeholder="Buscar compra, cartões ou categoria..."
              className="h-11 rounded-xl border-border/60 bg-secondary/35 pl-11"
            />
          </div>
        </div>

        <InstallmentsFilters
          filters={draftFilters}
          appliedRangeLabel={appliedRangeLabel}
          overview={overview}
          onChange={handleFiltersChange}
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetFilters}
          onExportCsv={() => buildCsv(appliedFilters, overview?.items ?? [])}
        />
      </div>
    </section>
  );

  return (
    <AppShell
      title="Parcelamentos"
      description="Acompanhe compras parceladas e compromissos futuros"
      headerContent={headerContent}
    >
      {installmentsQuery.isLoading ? (
        <InstallmentsSkeleton />
      ) : overview ? (
        <>
          <div data-tour-id="installments-summary">
            <InstallmentsSummaryCards overview={overview} />
          </div>

          <div data-tour-id="installments-insights">
            <InstallmentsInsights overview={overview} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {next3Months.map((item) => (
              <div key={item.month} className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">{formatMonthKey(item.month)}</p>
                  <MetricInfoTooltip content="Soma das parcelas projetadas para vencer neste mÃªs, considerando os parcelamentos filtrados." />
                </div>
                <p className="mt-2 text-xl font-semibold text-foreground">{formatCurrency(item.amount)}</p>
              </div>
            ))}
          </div>

          {overview.items.length ? (
            <>
              <InstallmentsCharts overview={overview} />
              <div data-tour-id="installments-table">
                <InstallmentsTable items={overview.items} />
              </div>
            </>
          ) : (
            <div className="glass-card rounded-2xl border border-border/40 p-6 text-center sm:p-8">
              <h2 className="text-lg font-semibold text-foreground">Nenhum parcelamento encontrado</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Ajuste o período das parcelas ou revise as transações de cartões parceladas para visualizar dados nesta tela.
              </p>
            </div>
          )}
        </>
      ) : installmentsQuery.isError ? (
        <div className="glass-card rounded-2xl border border-border/40 p-6 text-center sm:p-8">
          <h2 className="text-lg font-semibold text-foreground">Não foi possível carregar os parcelamentos</h2>
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
