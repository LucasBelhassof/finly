import { CalendarIcon } from "lucide-react";

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
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-11 w-full justify-between rounded-xl border-border/60 bg-secondary/35 px-3 text-left font-normal text-foreground hover:bg-secondary/45",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value ? formatDateOnly(value) : placeholder}</span>
          <CalendarIcon size={16} className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-2xl border-border/60 bg-card p-2">
        <Calendar
          mode="single"
          selected={parseDateOnly(value)}
          onSelect={(date) => {
            if (date) {
              onChange(toDateKey(date));
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
