import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AccountsPage from "@/pages/Accounts";
import { appRoutes } from "@/lib/routes";

const mockCreateBank = vi.fn();
const mockUpdateBank = vi.fn();
const mockUseBanks = vi.fn();

vi.mock("@/hooks/use-banks", () => ({
  useBanks: () => mockUseBanks(),
  useCreateBankConnection: () => ({
    mutateAsync: mockCreateBank,
    isPending: false,
  }),
  useUpdateBankConnection: () => ({
    mutateAsync: mockUpdateBank,
    isPending: false,
  }),
  useDeleteBankConnection: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/modules/auth/hooks/use-auth-session", () => ({
  useAuthSession: () => ({
    user: { isPremium: false },
  }),
}));

vi.mock("@/components/AppShell", () => ({
  default: ({ children, title }: { children: ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/color-field", () => ({
  ColorField: ({ value }: { value: string }) => <span>{value}</span>,
}));

const defaultBanks = [
  {
    id: 1,
    slug: "conta-principal",
    name: "Conta Principal",
    accountType: "bank_account",
    parentBankConnectionId: null,
    parentAccountName: null,
    statementCloseDay: null,
    statementDueDay: null,
    notifyInvoiceClosed: false,
    notifyInvoiceDueSoon: false,
    invoiceDueReminderDays: 3,
    connected: true,
    color: "bg-blue-500",
    currentBalance: 1000,
    formattedBalance: "R$ 1.000,00",
    creditLimit: null,
    formattedCreditLimit: null,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountsPage />
    </MemoryRouter>,
  );
}

describe("AccountsPage invoice preferences", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    mockUseBanks.mockReturnValue({
      data: defaultBanks,
      isLoading: false,
      isError: false,
    });
  });

  afterEach(() => {
    mockCreateBank.mockReset();
    mockUpdateBank.mockReset();
    mockUseBanks.mockReset();
  });

  it("keeps invoice preference fields in the bank creation payload", async () => {
    mockCreateBank.mockResolvedValue({});

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Novo cartão" }));
    fireEvent.change(screen.getByPlaceholderText("Nome da conta ou cartão"), {
      target: { value: "Nubank" },
    });
    fireEvent.change(screen.getByPlaceholderText("Limite total do cartão"), {
      target: { value: "5000" },
    });
    fireEvent.click(screen.getAllByRole("combobox")[1]);
    fireEvent.click(await screen.findByRole("option", { name: "Conta Principal" }));
    fireEvent.change(screen.getByPlaceholderText("Dia de fechamento"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByPlaceholderText("Dia de vencimento"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByRole("switch", { name: /notificar vencimento próximo/i }));
    fireEvent.change(screen.getByPlaceholderText("Dias antes do vencimento"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(mockCreateBank).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Nubank",
          accountType: "credit_card",
          parentBankConnectionId: "1",
          statementCloseDay: 10,
          statementDueDay: 20,
          notifyInvoiceClosed: false,
          notifyInvoiceDueSoon: true,
          invoiceDueReminderDays: 5,
        }),
      );
    });
  });

  it("shows setup and premium CTAs in the support panel for free users", () => {
    renderPage();

    expect(screen.getByText("Próximos passos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Importar extrato" })).toHaveAttribute("href", appRoutes.transactions);
    expect(screen.getByRole("link", { name: "Conhecer Premium" })).toHaveAttribute("href", appRoutes.pricing);
  });

  it("shows account creation CTAs when no accounts exist", () => {
    mockUseBanks.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getAllByRole("button", { name: "Criar conta ou cartão" }).length).toBeGreaterThan(0);
  });
});
