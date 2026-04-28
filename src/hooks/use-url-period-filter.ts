import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import {
  TRANSACTIONS_YEAR_SELECTION,
  getLocalDateKey,
  parseLocalDateKey,
  resolveMonthYearRange,
  resolvePresetRange,
  type TransactionsDateFilterPreset,
  type TransactionsDateRange,
} from "@/lib/transactions-date-filter";

export type UrlPeriodFilterDefaults = {
  selectedMonthIndex: number;
  selectedYear: number;
  datePreset: TransactionsDateFilterPreset;
  dateRange: TransactionsDateRange;
};

export type UrlPeriodFilterState = UrlPeriodFilterDefaults;

const QUERY_PARAM_KEYS = {
  month: "month",
  year: "year",
  preset: "preset",
  startDate: "startDate",
  endDate: "endDate",
} as const;

const VALID_PRESETS: TransactionsDateFilterPreset[] = ["week", "fifteen_days", "month", "year", "custom"];

function isValidMonthIndex(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0 && value <= TRANSACTIONS_YEAR_SELECTION;
}

function isValidYear(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 1900 && value <= 9999;
}

function isValidPreset(value: string | null): value is TransactionsDateFilterPreset {
  return value !== null && VALID_PRESETS.includes(value as TransactionsDateFilterPreset);
}

function parseInteger(value: string | null) {
  if (value === null || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function isValidDateKey(value: string | null): value is string {
  if (!value) {
    return false;
  }

  try {
    return getLocalDateKey(parseLocalDateKey(value)) === value;
  } catch {
    return false;
  }
}

function buildSearchParams(previousSearchParams: URLSearchParams, nextState: UrlPeriodFilterState) {
  const nextSearchParams = new URLSearchParams(previousSearchParams);

  nextSearchParams.set(QUERY_PARAM_KEYS.month, String(nextState.selectedMonthIndex));
  nextSearchParams.set(QUERY_PARAM_KEYS.year, String(nextState.selectedYear));
  nextSearchParams.set(QUERY_PARAM_KEYS.preset, nextState.datePreset);
  nextSearchParams.set(QUERY_PARAM_KEYS.startDate, nextState.dateRange.startDate);
  nextSearchParams.set(QUERY_PARAM_KEYS.endDate, nextState.dateRange.endDate);

  return nextSearchParams;
}

export function resolveUrlPeriodFilterState(
  searchParams: URLSearchParams,
  defaults: UrlPeriodFilterDefaults,
  now = new Date(),
): UrlPeriodFilterState {
  const parsedMonth = parseInteger(searchParams.get(QUERY_PARAM_KEYS.month));
  const parsedYear = parseInteger(searchParams.get(QUERY_PARAM_KEYS.year));
  const parsedPreset = searchParams.get(QUERY_PARAM_KEYS.preset);
  const parsedStartDate = searchParams.get(QUERY_PARAM_KEYS.startDate);
  const parsedEndDate = searchParams.get(QUERY_PARAM_KEYS.endDate);

  const selectedMonthIndex = isValidMonthIndex(parsedMonth) ? parsedMonth : defaults.selectedMonthIndex;
  const selectedYear = isValidYear(parsedYear) ? parsedYear : defaults.selectedYear;
  const hasMonthOrYearInUrl = isValidMonthIndex(parsedMonth) || isValidYear(parsedYear);

  const hasValidExplicitRange =
    isValidDateKey(parsedStartDate) &&
    isValidDateKey(parsedEndDate) &&
    parsedStartDate <= parsedEndDate;

  const datePreset = isValidPreset(parsedPreset)
    ? parsedPreset
    : hasMonthOrYearInUrl
      ? selectedMonthIndex === TRANSACTIONS_YEAR_SELECTION
        ? "year"
        : "month"
      : defaults.datePreset;

  const dateRange = hasValidExplicitRange
    ? {
        startDate: parsedStartDate,
        endDate: parsedEndDate,
      }
    : hasMonthOrYearInUrl
      ? resolveMonthYearRange(selectedMonthIndex, selectedYear)
      : isValidPreset(parsedPreset) && parsedPreset !== "custom"
        ? resolvePresetRange(parsedPreset, now)
        : defaults.dateRange;

  return {
    selectedMonthIndex,
    selectedYear,
    datePreset,
    dateRange,
  };
}

export function useUrlPeriodFilter(defaults: UrlPeriodFilterDefaults) {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo(
    () =>
      resolveUrlPeriodFilterState(searchParams, defaults),
    [
      defaults.datePreset,
      defaults.dateRange.endDate,
      defaults.dateRange.startDate,
      defaults.selectedMonthIndex,
      defaults.selectedYear,
      searchParams,
    ],
  );

  const updateState = (nextState: UrlPeriodFilterState) => {
    setSearchParams(buildSearchParams(searchParams, nextState), { replace: true });
  };

  const handleMonthChange = (monthIndex: number) => {
    updateState({
      ...state,
      selectedMonthIndex: monthIndex,
      datePreset: monthIndex === TRANSACTIONS_YEAR_SELECTION ? "year" : "month",
      dateRange: resolveMonthYearRange(monthIndex, state.selectedYear),
    });
  };

  const handleYearChange = (year: number) => {
    updateState({
      ...state,
      selectedYear: year,
      datePreset: state.selectedMonthIndex === TRANSACTIONS_YEAR_SELECTION ? "year" : "month",
      dateRange: resolveMonthYearRange(state.selectedMonthIndex, year),
    });
  };

  const handlePresetChange = (preset: Exclude<TransactionsDateFilterPreset, "custom">) => {
    updateState({
      ...state,
      datePreset: preset,
      dateRange: resolvePresetRange(preset),
    });
  };

  const handleCustomRangeApply = (range: TransactionsDateRange) => {
    updateState({
      ...state,
      datePreset: "custom",
      dateRange: range,
    });
  };

  return {
    ...state,
    handleMonthChange,
    handleYearChange,
    handlePresetChange,
    handleCustomRangeApply,
  };
}
