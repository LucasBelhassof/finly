export type TransactionsDateFilterPreset = "week" | "fifteen_days" | "month" | "year" | "custom";

export type TransactionsDateRange = {
  startDate: string;
  endDate: string;
};

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

export function resolvePresetRange(preset: TransactionsDateFilterPreset, now = new Date()): TransactionsDateRange {
  const today = getLocalDateKey(now);

  switch (preset) {
    case "week":
      return {
        startDate: shiftDateKey(today, -6),
        endDate: today,
      };
    case "fifteen_days":
      return {
        startDate: shiftDateKey(today, -14),
        endDate: today,
      };
    case "month":
      return {
        startDate: getLocalDateKey(createLocalDate(now.getFullYear(), now.getMonth(), 1)),
        endDate: today,
      };
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
