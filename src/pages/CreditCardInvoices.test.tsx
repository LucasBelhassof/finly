import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CreditCardInvoicesPage from "@/pages/CreditCardInvoices";
import { getCurrentMonthSelection, resolveMonthYearRange } from "@/lib/transactions-date-filter";
import type { InvoicesData, InvoiceFilters } from "@/types/api";

const mockUseInvoices = vi.fn();
const mockUpdateSettings = vi.fn();
const mockMarkInvoicePaid = vi.fn();
const mockUnmarkInvoicePaid = vi.fn();

vi.mock("@/hooks/use-invoices", () => ({
  useInvoices: (...args: unknown[]) => mockUseInvoices(...args),
  useUpdateInvoiceSettings: () => ({
    mutateAsync: mockUpdateSettings,
    isPending: false,
  }),
  useMarkInvoicePaid: () => ({
    mutateAsync: mockMarkInvoicePaid,
    isPending: false,
  }),
  useUnmarkInvoicePaid: () => ({
    mutateAsync: mockUnmarkInvoicePaid,
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-transactions", () => ({
  useCategories: () => ({
    data: [],
  }),
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
    </div>
  ),
}));

vi.mock("@/components/transactions/TransactionsDateFilter", () => ({
  default: ({
    preset,
    range,
    onApplyCustomRange,
  }: {
    preset: string;
    range: { startDate: string; endDate: string };
    onApplyCustomRange: (range: { startDate: string; endDate: string }) => void;
  }) => (
    <div>
      <span>{`preset:${preset}`}</span>
      <span>{`range:${range.startDate}:${range.endDate}`}</span>
      <button type="button" onClick={() => onApplyCustomRange({ startDate: "2026-06-01", endDate: "2026-06-30" })}>
        Período customizado
      </button>
    </div>
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
      <div data-testid="app-shell-header-content" data-present={headerContent ? "true" : "false"}>
        {headerContent}
      </div>
      {children}
    </div>
  ),
}));

function createInvoicesData(overrides: Partial<InvoicesData> = {}): InvoicesData {
  return {
    appliedFilters: {
      cardId: "all",
      referenceStart: "2026-04-01",
      referenceEnd: "2026-04-30",
      status: "all",
      categoryId: "all",
      search: "",
    },
    summary: {
      totalAmount: 120,
      formattedTotalAmount: "R$ 120,00",
      dueSoonCount: 0,
      overdueCount: 0,
      activeCardsCount: 1,
      invoiceCount: 1,
    },
    filterOptions: {
      cards: [{ id: 2, name: "Nubank" }],
      categories: [{ id: 7, label: "Mercado" }],
      statuses: ["open", "closed", "due_soon", "overdue"],
    },
    invoices: [
      {
        id: "2-2026-04-10",
        card: {
          id: 2,
          slug: "nubank",
          name: "Nubank",
          color: "bg-violet-500",
          statementCloseDay: 10,
          statementDueDay: 20,
          notifyInvoiceClosed: true,
          notifyInvoiceDueSoon: false,
          invoiceDueReminderDays: 3,
        },
        referenceMonth: "2026-04",
        referenceMonthLabel: "Abril de 2026",
        periodStart: "2026-03-11",
        periodEnd: "2026-04-10",
        closingDate: "2026-04-10",
        dueDate: "2026-04-20",
        status: "closed",
        isPaid: false,
        totalAmount: 120,
        formattedTotalAmount: "R$ 120,00",
        transactionCount: 1,
        transactions: [
          {
            id: 101,
            description: "Mercado",
            amount: -120,
            formattedAmount: "- R$ 120,00",
            occurredOn: "2026-04-09",
            relativeDate: "2026-04-09",
            isRecurring: false,
            isRecurringProjection: false,
            sourceTransactionId: 101,
            housingId: null,
            isInstallment: false,
            installmentPurchaseId: null,
            installmentNumber: null,
            installmentCount: null,
            purchaseOccurredOn: null,
            category: {
              id: 7,
              slug: "mercado",
              label: "Mercado",
              iconName: "ShoppingCart",
              icon: vi.fn() as never,
              color: "text-red-500",
              groupSlug: "despesas",
              groupLabel: "Despesas",
              groupColor: "bg-red-500",
            },
            account: {
              id: 2,
              slug: "nubank",
              name: "Nubank",
              accountType: "credit_card",
              color: "bg-violet-500",
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

function renderPage(initialEntry = "/gestao-de-gastos/faturas") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CreditCardInvoicesPage />
    </MemoryRouter>,
  );
}

describe("CreditCardInvoicesPage", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    mockUseInvoices.mockReset();
    mockUpdateSettings.mockReset();
    mockMarkInvoicePaid.mockReset();
    mockUnmarkInvoicePaid.mockReset();
  });

  it("renders empty state with the current month applied by default", () => {
    const currentSelection = getCurrentMonthSelection();
    const defaultRange = resolveMonthYearRange(currentSelection.monthIndex, currentSelection.year);

    mockUseInvoices.mockReturnValue({
      data: createInvoicesData({
        summary: {
          totalAmount: 0,
          formattedTotalAmount: "R$ 0,00",
          dueSoonCount: 0,
          overdueCount: 0,
          activeCardsCount: 0,
          invoiceCount: 0,
        },
        invoices: [],
      }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText("Faturas")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma fatura encontrada para os filtros selecionados.")).toBeInTheDocument();
    expect(mockUseInvoices).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceStart: defaultRange.startDate,
        referenceEnd: defaultRange.endDate,
      }),
    );
  });

  it("renders invoice filters in the page content instead of AppShell headerContent", () => {
    mockUseInvoices.mockReturnValue({
      data: createInvoicesData(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { container } = renderPage();

    expect(screen.getByTestId("app-shell-header-content")).toHaveAttribute("data-present", "false");
    expect(container.querySelector('[data-tour-id="invoices-filters"]')).toBeInTheDocument();
  });

  it("keeps invoice status in advanced filters and shows active count", () => {
    mockUseInvoices.mockReturnValue({
      data: createInvoicesData(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage("/gestao-de-gastos/faturas?status=closed");

    const advancedButton = screen.getByRole("button", { name: /Opções avançadas/ });

    expect(within(advancedButton).getByText("1")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);

    fireEvent.click(advancedButton);

    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    expect(screen.getAllByText("Fechada").length).toBeGreaterThan(0);
  });

  it("applies month, custom period and search filters immediately", async () => {
    const currentSelection = getCurrentMonthSelection();

    mockUseInvoices.mockImplementation((filters: InvoiceFilters) => ({
      data: createInvoicesData({
        appliedFilters: filters,
      }),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Maio" }));

    await waitFor(() => {
      expect(mockUseInvoices).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceStart: `${currentSelection.year}-05-01`,
          referenceEnd: `${currentSelection.year}-05-31`,
        }),
      );
    });

    fireEvent.change(screen.getByPlaceholderText(/Buscar despesa/), {
      target: { value: "mercado" },
    });

    await waitFor(() => {
      expect(mockUseInvoices).toHaveBeenCalledWith(expect.objectContaining({ search: "mercado" }));
    });

    fireEvent.click(screen.getByRole("button", { name: "Período customizado" }));

    await waitFor(() => {
      expect(mockUseInvoices).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceStart: "2026-06-01",
          referenceEnd: "2026-06-30",
        }),
      );
    });
  });

  it("expands invoice cards and shows transaction details", async () => {
    mockUseInvoices.mockReturnValue({
      data: createInvoicesData(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText("Abril de 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Expandir fatura Nubank/ }));
    expect(screen.getAllByText("Mercado").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Configurar" })).toBeInTheDocument();
  });

  it("sends settings modal payload", async () => {
    mockUseInvoices.mockReturnValue({
      data: createInvoicesData(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUpdateSettings.mockResolvedValue({});

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Expandir fatura Nubank/ }));
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar ajustes" }));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        cardId: 2,
        statementCloseDay: 10,
        statementDueDay: 20,
        notifyInvoiceClosed: true,
        notifyInvoiceDueSoon: false,
        invoiceDueReminderDays: 3,
      });
    });
  });

  it("shows mark as paid button for closed invoices", async () => {
    mockUseInvoices.mockReturnValue({
      data: createInvoicesData(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockMarkInvoicePaid.mockResolvedValue({});

    renderPage();

    expect(screen.getByRole("button", { name: "Marcar fatura como paga" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Marcar fatura como paga" }));

    await waitFor(() => {
      expect(mockMarkInvoicePaid).toHaveBeenCalledWith({ cardId: 2, periodEnd: "2026-04-10" });
    });
  });
});
