import { useMemo } from "react";

import { TRANSACTIONS_YEAR_SELECTION } from "@/lib/transactions-date-filter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const monthOptions = [
  { label: "Jan", value: 0 },
  { label: "Fev", value: 1 },
  { label: "Mar", value: 2 },
  { label: "Abr", value: 3 },
  { label: "Mai", value: 4 },
  { label: "Jun", value: 5 },
  { label: "Jul", value: 6 },
  { label: "Ago", value: 7 },
  { label: "Set", value: 8 },
  { label: "Out", value: 9 },
  { label: "Nov", value: 10 },
  { label: "Dez", value: 11 },
  { label: "Ano", value: TRANSACTIONS_YEAR_SELECTION },
] as const;

type TransactionsMonthYearFilterProps = {
  selectedMonthIndex: number;
  selectedYear: number;
  onMonthChange: (monthIndex: number) => void;
  onYearChange: (year: number) => void;
};

export default function TransactionsMonthYearFilter({
  selectedMonthIndex,
  selectedYear,
  onMonthChange,
  onYearChange,
}: TransactionsMonthYearFilterProps) {
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = Math.min(currentYear - 10, selectedYear);
    const endYear = Math.max(currentYear + 1, selectedYear);

    return Array.from({ length: endYear - startYear + 1 }, (_, index) => endYear - index);
  }, [selectedYear]);

  return (
    <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row xl:items-end xl:gap-2">
      <div>
        <div className="flex flex-wrap gap-2">
          {monthOptions.map((month) => (
            <button
              key={month.value}
              type="button"
              onClick={() => onMonthChange(month.value)}
              className={cn(
                "min-h-9 rounded-xl px-2.5 py-1.5 text-center text-xs transition-colors sm:min-h-10 sm:px-3 sm:py-2",
                selectedMonthIndex === month.value
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {month.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {/* <label htmlFor="transactions-filter-year" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Ano
        </label> */}
        <Select value={String(selectedYear)} onValueChange={(value) => onYearChange(Number(value))}>
          <SelectTrigger id="transactions-filter-year" className="h-11 rounded-xl border-border/60 bg-secondary/35">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
