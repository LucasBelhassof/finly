import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InstallmentsPage from "@/pages/Installments";
import type { InstallmentsOverview } from "@/types/api";

const mockUseInstallmentsOverview = vi.fn();

vi.mock("@/hooks/use-installments", () => ({
  useInstallmentsOverview: (...args: unknown[]) => mockUseInstallmentsOverview(...args),
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
  default: ({ children, title, description }: { children: ReactNode; title: string; description: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
}));

function createOverview(overrides: Partial<InstallmentsOverview> = {}): InstallmentsOverview {
  return {
    appliedFilters: {
      cardId: "all",
      categoryId: "all",
      status: "all",
      installmentAmountMin: null,
      installmentAmountMax: null,
      installmentCountMode: "all",
      installmentCountValue: null,
      purchaseStart: null,
      purchaseEnd: null,
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

function createOverviewForFilters(filters: { purchaseStart?: string | null; purchaseEnd?: string | null; status?: string } = {}) {
  if (filters.status === "paid") {
    return createOverview({
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

  if (filters.purchaseStart === "2026-04-01" && filters.purchaseEnd === "2026-09-30") {
    return createOverview({
      charts: {
        ...createOverview().charts,
        monthlyCommitmentEvolution: [
          { month: "2026-04", amount: 450 },
          { month: "2026-05", amount: 420 },
          { month: "2026-06", amount: 390 },
          { month: "2026-07", amount: 360 },
          { month: "2026-08", amount: 330 },
          { month: "2026-09", amount: 300 },
        ],
      },
    });
  }

  if (filters.purchaseStart === "2026-01-01" && filters.purchaseEnd === "2026-12-31") {
    return createOverview({
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

  if (filters.purchaseStart === "2026-06-01" && filters.purchaseEnd === "2026-06-30") {
    return createOverview({
      items: [
        {
          transactionId: 103,
          installmentTransactionId: 103,
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
          currentInstallment: 6,
          displayInstallmentNumber: 6,
          remainingInstallments: 3,
          remainingBalance: 450,
          nextDueDate: "2026-06-15",
          installmentDueDate: "2026-06-15",
          installmentMonth: "2026-06",
          status: "active",
        },
      ],
      charts: {
        ...createOverview().charts,
        monthlyCommitmentEvolution: [{ month: "2026-06", amount: 150 }],
      },
    });
  }

  return createOverview();
}

describe("InstallmentsPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    mockUseInstallmentsOverview.mockReset();
  });

  it("renders loading state", () => {
    mockUseInstallmentsOverview.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<InstallmentsPage />);

    expect(screen.getByText("Parcelamentos")).toBeInTheDocument();
    expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(expect.objectContaining({
      purchaseStart: "2026-04-01",
      purchaseEnd: "2026-04-30",
    }));
  });

  it("renders cards and detailed table from API data", () => {
    mockUseInstallmentsOverview.mockImplementation((filters) => ({
      data: createOverviewForFilters(filters),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    render(<InstallmentsPage />);

    expect(screen.getByText("Compromisso mensal")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 450,00").length).toBeGreaterThan(0);
    expect(screen.getByText("Notebook")).toBeInTheDocument();
    expect(screen.getByText("Distribuicao por cartao")).toBeInTheDocument();
  });

  it("updates the view when filters change and shows empty state", () => {
    mockUseInstallmentsOverview.mockImplementation((filters) => ({
      data: createOverviewForFilters(filters),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    render(<InstallmentsPage />);

    fireEvent.click(screen.getAllByRole("combobox")[2]);
    fireEvent.click(screen.getByRole("option", { name: "Quitados" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(screen.getByText("Nenhum parcelamento encontrado")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 0,00").length).toBeGreaterThan(0);
  });

  it("uses period presets and only shows the custom calendar when needed", () => {
    mockUseInstallmentsOverview.mockImplementation((filters) => ({
      data: createOverviewForFilters(filters),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    render(<InstallmentsPage />);

    expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(expect.objectContaining({
      purchaseStart: "2026-04-01",
      purchaseEnd: "2026-04-30",
    }));
    expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(expect.objectContaining({
      purchaseStart: "2026-04-01",
      purchaseEnd: "2026-09-30",
    }));
    expect(screen.queryByText("mock-range-picker")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("installments-period-preset-trigger"));
    fireEvent.click(screen.getByRole("option", { name: "Proximo Mes" }));

    expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(expect.objectContaining({
      purchaseStart: "2026-04-01",
      purchaseEnd: "2026-04-30",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(expect.objectContaining({
      purchaseStart: "2026-05-01",
      purchaseEnd: "2026-05-31",
    }));
    expect(screen.queryByText("mock-range-picker")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("installments-period-preset-trigger"));
    fireEvent.click(screen.getByRole("option", { name: "Personalizado" }));

    expect(screen.getByText("2026-05-01:2026-05-31")).toBeInTheDocument();
    fireEvent.click(screen.getByText("2026-05-01:2026-05-31"));

    expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(expect.objectContaining({
      purchaseStart: "2026-06-01",
      purchaseEnd: "2026-06-30",
    }));

    fireEvent.click(screen.getByTestId("installments-period-preset-trigger"));
    fireEvent.click(screen.getByRole("option", { name: "Mes Atual" }));
    fireEvent.click(screen.getByTestId("installments-period-preset-trigger"));
    fireEvent.click(screen.getByRole("option", { name: "Personalizado" }));

    expect(screen.getByText("2026-06-01:2026-06-30")).toBeInTheDocument();
  });

  it("updates only the evolution chart when the chart period filter changes", () => {
    mockUseInstallmentsOverview.mockImplementation((filters) => ({
      data: createOverviewForFilters(filters),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    render(<InstallmentsPage />);

    expect(screen.getAllByText("R$ 450,00").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("installments-chart-period-preset-trigger"));
    fireEvent.click(screen.getByRole("option", { name: "Ano atual" }));

    expect(mockUseInstallmentsOverview).toHaveBeenCalledWith(expect.objectContaining({
      purchaseStart: "2026-01-01",
      purchaseEnd: "2026-12-31",
    }));
    expect(screen.getAllByText("R$ 450,00").length).toBeGreaterThan(0);
    expect(screen.getByText("Notebook")).toBeInTheDocument();
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

    render(<InstallmentsPage />);

    expect(screen.getByText("Nao foi possivel carregar os parcelamentos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders the displayed installment month and due date from the filtered row data", () => {
    mockUseInstallmentsOverview.mockImplementation(() => ({
      data: createOverview({
        items: [
          {
            transactionId: 103,
            installmentTransactionId: 103,
            installmentPurchaseId: 10,
            description: "Notebook",
            category: "Eletronicos",
            categoryId: 1,
            cardId: 2,
            cardName: "Nubank",
            purchaseDate: "2026-02-15",
            totalAmount: 1200,
            installmentAmount: 150,
            installmentCount: 12,
            currentInstallment: 6,
            displayInstallmentNumber: 6,
            remainingInstallments: 7,
            remainingBalance: 1050,
            nextDueDate: "2026-06-15",
            installmentDueDate: "2026-06-15",
            installmentMonth: "2026-06",
            status: "active",
          },
        ],
      }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    render(<InstallmentsPage />);

    expect(screen.getByText("Notebook")).toBeInTheDocument();
    expect(screen.getByText("6/12")).toBeInTheDocument();
    expect(screen.getByText("15/06/2026")).toBeInTheDocument();
  });
});
