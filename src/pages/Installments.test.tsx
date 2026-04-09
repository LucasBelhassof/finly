import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import InstallmentsPage from "@/pages/Installments";
import type { InstallmentsOverview } from "@/types/api";

const mockUseInstallmentsOverview = vi.fn();

vi.mock("@/hooks/use-installments", () => ({
  useInstallmentsOverview: (...args: unknown[]) => mockUseInstallmentsOverview(...args),
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
      installmentAmountRange: {
        min: 50,
        max: 300,
      },
    },
    items: [
      {
        transactionId: 101,
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
        remainingInstallments: 6,
        remainingBalance: 900,
        nextDueDate: "2026-04-15",
        status: "active",
      },
      {
        transactionId: 102,
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
        remainingInstallments: 1,
        remainingBalance: 300,
        nextDueDate: "2026-04-10",
        status: "overdue",
      },
    ],
    ...overrides,
  };
}

describe("InstallmentsPage", () => {
  it("renders loading state", () => {
    mockUseInstallmentsOverview.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<InstallmentsPage />);

    expect(screen.getByText("Parcelamentos")).toBeInTheDocument();
  });

  it("renders cards and detailed table from API data", () => {
    mockUseInstallmentsOverview.mockReturnValue({
      data: createOverview(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<InstallmentsPage />);

    expect(screen.getByText("Compromisso mensal")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 450,00").length).toBeGreaterThan(0);
    expect(screen.getByText("Notebook")).toBeInTheDocument();
    expect(screen.getByText("Distribuicao por cartao")).toBeInTheDocument();
  });

  it("updates the view when filters change and shows empty state", () => {
    mockUseInstallmentsOverview.mockImplementation((filters) => {
      if (filters.status === "paid") {
        return {
          data: createOverview({
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
          }),
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        };
      }

      return {
        data: createOverview(),
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    });

    render(<InstallmentsPage />);

    fireEvent.click(screen.getAllByRole("combobox")[2]);
    fireEvent.click(screen.getByRole("option", { name: "Quitados" }));

    expect(screen.getByText("Nenhum parcelamento encontrado")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 0,00").length).toBeGreaterThan(0);
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
});
