import { ChevronDown, ChevronUp, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import TransactionsDateFilter from "@/components/transactions/TransactionsDateFilter";
import TransactionsMonthYearFilter from "@/components/transactions/TransactionsMonthYearFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TransactionsDateFilterPreset, TransactionsDateRange } from "@/lib/transactions-date-filter";
import { cn } from "@/lib/utils";

type FilterSelectOption = {
  value: string;
  label: string;
};

interface FilterSelectConfig {
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  triggerTestId?: string;
}

interface PageFiltersPanelProps {
  selectedMonthIndex: number;
  selectedYear: number;
  datePreset: TransactionsDateFilterPreset;
  dateRange: TransactionsDateRange;
  accountFilter?: FilterSelectConfig;
  categoryFilter?: FilterSelectConfig;
  searchValue?: string;
  onMonthChange: (monthIndex: number) => void;
  onYearChange: (year: number) => void;
  onSelectPreset: (preset: Exclude<TransactionsDateFilterPreset, "custom">) => void;
  onApplyCustomRange: (range: TransactionsDateRange) => void;
  onSearchChange?: (value: string) => void;
  onResetFilters?: () => void;
  primaryFilters?: ReactNode;
  inlineFilters?: ReactNode;
  searchPlaceholder?: string;
  searchActions?: ReactNode;
  periodLabel?: string;
  advancedFilters?: ReactNode;
  activeAdvancedCount?: number;
  footerActions?: ReactNode;
  className?: string;
  dataTourId?: string;
}

export default function PageFiltersPanel({
  selectedMonthIndex,
  selectedYear,
  datePreset,
  dateRange,
  accountFilter,
  categoryFilter,
  searchValue,
  onMonthChange,
  onYearChange,
  onSelectPreset,
  onApplyCustomRange,
  onSearchChange,
  onResetFilters,
  primaryFilters,
  inlineFilters,
  searchPlaceholder = "Buscar...",
  searchActions,
  periodLabel,
  advancedFilters,
  activeAdvancedCount = 0,
  footerActions,
  className,
  dataTourId,
}: PageFiltersPanelProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const shouldRenderSearch = typeof searchValue === "string" && typeof onSearchChange === "function";
  const shouldRenderDefaultPrimaryFilters = !primaryFilters && (accountFilter || categoryFilter);

  return (
    <section
      data-tour-id={dataTourId}
      className={cn("glass-card rounded-[28px] border border-border/40 p-4", className)}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
          <TransactionsMonthYearFilter
            selectedMonthIndex={selectedMonthIndex}
            selectedYear={selectedYear}
            onMonthChange={onMonthChange}
            onYearChange={onYearChange}
          />

          <TransactionsDateFilter
            preset={datePreset}
            range={dateRange}
            onSelectPreset={onSelectPreset}
            onApplyCustomRange={onApplyCustomRange}
            showPresetButtons={false}
          />

          {primaryFilters}

          {shouldRenderDefaultPrimaryFilters && accountFilter ? (
            <Select value={accountFilter.value} onValueChange={accountFilter.onChange}>
              <SelectTrigger
                data-testid={accountFilter.triggerTestId}
                className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:min-w-[220px] xl:flex-1"
              >
                <SelectValue placeholder={accountFilter.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {accountFilter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {shouldRenderDefaultPrimaryFilters && categoryFilter ? (
            <Select value={categoryFilter.value} onValueChange={categoryFilter.onChange}>
              <SelectTrigger
                data-testid={categoryFilter.triggerTestId}
                className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:min-w-[220px] xl:flex-1"
              >
                <SelectValue placeholder={categoryFilter.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {categoryFilter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          {shouldRenderSearch ? (
            <div className="relative flex-1">
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-11 rounded-xl border-border/60 bg-secondary/35 pl-11"
              />
            </div>
          ) : null}
          {inlineFilters}
          {searchActions ? <div className="grid grid-cols-3 gap-2 xl:flex xl:flex-wrap">{searchActions}</div> : null}
        </div>

        {advancedFilters && isAdvancedOpen ? <div className="w-full">{advancedFilters}</div> : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {periodLabel ? (
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{periodLabel}</div>
          ) : (
            <div />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {footerActions}
            {onResetFilters ? (
              <Button
                variant="ghost"
                className="rounded-xl px-3 text-destructive hover:bg-transparent hover:text-destructive/80"
                onClick={onResetFilters}
              >
                <RotateCcw size={14} />
                Limpar filtros
              </Button>
            ) : null}

            {advancedFilters ? (
              <Button
                variant="ghost"
                className="rounded-xl border-border/60 bg-secondary/35 px-3 hover:bg-primary/10 hover:text-primary"
                onClick={() => setIsAdvancedOpen((prev) => !prev)}
              >
                <SlidersHorizontal size={14} />
                Opções avançadas
                {!isAdvancedOpen && activeAdvancedCount > 0 ? (
                  <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {activeAdvancedCount}
                  </span>
                ) : null}
                {isAdvancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
