import { CalendarIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseDateOnly(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function toDateKey(date: Date | undefined) {
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined) {
  if (!start && !end) {
    return "";
  }

  if (start && end) {
    return `${formatDateOnly(start)} - ${formatDateOnly(end)}`;
  }

  return formatDateOnly(start ?? end);
}

function sortRangeBoundary(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? { from: left, to: right } : { from: right, to: left };
}

function buildCalendarClassNames() {
  return {
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
    day: "h-[30px] w-[30px] rounded-md p-0 text-[0.92rem] font-normal text-foreground hover:bg-primary/10 hover:text-foreground focus:text-foreground aria-selected:opacity-100",
    day_range_middle: "aria-selected:bg-primary/15 aria-selected:text-foreground",
  };
}

interface DatePickerInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePickerInput({
  value,
  onChange,
  placeholder = "Selecione uma data",
  className,
  disabled,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState<string>(value);

  useEffect(() => {
    if (!open) {
      setDraftValue(value);
    }
  }, [open, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between rounded-xl border-border/60 bg-secondary/35 px-3 text-left font-normal text-foreground hover:bg-secondary/45 hover:text-foreground",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value ? formatDateOnly(value) : placeholder}</span>
          <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[326px] rounded-2xl border-border/60 bg-card p-3">
        <div className="space-y-3">
          <div className="space-y-1 text-center">
            <p className="text-sm font-medium text-foreground">Selecionar data</p>
            <p className="text-xs text-muted-foreground">
              {draftValue ? "Data pronta para aplicar." : "Clique na data desejada no calendario."}
            </p>
          </div>

          <div className="mx-auto w-[286px] rounded-2xl border border-border/50 bg-secondary/20 p-1">
            <Calendar
              mode="single"
              selected={parseDateOnly(draftValue)}
              defaultMonth={parseDateOnly(draftValue || value)}
              onSelect={(date) => {
                if (date) {
                  setDraftValue(toDateKey(date));
                }
              }}
              initialFocus
              className="mx-auto w-fit p-0.5"
              classNames={buildCalendarClassNames()}
            />
          </div>

          <div className="mx-auto w-[286px] rounded-xl border border-border/50 bg-secondary/20 px-3 py-2 text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Data</p>
            <p className="mt-1 text-sm text-foreground">{draftValue ? formatDateOnly(draftValue) : "Selecione uma data no calendario."}</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!draftValue}
              onClick={() => {
                if (!draftValue) {
                  return;
                }

                onChange(draftValue);
                setOpen(false);
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DateRangePickerInputProps {
  startValue: string | null;
  endValue: string | null;
  onChange: (range: { startValue: string | null; endValue: string | null }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateRangePickerInput({
  startValue,
  endValue,
  onChange,
  placeholder = "Selecione um período",
  className,
  disabled,
}: DateRangePickerInputProps) {
  const [open, setOpen] = useState(false);
  const initialRange = useMemo<DateRange | undefined>(() => {
    const from = parseDateOnly(startValue ?? undefined);
    const to = parseDateOnly(endValue ?? undefined);

    if (!from && !to) {
      return undefined;
    }

    return {
      from,
      to,
    };
  }, [endValue, startValue]);
  const [draftAnchorDate, setDraftAnchorDate] = useState<Date | undefined>();
  const [draftHoverDate, setDraftHoverDate] = useState<Date | undefined>();
  const [draftCommittedRange, setDraftCommittedRange] = useState<DateRange | undefined>(initialRange);

  useEffect(() => {
    if (!open) {
      setDraftAnchorDate(undefined);
      setDraftHoverDate(undefined);
      setDraftCommittedRange(initialRange);
    }
  }, [initialRange, open]);

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between rounded-xl border-border/60 bg-secondary/35 px-3 text-left font-normal text-foreground hover:bg-secondary/45 hover:text-foreground",
            !startValue && !endValue && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{formatDateRange(startValue, endValue) || placeholder}</span>
          <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[326px] rounded-2xl border-border/60 bg-card p-3">
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
              defaultMonth={draftCommittedRange?.from ?? parseDateOnly(startValue ?? undefined)}
              onDayClick={handleDayClick}
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
              initialFocus
              className="mx-auto w-fit p-0.5"
              classNames={buildCalendarClassNames()}
            />
          </div>

          <div className="mx-auto w-[286px] rounded-xl border border-border/50 bg-secondary/20 px-3 py-2 text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Intervalo</p>
            <p className="mt-1 text-sm text-foreground">
              {formatDateRange(
                draftCommittedRange?.from ? toDateKey(draftCommittedRange.from) : startValue,
                draftCommittedRange?.to ? toDateKey(draftCommittedRange.to) : endValue,
              ) || "Selecione um intervalo no calendario."}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!draftCommittedRange?.from || !draftCommittedRange?.to}
              onClick={() => {
                if (!draftCommittedRange?.from || !draftCommittedRange?.to) {
                  return;
                }

                onChange({
                  startValue: toDateKey(draftCommittedRange.from) || null,
                  endValue: toDateKey(draftCommittedRange.to) || null,
                });
                setOpen(false);
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
