import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HousingPage from "@/pages/Housing";

const mockCreateHousing = vi.fn();
const mockUpdateHousing = vi.fn();
const mockDeleteHousing = vi.fn();

const housingItems = [
  {
    id: 99,
    description: "Financiamento do carro",
    expenseType: "vehicle_financing",
    amount: 1500,
    formattedAmount: "R$ 1.500,00",
    dueDay: 10,
    startDate: "2026-04-10",
    installmentCount: 24,
    notes: "",
    status: "active",
    bank: {
      id: 10,
      slug: "itau",
      name: "Itau",
      accountType: "bank_account",
      color: "bg-primary",
    },
    category: {
      id: 20,
      slug: "moradia",
      label: "Moradia",
      iconName: "Home",
      icon: vi.fn(),
      color: "text-primary",
      groupSlug: "moradia",
      groupLabel: "Moradia",
      groupColor: "bg-primary",
    },
    installmentPurchaseId: 30,
    transactionIds: [101, 102],
    transactions: [],
  },
];

vi.mock("@/components/AppShell", () => ({
  default: ({ children, title }: { children: ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/ui/date-picker-input", () => ({
  DatePickerInput: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => <input aria-label={placeholder ?? "data"} value={value} onChange={(event) => onChange(event.target.value)} />,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <select value={value} onChange={(event) => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

vi.mock("@/hooks/use-banks", () => ({
  useBanks: () => ({
    data: [
      {
        id: 10,
        slug: "itau",
        name: "Itau",
        accountType: "bank_account",
        parentBankConnectionId: null,
        parentAccountName: null,
        statementCloseDay: null,
        statementDueDay: null,
        connected: true,
        color: "bg-primary",
        currentBalance: 1000,
        formattedBalance: "R$ 1.000,00",
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-transactions", () => ({
  useCategories: () => ({
    data: [
      {
        id: 20,
        slug: "moradia",
        label: "Moradia",
        transactionType: "expense",
        iconName: "Home",
        icon: vi.fn(),
        color: "text-primary",
        groupSlug: "moradia",
        groupLabel: "Moradia",
        groupColor: "bg-primary",
      },
    ],
  }),
}));

vi.mock("@/hooks/use-housing", () => ({
  useHousing: () => ({
    data: housingItems,
    isLoading: false,
    isError: false,
  }),
  useCreateHousing: () => ({
    mutateAsync: mockCreateHousing,
    isPending: false,
  }),
  useUpdateHousing: () => ({
    mutateAsync: mockUpdateHousing,
    isPending: false,
  }),
  useDeleteHousing: () => ({
    mutateAsync: mockDeleteHousing,
    isPending: false,
  }),
}));

describe("HousingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateHousing.mockResolvedValue(housingItems[0]);
    mockUpdateHousing.mockResolvedValue(housingItems[0]);
    mockDeleteHousing.mockResolvedValue(undefined);
  });

  it("creates a housing expense through the housing API", async () => {
    render(<HousingPage />);

    fireEvent.change(screen.getByPlaceholderText(/financiamento do apartamento/i), {
      target: { value: "Aluguel" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "rent" },
    });
    fireEvent.change(screen.getByPlaceholderText(/valor mensal/i), {
      target: { value: "2000,00" },
    });
    fireEvent.change(screen.getByLabelText(/selecione a data da cobranca/i), {
      target: { value: "2026-04-05" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /adicionar despesa/i }));

    await waitFor(() => {
      expect(mockCreateHousing).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Aluguel",
          expenseType: "rent",
          amount: 2000,
          dueDay: 5,
          startDate: "2026-04-05",
          bankConnectionId: "10",
          categoryId: 20,
          installmentCount: null,
        }),
      );
    });
  });

  it("requires installment count for financing expenses", async () => {
    render(<HousingPage />);

    fireEvent.change(screen.getByPlaceholderText(/financiamento do apartamento/i), {
      target: { value: "Financiamento do carro" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "vehicle_financing" },
    });
    fireEvent.change(screen.getByPlaceholderText(/valor mensal/i), {
      target: { value: "1500,00" },
    });
    fireEvent.change(screen.getByLabelText(/selecione a data da cobranca/i), {
      target: { value: "2026-04-10" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /adicionar despesa/i }));

    expect(mockCreateHousing).not.toHaveBeenCalled();
  });

  it("updates and deletes persisted housing expenses", async () => {
    render(<HousingPage />);

    fireEvent.click(screen.getByRole("button", { name: /editar financiamento do carro/i }));
    fireEvent.change(screen.getByPlaceholderText(/valor mensal/i), {
      target: { value: "1700,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salvar alteracoes/i }));

    await waitFor(() => {
      expect(mockUpdateHousing).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 99,
          description: "Financiamento do carro",
          expenseType: "vehicle_financing",
          amount: 1700,
          installmentCount: 24,
          bankConnectionId: "10",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /excluir financiamento do carro/i }));

    await waitFor(() => {
      expect(mockDeleteHousing).toHaveBeenCalledWith(99);
    });
  });
});
