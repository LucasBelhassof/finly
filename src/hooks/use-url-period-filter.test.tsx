import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { resolveMonthYearRange } from "@/lib/transactions-date-filter";

import { resolveUrlPeriodFilterState, useUrlPeriodFilter } from "./use-url-period-filter";

function createRouterWrapper(initialEntry = "/") {
  return function Wrapper({ children }: PropsWithChildren) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

describe("useUrlPeriodFilter", () => {
  it("restores period state from the URL when all params are valid", () => {
    const state = resolveUrlPeriodFilterState(
      new URLSearchParams({
        month: "12",
        year: "2025",
        preset: "custom",
        startDate: "2025-02-01",
        endDate: "2025-02-28",
      }),
      {
        selectedMonthIndex: 3,
        selectedYear: 2026,
        datePreset: "month",
        dateRange: { startDate: "2026-04-01", endDate: "2026-04-30" },
      },
    );

    expect(state).toEqual({
      selectedMonthIndex: 12,
      selectedYear: 2025,
      datePreset: "custom",
      dateRange: {
        startDate: "2025-02-01",
        endDate: "2025-02-28",
      },
    });
  });

  it("falls back to defaults when the URL carries invalid values", () => {
    const defaults = {
      selectedMonthIndex: 3,
      selectedYear: 2026,
      datePreset: "month" as const,
      dateRange: { startDate: "2026-04-01", endDate: "2026-04-30" },
    };

    const state = resolveUrlPeriodFilterState(
      new URLSearchParams({
        month: "42",
        year: "foo",
        preset: "custom",
        startDate: "2026-04-40",
        endDate: "2026-04-20",
      }),
      defaults,
    );

    expect(state).toEqual(defaults);
  });

  it("updates the search params when the month filter changes", () => {
    const { result } = renderHook(
      () => {
        const periodFilter = useUrlPeriodFilter({
          selectedMonthIndex: 3,
          selectedYear: 2026,
          datePreset: "month",
          dateRange: { startDate: "2026-04-01", endDate: "2026-04-30" },
        });
        const location = useLocation();

        return {
          ...periodFilter,
          search: location.search,
        };
      },
      {
        wrapper: createRouterWrapper("/"),
      },
    );

    act(() => {
      result.current.handleMonthChange(12);
    });

    expect(result.current.selectedMonthIndex).toBe(12);
    expect(result.current.datePreset).toBe("year");
    expect(result.current.dateRange).toEqual(resolveMonthYearRange(12, 2026));
    expect(result.current.search).toBe("?month=12&year=2026&preset=year&startDate=2026-01-01&endDate=2026-12-31");
  });
});
