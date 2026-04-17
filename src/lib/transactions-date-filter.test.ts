import { describe, expect, it } from "vitest";

import {
  formatDateRangeLabel,
  getLocalDateKey,
  isDateInRange,
  isValidCustomRange,
  resolveMonthYearRange,
  resolvePresetRange,
  TRANSACTIONS_YEAR_SELECTION,
} from "@/lib/transactions-date-filter";

describe("transactions date filter utils", () => {
  it("resolves preset ranges with inclusive boundaries", () => {
    const referenceDate = new Date(2026, 3, 6, 10, 0, 0);

    expect(resolvePresetRange("week", referenceDate)).toEqual({
      startDate: "2026-04-06",
      endDate: "2026-04-12",
    });
    expect(resolvePresetRange("fifteen_days", referenceDate)).toEqual({
      startDate: "2026-04-06",
      endDate: "2026-04-20",
    });
    expect(resolvePresetRange("month", referenceDate)).toEqual({
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    });
    expect(resolvePresetRange("year", referenceDate)).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-04-06",
    });
  });

  it("compares dates inclusively", () => {
    const range = {
      startDate: "2026-04-06",
      endDate: "2026-04-20",
    };

    expect(isDateInRange("2026-04-06", range)).toBe(true);
    expect(isDateInRange("2026-04-20", range)).toBe(true);
    expect(isDateInRange("2026-04-21", range)).toBe(false);
  });

  it("formats labels and validates custom ranges", () => {
    expect(formatDateRangeLabel({ startDate: "2026-04-01", endDate: "2026-04-06" }, "month")).toBe("Mes");
    expect(formatDateRangeLabel({ startDate: "2026-01-01", endDate: "2026-04-06" }, "year")).toBe("Ano");
    expect(formatDateRangeLabel({ startDate: "2026-04-01", endDate: "2026-04-06" }, "custom")).toBe("01/04/2026 - 06/04/2026");
    expect(isValidCustomRange({ startDate: "2026-04-01", endDate: "2026-04-06" })).toBe(true);
    expect(isValidCustomRange({ startDate: "2026-04-06", endDate: "2026-04-01" })).toBe(false);
  });

  it("creates a local date key without timezone shift", () => {
    expect(getLocalDateKey(new Date(2026, 3, 6, 23, 30, 0))).toBe("2026-04-06");
  });

  it("resolves the annual month selector to the full selected year", () => {
    expect(resolveMonthYearRange(TRANSACTIONS_YEAR_SELECTION, 2026)).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
  });
});
