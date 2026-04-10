import { CalendarRange } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatDateRangeLabel,
  getLocalDateKey,
  isValidCustomRange,
  parseLocalDateKey,
} from "@/lib/transactions-date-filter";
import { cn } from "@/lib/utils";

import type { TransactionsDateFilterPreset, TransactionsDateRange } from "@/lib/transactions-date-filter";

const presetOptions: Array<{ label: string; value: Exclude<TransactionsDateFilterPreset, "custom"> }> = [
  { label: "Semana", value: "week" },
  { label: "15 dias", value: "fifteen_days" },
  { label: "Mes", value: "month" },
  { label: "Ano", value: "year" },
];

type TransactionsDateFilterProps = {
  preset: TransactionsDateFilterPreset;
  range: TransactionsDateRange;
  onApplyCustomRange: (range: TransactionsDateRange) => void;
  onSelectPreset: (preset: Exclude<TransactionsDateFilterPreset, "custom">) => void;
};

function rangeToCalendarValue(range: TransactionsDateRange): DateRange | undefined {
  if (!isValidCustomRange(range)) {
    return undefined;
  }

  return {
    from: parseLocalDateKey(range.startDate),
    to: parseLocalDateKey(range.endDate),
  };
}

function sortRangeBoundary(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? { from: left, to: right } : { from: right, to: left };
}

function dateRangeToFilterRange(range: DateRange | undefined): TransactionsDateRange | null {
  if (!range?.from || !range?.to) {
    return null;
  }

  return {
    startDate: getLocalDateKey(range.from),
    endDate: getLocalDateKey(range.to),
  };
}

export default function TransactionsDateFilter({
  preset,
  range,
  onApplyCustomRange,
  onSelectPreset,
}: TransactionsDateFilterProps) {
  const [open, setOpen] = useState(false);
  const [draftAnchorDate, setDraftAnchorDate] = useState<Date | undefined>();
  const [draftHoverDate, setDraftHoverDate] = useState<Date | undefined>();
  const [draftCommittedRange, setDraftCommittedRange] = useState<DateRange | undefined>(rangeToCalendarValue(range));

  useEffect(() => {
    if (!open) {
      setDraftAnchorDate(undefined);
      setDraftHoverDate(undefined);
      setDraftCommittedRange(rangeToCalendarValue(range));
    }
  }, [open, range]);

  const previewRange = useMemo(() => {
    if (draftCommittedRange?.from && draftCommittedRange?.to) {
      return draftCommittedRange;
    }

    if (draftAnchorDate && draftHoverDate) {
      return sortRangeBoundary(draftAnchorDate, draftHoverDate);
    }

    if (draftAnchorDate) {
      return {
        from: draftAnchorDate,
        to: draftAnchorDate,
      };
    }

    return undefined;
  }, [draftAnchorDate, draftCommittedRange, draftHoverDate]);

  const customLabel = formatDateRangeLabel(range, preset);
  const draftRange = dateRangeToFilterRange(draftCommittedRange);
  const isValidRange = draftRange ? isValidCustomRange(draftRange) : false;

  const handleDayClick = (day: Date) => {
    if (draftCommittedRange?.from && draftCommittedRange?.to) {
      setDraftCommittedRange(undefined);
      setDraftAnchorDate(day);
      setDraftHoverDate(undefined);
      return;
    }

    if (!draftAnchorDate) {
      setDraftAnchorDate(day);
      setDraftHoverDate(undefined);
      return;
    }

    const nextRange = sortRangeBoundary(draftAnchorDate, day);
    setDraftCommittedRange(nextRange);
    setDraftAnchorDate(undefined);
    setDraftHoverDate(undefined);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presetOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelectPreset(option.value)}
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm transition-colors",
            preset === option.value ? "bg-primary/15 text-primary" : "bg-secondary/50 text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "rounded-xl border-border/60 bg-secondary/35",
              preset === "custom" && "border-primary/40 bg-primary/10 text-primary",
            )}
          >
            <CalendarRange size={14} />
            {preset === "custom" ? customLabel : "Período"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[326px] rounded-2xl border-border/60 bg-card p-3">
          <div className="space-y-3">
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium text-foreground">Período Personalizado</p>
              <p className="text-xs text-muted-foreground">
                {draftCommittedRange?.from && draftCommittedRange?.to
                  ? "Intervalo pronto para aplicar."
                  : draftAnchorDate
                    ? "Selecione a data final."
                    : "Clique na data inicial do intervalo."}
              </p>
            </div>

            <div className="mx-auto w-[286px] rounded-2xl border border-border/50 bg-secondary/20 p-1">
              <Calendar
                mode="range"
                selected={previewRange}
                defaultMonth={draftCommittedRange?.from ?? parseLocalDateKey(range.startDate)}
                onDayClick={(day) => handleDayClick(day)}
                onDayMouseEnter={(day) => {
                  if (draftAnchorDate && !draftCommittedRange) {
                    setDraftHoverDate(day);
                  }
                }}
                onDayMouseLeave={() => {
                  if (draftAnchorDate && !draftCommittedRange) {
                    setDraftHoverDate(undefined);
                  }
                }}
                modifiers={{
                  range_anchor: draftAnchorDate ? [draftAnchorDate] : [],
                  range_preview_start: previewRange?.from ? [previewRange.from] : [],
                  range_preview_end: previewRange?.to ? [previewRange.to] : [],
                }}
                modifiersClassNames={{
                  range_anchor: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  range_preview_start:
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-l-md",
                  range_preview_end:
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-r-md",
                }}
                className="mx-auto w-fit p-0.5"
                classNames={{
                  months: "justify-center",
                  month: "space-y-1.5",
                  caption: "relative flex items-center justify-center py-1",
                  caption_label: "text-sm font-semibold",
                  nav_button: "h-5.5 w-5.5 rounded-md border border-border/50 bg-transparent p-0 opacity-80 hover:opacity-100",
                  table: "mx-auto w-auto border-collapse",
                  head_row: "flex justify-center",
                  head_cell: "w-[30px] rounded-md text-[0.72rem] font-normal text-muted-foreground",
                  row: "mt-1 flex w-full justify-center",
                  cell: "relative h-[30px] w-[30px] p-0 text-center text-sm focus-within:relative focus-within:z-20",
                  day: "h-[30px] w-[30px] rounded-md p-0 text-[0.92rem] font-normal hover:bg-primary/10 hover:text-foreground aria-selected:opacity-100",
                  day_range_middle: "aria-selected:bg-primary/15 aria-selected:text-foreground",
                }}
              />
            </div>

            <div className="mx-auto w-[286px] rounded-xl border border-border/50 bg-secondary/20 px-3 py-2 text-center">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Intervalo</p>
              <p className="mt-1 text-sm text-foreground">
                {draftRange ? formatDateRangeLabel(draftRange, "custom") : "Selecione um intervalo no calendario."}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!isValidRange || !draftRange}
                onClick={() => {
                  if (!draftRange) {
                    return;
                  }

                  onApplyCustomRange(draftRange);
                  setOpen(false);
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
