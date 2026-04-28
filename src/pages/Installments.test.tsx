import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import InstallmentsPage from "@/pages/Installments";
import { getCurrentMonthSelection, resolveMonthYearRange } from "@/lib/transactions-date-filter";
import type { InstallmentsOverview, InstallmentsOverviewFilters } from "@/types/api";

const mockUseInstallmentsOverview = vi.fn();

vi.mock("@/hooks/use-installments", () => ({
  useInstallmentsOverview: (...args: unknown[]) => mockUseInstallmentsOverview(...args),
}));

vi.mock("@/components/transactions/TransactionsMonthYearFilter", () => ({
  default: ({
    selectedMonthIndex,
    selectedYear,
    onMonthChange,
  }: {
    selectedMonthIndex: number;
    selectedYear: number;
    onMonthChange: (monthIndex: number) => void;
  }) => (
    <div>
      <span>{`month:${selectedMonthIndex}`}</span>
      <span>{`year:${selectedYear}`}</span>
      <button type="button" onClick={() => onMonthChange(4)}>
        Maio
      </button>
      <button type="button" onClick={() => onMonthChange(12)}>
        Ano
      </button>
    </div>
  ),
}));

vi.mock("@/components/transactions/TransactionsDateFilter", () => ({
  default: ({
    preset,
    range,
    onSelectPreset,
    onApplyCustomRange,
  }: {
    preset: string;
    range: { startDate: string; endDate: string };
    onSelectPreset: (preset: "week" | "fifteen_days" | "month" | "year") => void;
    onApplyCustomRange: (range: { startDate: string; endDate: string }) => void;
  }) => (
    <div>
      <span>{`preset:${preset}`}</span>
      <span>{`range:${range.startDate}:${range.endDate}`}</span>
      <button type="button" onClick={() => onSelectPreset("year")}>
        Ano atual
      </button>
      <button
        type="button"
        onClick={() =>
          onApplyCustomRange({
            startDate: "2026-06-01",
            endDate: "2026-06-30",
          })
        }
      >
        Periodo customizado
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/date-picker-input", () => ({
  DateRangePickerInput: ({
    startValue,
    endValue,
    onChange,
  }: {
    startValue: string | null;
    endValue: string | null;
    onChange: (range: { startValue: string | null; endValue: string | null }) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange({ startValue: "2026-06-01", endValue: "2026-06-30" })}
    >
      {startValue && endValue ? `${startValue}:${endValue}` : "mock-range-picker"}
    </button>
  ),
}));

vi.mock("@/components/AppShell", () => ({
  default: ({
    children,
    title,
    description,
    headerContent,
  }: {
    children: ReactNode;
    title: string;
    description: string;
    headerContent?: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {headerContent}
      {children}
    </div>
  ),
}));

vi.mock("@/components/installments/InstallmentsFilters", () => ({
  default: ({
    filters,
    appliedRangeLabel,
    onChange,
    onApplyFilters,
    onResetFilters,
  }: {
    filters: InstallmentsOverviewFilters;
    appliedRangeLabel: string;
    onChange: (nextFilters: InstallmentsOverviewFilters) => void;
    onApplyFilters: (nextFilters: InstallmentsOverviewFilters) => void;
    onResetFilters: () => void;
  }) => (
    <MockInstallmentsFilters
      filters={filters}
      appliedRangeLabel={appliedRangeLabel}
      onChange={onChange}
      onApplyFilters={onApplyFilters}
      onResetFilters={onResetFilters}
    />
  ),
}));

function MockInstallmentsFilters({
  filters,
  appliedRangeLabel,
  onChange,
  onApplyFilters,
  onResetFilters,
}: {
  filters: InstallmentsOverviewFilters;
  appliedRangeLabel: string;
  onChange: (nextFilters: InstallmentsOverviewFilters) => void;
  onApplyFilters: (nextFilters: InstallmentsOverviewFilters) => void;
  onResetFilters: () => void;
}) {
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  return (
    <div>
      <span>{appliedRangeLabel}</span>
      <button
        type="button"
        onClick={() =>
          setDraft({
            ...draft,
            status: "paid",
          })
        }
      >
        Status quitados
      </button>
      <button
        type="button"
        onClick={() => {
          onChange(draft);
          onApplyFilters(draft);
        }}
      >
        Aplicar filtros
      </button>
      <button type="button" onClick={onResetFilters}>
        Limpar filtros
      </button>
    </div>
  );
}

vi.mock("@/components/installments/InstallmentsCharts", () => ({
  default: ({ overview }: { overview: InstallmentsOverview }) => (
    <button
      data-testid="installments-chart-period-preset-trigger"
      type="button"
      onClick={() =>
        mockUseInstallmentsOverview({
          ...overview.appliedFilters,
          purchaseStart: "2026-01-01",
          purchaseEnd: "2026-12-31",
        })
      }
    >
      Ano atual
    </button>
  ),
}));

function createOverview(overrides: Partial<InstallmentsOverview> = {}): InstallmentsOverview {
  return {
    appliedFilters: {
      cardId: "all",
      categoryId: "all",
      search: "",
      status: "all",
      installmentAmountMin: null,
      installmentAmountMax: null,
      installmentCountMode: "all",
      installmentCountValue: null,
      purchaseStart: "2026-04-01",
      purchaseEnd: "2026-04-30",
      sortBy: "smart",
      sortOrder: "desc",
    },
    activeInstallmentsCount: 2,
    monthlyCommitment: 450,
    remainingBalanceTotal: 1200,
    originalAmountTotal: 1800,
    payoffProjectionMonth: "2026-08",
    alerts: {
      concentration: {
        thresholdRatio: 0.5,
        triggered: true,
        cardId: 2,
        cardName: "Nubank",
        shareRatio: 0.6,
        monthlyAmount: 270,
      },
    },
    charts: {
      next3MonthsProjection: [
        { month: "2026-04", amount: 450 },
        { month: "2026-05", amount: 450 },
        { month: "2026-06", amount: 320 },
      ],
      monthlyCommitmentEvolution: [
        { month: "2026-04", amount: 450 },
        { month: "2026-05", amount: 450 },
        { month: "2026-06", amount: 320 },
      ],
      cardDistribution: [
        { cardId: 2, cardName: "Nubank", amount: 270, shareRatio: 0.6 },
        { cardId: 3, cardName: "Visa", amount: 180, shareRatio: 0.4 },
      ],
      topCategories: [
        { categoryId: 1, category: "Eletronicos", amount: 300 },
        { categoryId: 2, category: "Cursos", amount: 150 },
      ],
    },
    filterOptions: {
      cards: [
        { id: 2, name: "Nubank" },
        { id: 3, name: "Visa" },
      ],
      categories: [
        { id: 1, label: "Eletronicos" },
        { id: 2, label: "Cursos" },
      ],
      statuses: ["active", "paid", "overdue"],
      installmentCountValues: [2, 8],
      remainingInstallmentValues: [1, 6],
      installmentAmountRange: {
        min: 50,
        max: 300,
      },
    },
    items: [
      {
        transactionId: 101,
        installmentTransactionId: 101,
        installmentPurchaseId: 10,
        description: "Notebook",
        category: "Eletronicos",
        categoryId: 1,
        cardId: 2,
        cardName: "Nubank",
        purchaseDate: "2026-02-15",
        totalAmount: 1200,
        installmentAmount: 150,
        installmentCount: 8,
        currentInstallment: 3,
        displayInstallmentNumber: 3,
        remainingInstallments: 6,
        remainingBalance: 900,
        nextDueDate: "2026-04-15",
        installmentDueDate: "2026-04-15",
        installmentMonth: "2026-04",
        status: "active",
      },
      {
        transactionId: 102,
        installmentTransactionId: 102,
        installmentPurchaseId: 11,
        description: "Curso",
        category: "Cursos",
        categoryId: 2,
        cardId: 3,
        cardName: "Visa",
        purchaseDate: "2026-01-15",
        totalAmount: 600,
        installmentAmount: 300,
        installmentCount: 2,
        currentInstallment: 2,
        displayInstallmentNumber: 2,
        remainingInstallments: 1,
        remainingBalance: 300,
        nextDueDate: "2026-04-10",
        installmentDueDate: "2026-04-10",
        installmentMonth: "2026-04",
        status: "overdue",
      },
    ],
    ...overrides,
  };
}

function createOverviewForFilters(filters: Partial<InstallmentsOverviewFilters> = {}) {
  if (filters.status === "paid") {
    return createOverview({
      appliedFilters: {
        ...createOverview().appliedFilters,
        ...filters,
      },
      activeInstallmentsCount: 0,
      monthlyCommitment: 0,
      remainingBalanceTotal: 0,
      items: [],
      charts: {
        next3MonthsProjection: [
          { month: "2026-04", amount: 0 },
          { month: "2026-05", amount: 0 },
          { month: "2026-06", amount: 0 },
        ],
        monthlyCommitmentEvolution: [],
        cardDistribution: [],
        topCategories: [],
      },
    });
  }

  if (filters.purchaseStart === "2026-01-01" && filters.purchaseEnd === "2026-12-31") {
    return createOverview({
      appliedFilters: {
        ...createOverview().appliedFilters,
        ...filters,
      },
      charts: {
        ...createOverview().charts,
        monthlyCommitmentEvolution: [
          { month: "2026-01", amount: 600 },
          { month: "2026-02", amount: 560 },
          { month: "2026-03", amount: 510 },
          { month: "2026-04", amount: 450 },
          { month: "2026-05", amount: 420 },
          { month: "2026-06", amount: 390 },
        ],
      },
    });
  }

  return createOverview({
    appliedFilters: {
      ...createOverview().appliedFilters,
      ...filters,
    },
  });
}

function renderPage(initialEntry = "/gestao-de-gastos/parcelamentos") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <InstallmentsPage />
    </MemoryRouter>,
  );
}

describe("InstallmentsPage", () => {
  afterEach(() => {
    mockUseInstallmentsOverview.mockReset();
  });

  it("renders loading state with the current month applied by default", () => {
    const currentSelection = getCurrentMonthSelection();
    const defaultRange = resolveMonthYearRange(currentSelection.monthIndex, currentSelection.year);

    mockUseInstallmentsOverview.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    renderPage();

    expect(screen.getByText("Parcelamentos")).toBeInTheDocument();
    expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseStart: defaultRange.startDate,
        purchaseEnd: defaultRange.endDate,
        categoryId: "all",
        search: "",
      }),
    );
  });

  it("applies month, custom period, category and search immediately from the header", async () => {
    const currentSelection = getCurrentMonthSelection();

    mockUseInstallmentsOverview.mockImplementation((filters) => ({
      data: createOverviewForFilters(filters),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Maio" }));

    await waitFor(() => {
      expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseStart: `${currentSelection.year}-05-01`,
          purchaseEnd: `${currentSelection.year}-05-31`,
        }),
      );
    });

    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(screen.getByRole("option", { name: "Cursos" }));

    await waitFor(() => {
      expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: "2",
        }),
      );
    });

    fireEvent.change(screen.getByPlaceholderText(/Buscar compra/), {
      target: { value: "visa" },
    });

    await waitFor(() => {
      expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "visa",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Periodo customizado" }));

    await waitFor(() => {
      expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseStart: "2026-06-01",
          purchaseEnd: "2026-06-30",
        }),
      );
    });
  });

  it("keeps advanced filters in draft until applying them", async () => {
    mockUseInstallmentsOverview.mockImplementation((filters) => ({
      data: createOverviewForFilters(filters),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Status quitados" }));

    expect(screen.getByText("Notebook")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum parcelamento encontrado")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "paid",
        }),
      );
    });

    expect(screen.getByText("Nenhum parcelamento encontrado")).toBeInTheDocument();
  });

  it("resets immediate and advanced filters back to the current month", async () => {
    const currentSelection = getCurrentMonthSelection();
    const defaultRange = resolveMonthYearRange(currentSelection.monthIndex, currentSelection.year);

    mockUseInstallmentsOverview.mockImplementation((filters) => ({
      data: createOverviewForFilters(filters),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/Buscar compra/), {
      target: { value: "visa" },
    });
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(screen.getByRole("option", { name: "Cursos" }));
    fireEvent.click(screen.getByRole("button", { name: "Status quitados" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    await waitFor(() => {
      expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "paid",
          categoryId: "2",
          search: "visa",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));

    await waitFor(() => {
      expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseStart: defaultRange.startDate,
          purchaseEnd: defaultRange.endDate,
          categoryId: "all",
          search: "",
          status: "all",
        }),
      );
    });

    expect(screen.getByPlaceholderText(/Buscar compra/)).toHaveValue("");
    expect(screen.getByText("Notebook")).toBeInTheDocument();
  });

  it("keeps the chart query inheriting page filters while overriding only the chart period", async () => {
    mockUseInstallmentsOverview.mockImplementation((filters) => ({
      data: createOverviewForFilters(filters),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    renderPage("/gestao-de-gastos/parcelamentos?categoryId=2&search=visa");

    await waitFor(() => {
      expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: "2",
          search: "visa",
        }),
      );
    });

    fireEvent.click(screen.getByTestId("installments-chart-period-preset-trigger"));

    await waitFor(() => {
      expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: "2",
          search: "visa",
          purchaseStart: "2026-01-01",
          purchaseEnd: "2026-12-31",
        }),
      );
    });
  });

  it("renders error state with retry action", () => {
    const refetch = vi.fn();

    mockUseInstallmentsOverview.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("falha"),
      refetch,
    });

    renderPage();

    expect(screen.getByText("NÃ£o foi possÃ­vel carregar os parcelamentos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(refetch).toHaveBeenCalled();
  });
});
