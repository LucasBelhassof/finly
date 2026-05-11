import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OnboardingPage from "@/pages/Onboarding";

const mockNavigate = vi.fn();
const mockRestartTour = vi.fn();
const mockUseBanks = vi.fn();
const mockUseTransactions = vi.fn();
const mockUseCategories = vi.fn();
const mockUseDashboard = vi.fn();
const mockUseAuthSession = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/hooks/use-banks", () => ({
  useBanks: () => mockUseBanks(),
}));

vi.mock("@/hooks/use-transactions", () => ({
  useTransactions: () => mockUseTransactions(),
  useCategories: () => mockUseCategories(),
}));

vi.mock("@/hooks/use-dashboard", () => ({
  useDashboard: () => mockUseDashboard(),
}));

vi.mock("@/modules/auth/hooks/use-auth-session", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

vi.mock("@/modules/product-tour/use-product-tour", () => ({
  useProductTour: () => ({
    restartTour: mockRestartTour,
  }),
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/primeiros-passos"]}>
      <OnboardingPage />
    </MemoryRouter>,
  );
}

describe("OnboardingPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRestartTour.mockReset();

    mockUseAuthSession.mockReturnValue({
      user: {
        isPremium: false,
      },
    });

    mockUseBanks.mockReturnValue({
      data: [
        {
          id: 10,
          slug: "caixa-padrao",
          name: "Caixa",
          accountType: "cash",
        },
      ],
      isLoading: false,
    });

    mockUseTransactions.mockReturnValue({
      data: [],
      isLoading: false,
    });

    mockUseCategories.mockReturnValue({
      data: [
        {
          id: 1,
          label: "Compras",
          transactionType: "expense",
        },
      ],
      isLoading: false,
    });

    mockUseDashboard.mockReturnValue({
      data: {
        banks: [],
        recentTransactions: [],
        spendingByCategory: [],
      },
      isLoading: false,
    });
  });

  it("keeps account setup pending when the user only has a cash account", () => {
    renderPage();

    expect(screen.getAllByText("Pendente").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Criar conta ou cartão" })).toBeInTheDocument();
    expect(screen.getByText("0/5")).toBeInTheDocument();
  });

  it("marks practical steps as complete when useful accounts and transactions already exist", () => {
    mockUseBanks.mockReturnValue({
      data: [
        {
          id: 1,
          slug: "conta-principal",
          name: "Conta Principal",
          accountType: "bank_account",
        },
      ],
      isLoading: false,
    });

    mockUseTransactions.mockReturnValue({
      data: [
        {
          id: 1,
          description: "Mercado",
        },
      ],
      isLoading: false,
    });

    mockUseDashboard.mockReturnValue({
      data: {
        banks: [
          {
            id: 1,
            slug: "conta-principal",
            name: "Conta Principal",
            accountType: "bank_account",
          },
        ],
        recentTransactions: [{ id: 1, description: "Mercado" }],
        spendingByCategory: [],
      },
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText("4/5")).toBeInTheDocument();
    expect(screen.getByText("Próxima ação recomendada: Conhecer Premium.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revisar contas" })).toBeInTheDocument();
  });

  it("uses persisted action progress for dashboard and premium understanding", () => {
    mockUseAuthSession.mockReturnValue({
      user: {
        isPremium: false,
        onboardingProgress: {
          actionChecklist: {
            completedSteps: ["dashboard", "premium"],
          },
        },
      },
    });

    renderPage();

    expect(screen.getByText("2/5")).toBeInTheDocument();
    expect(screen.getByText("Próxima ação recomendada: Criar conta ou cartão.")).toBeInTheDocument();
  });

  it("navigates to the next action and keeps the product tour available", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Criar conta ou cartão" }));
    fireEvent.click(screen.getByRole("button", { name: "Fazer tour do produto" }));

    expect(mockNavigate).toHaveBeenCalled();
    expect(mockRestartTour).toHaveBeenCalled();
  });
});
