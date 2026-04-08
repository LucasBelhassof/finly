import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TransactionsDateFilter from "@/components/transactions/TransactionsDateFilter";

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    onDayClick,
    onDayMouseEnter,
    selected,
  }: {
    onDayClick?: (day: Date) => void;
    onDayMouseEnter?: (day: Date) => void;
    selected?: { from?: Date; to?: Date };
  }) => (
    <div>
      <button type="button" onClick={() => onDayClick?.(new Date(2026, 3, 2, 12, 0, 0))}>
        Click Apr 2
      </button>
      <button type="button" onMouseEnter={() => onDayMouseEnter?.(new Date(2026, 3, 8, 12, 0, 0))}>
        Hover Apr 8
      </button>
      <button type="button" onClick={() => onDayClick?.(new Date(2026, 3, 8, 12, 0, 0))}>
        Click Apr 8
      </button>
      <div data-testid="calendar-selected">
        {selected?.from ? `${selected.from.getDate()}` : "-"}-{selected?.to ? `${selected.to.getDate()}` : "-"}
      </div>
    </div>
  ),
}));

describe("TransactionsDateFilter", () => {
  it("highlights the active preset and replaces custom when another preset is clicked", () => {
    const onSelectPreset = vi.fn();
    const onApplyCustomRange = vi.fn();

    render(
      <TransactionsDateFilter
        preset="month"
        range={{ startDate: "2026-04-01", endDate: "2026-04-06" }}
        onSelectPreset={onSelectPreset}
        onApplyCustomRange={onApplyCustomRange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Semana" }));
    expect(onSelectPreset).toHaveBeenCalledWith("week");
  });

  it("renders the annual preset after month and triggers it when clicked", () => {
    const onSelectPreset = vi.fn();

    render(
      <TransactionsDateFilter
        preset="month"
        range={{ startDate: "2026-04-01", endDate: "2026-04-06" }}
        onSelectPreset={onSelectPreset}
        onApplyCustomRange={vi.fn()}
      />,
    );

    const presetButtons = screen.getAllByRole("button").slice(0, 4);
    expect(presetButtons.map((button) => button.textContent)).toEqual(["Semana", "15 dias", "Mes", "Ano"]);

    fireEvent.click(screen.getByRole("button", { name: "Ano" }));
    expect(onSelectPreset).toHaveBeenCalledWith("year");
  });

  it("resets previous range on first click, previews on hover and applies only after second click", () => {
    const onSelectPreset = vi.fn();
    const onApplyCustomRange = vi.fn();

    render(
      <TransactionsDateFilter
        preset="custom"
        range={{ startDate: "2026-04-01", endDate: "2026-04-06" }}
        onSelectPreset={onSelectPreset}
        onApplyCustomRange={onApplyCustomRange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /01\/04\/2026 - 06\/04\/2026/i }));

    expect(screen.getByTestId("calendar-selected").textContent).toBe("1-6");

    fireEvent.click(screen.getByRole("button", { name: "Click Apr 2" }));
    expect(screen.getByText("Selecione a data final.")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-selected").textContent).toBe("2-2");
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Hover Apr 8" }));
    expect(screen.getByTestId("calendar-selected").textContent).toBe("2-8");
    expect(screen.getByText("Selecione um intervalo no calendario.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Click Apr 8" }));
    expect(screen.getByText("02/04/2026 - 08/04/2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aplicar" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(onApplyCustomRange).toHaveBeenCalledWith({
      startDate: "2026-04-02",
      endDate: "2026-04-08",
    });
  });
});
