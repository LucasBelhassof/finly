export type TransactionsDateFilterPreset = "week" | "fifteen_days" | "month" | "year" | "custom";

export type TransactionsDateRange = {
  startDate: string;
  endDate: string;
};

export type TransactionsMonthSelection = {
  monthIndex: number;
  year: number;
};

export const TRANSACTIONS_YEAR_SELECTION = 12;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function createLocalDate(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

export function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseLocalDateKey(value: string) {
  const [year, month, day] = String(value).split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error("Invalid date key.");
  }

  return createLocalDate(year, month - 1, day);
}

export function shiftDateKey(value: string, amountInDays: number) {
  const date = parseLocalDateKey(value);
  date.setDate(date.getDate() + amountInDays);
  return getLocalDateKey(date);
}

function getStartOfWeek(now: Date) {
  const currentDay = now.getDay();
  const offsetToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  const startOfWeek = createLocalDate(now.getFullYear(), now.getMonth(), now.getDate());
  startOfWeek.setDate(startOfWeek.getDate() + offsetToMonday);
  return startOfWeek;
}

export function resolvePresetRange(preset: TransactionsDateFilterPreset, now = new Date()): TransactionsDateRange {
  const today = getLocalDateKey(now);

  switch (preset) {
    case "week":
      {
        const startOfWeek = getStartOfWeek(now);

        return {
          startDate: getLocalDateKey(startOfWeek),
          endDate: getLocalDateKey(createLocalDate(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6)),
        };
      }
    case "fifteen_days":
      return {
        startDate: today,
        endDate: shiftDateKey(today, 14),
      };
    case "month":
      {
        const lastDayOfMonth = createLocalDate(now.getFullYear(), now.getMonth() + 1, 0);

        return {
          startDate: getLocalDateKey(createLocalDate(now.getFullYear(), now.getMonth(), 1)),
          endDate: getLocalDateKey(lastDayOfMonth),
        };
      }
    case "year":
      return {
        startDate: getLocalDateKey(createLocalDate(now.getFullYear(), 0, 1)),
        endDate: today,
      };
    default:
      return {
        startDate: today,
        endDate: today,
      };
  }
}

export function getCurrentMonthSelection(now = new Date()): TransactionsMonthSelection {
  return {
    monthIndex: now.getMonth(),
    year: now.getFullYear(),
  };
}

export function resolveMonthYearRange(monthIndex: number, year: number): TransactionsDateRange {
  const safeYear = Number.isInteger(year) ? year : new Date().getFullYear();

  if (monthIndex === TRANSACTIONS_YEAR_SELECTION) {
    return {
      startDate: getLocalDateKey(createLocalDate(safeYear, 0, 1)),
      endDate: getLocalDateKey(createLocalDate(safeYear, 12, 0)),
    };
  }

  const safeMonthIndex = Number.isInteger(monthIndex) ? Math.min(Math.max(monthIndex, 0), 11) : 0;
  const startDate = createLocalDate(safeYear, safeMonthIndex, 1);
  const endDate = createLocalDate(safeYear, safeMonthIndex + 1, 0);

  return {
    startDate: getLocalDateKey(startDate),
    endDate: getLocalDateKey(endDate),
  };
}

export function isDateInRange(dayKey: string, range: TransactionsDateRange) {
  return dayKey >= range.startDate && dayKey <= range.endDate;
}

export function isValidCustomRange(range: TransactionsDateRange) {
  return Boolean(range.startDate && range.endDate && range.startDate <= range.endDate);
}

export function formatDateRangeLabel(range: TransactionsDateRange, preset: TransactionsDateFilterPreset) {
  if (preset === "week") {
    return "Semana";
  }

  if (preset === "fifteen_days") {
    return "15 dias";
  }

  if (preset === "month") {
    return "Mes";
  }

  if (preset === "year") {
    return "Ano";
  }

  const [startYear, startMonth, startDay] = range.startDate.split("-");
  const [endYear, endMonth, endDay] = range.endDate.split("-");
  const startLabel = `${startDay}/${startMonth}/${startYear}`;
  const endLabel = `${endDay}/${endMonth}/${endYear}`;

  return `${startLabel} - ${endLabel}`;
}
