import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HousingPage from "@/pages/Housing";

const mockCreateTransaction = vi.fn();
const mockUpdateTransaction = vi.fn();
const mockDeleteTransaction = vi.fn();

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
  useCreateTransaction: () => ({
    mutateAsync: mockCreateTransaction,
    isPending: false,
  }),
  useUpdateTransaction: () => ({
    mutateAsync: mockUpdateTransaction,
    isPending: false,
  }),
  useDeleteTransaction: () => ({
    mutateAsync: mockDeleteTransaction,
    isPending: false,
  }),
}));

describe("HousingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTransaction.mockResolvedValue({ id: 99 });
    mockUpdateTransaction.mockResolvedValue({ id: 99 });
    mockDeleteTransaction.mockResolvedValue(undefined);
  });

  it("creates a transaction when adding a housing recurring expense", async () => {
    render(<HousingPage />);

    fireEvent.change(screen.getByPlaceholderText(/financiamento do apartamento/i), {
      target: { value: "Financiamento do carro" },
    });
    fireEvent.change(screen.getByPlaceholderText(/valor mensal/i), {
      target: { value: "1500,00" },
    });
    fireEvent.change(screen.getByPlaceholderText("Dia"), {
      target: { value: "10" },
    });

    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /adicionar despesa/i }));

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Financiamento do carro",
          amount: -1500,
          bankConnectionId: "10",
          categoryId: 20,
        }),
      );
    });
  });

  it("updates the linked transaction when editing a housing expense", async () => {
    render(<HousingPage />);

    fireEvent.change(screen.getByPlaceholderText(/financiamento do apartamento/i), {
      target: { value: "Financiamento do carro" },
    });
    fireEvent.change(screen.getByPlaceholderText(/valor mensal/i), {
      target: { value: "1500,00" },
    });
    fireEvent.change(screen.getByPlaceholderText("Dia"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /adicionar despesa/i }));

    await screen.findByText(/lancada em transacoes #99/i);

    fireEvent.click(screen.getByRole("button", { name: /editar financiamento do carro/i }));
    fireEvent.change(screen.getByPlaceholderText(/valor mensal/i), {
      target: { value: "1700,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salvar alteracoes/i }));

    await waitFor(() => {
      expect(mockUpdateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "99",
          description: "Financiamento do carro",
          amount: -1700,
          bankConnectionId: "10",
          categoryId: 20,
        }),
      );
    });
  });

  it("deletes the linked transaction when deleting a housing expense", async () => {
    render(<HousingPage />);

    fireEvent.change(screen.getByPlaceholderText(/financiamento do apartamento/i), {
      target: { value: "Aluguel" },
    });
    fireEvent.change(screen.getByPlaceholderText(/valor mensal/i), {
      target: { value: "2000,00" },
    });
    fireEvent.change(screen.getByPlaceholderText("Dia"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /adicionar despesa/i }));

    await screen.findByText(/lancada em transacoes #99/i);
    fireEvent.click(screen.getByRole("button", { name: /excluir aluguel/i }));

    await waitFor(() => {
      expect(mockDeleteTransaction).toHaveBeenCalledWith("99");
    });
    expect(screen.queryByText(/lancada em transacoes #99/i)).not.toBeInTheDocument();
  });
});
