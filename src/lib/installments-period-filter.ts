export type InstallmentsPeriodPreset = "current_month" | "next_month" | "custom";

export type InstallmentsPeriodRange = {
  startDate: string;
  endDate: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function createLocalDate(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function resolveInstallmentsPeriodRange(preset: Exclude<InstallmentsPeriodPreset, "custom">, now = new Date()): InstallmentsPeriodRange {
  const monthOffset = preset === "next_month" ? 1 : 0;
  const year = now.getFullYear();
  const month = now.getMonth() + monthOffset;
  const startDate = createLocalDate(year, month, 1);
  const endDate = createLocalDate(year, month + 1, 0);

  return {
    startDate: getLocalDateKey(startDate),
    endDate: getLocalDateKey(endDate),
  };
}
