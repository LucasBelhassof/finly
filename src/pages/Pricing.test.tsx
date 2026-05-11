import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PricingPage from "@/pages/Pricing";
import { appRoutes } from "@/lib/routes";

const mockNavigate = vi.fn();
const mockToast = vi.fn();
const mockCompleteActionStep = vi.fn();
const mockUseAuthSession = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/components/ui/sonner", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock("@/modules/auth/hooks/use-auth-session", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

vi.mock("@/modules/auth/hooks/use-action-onboarding-progress", () => ({
  useActionOnboardingProgress: () => ({
    completeActionStep: mockCompleteActionStep,
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    className,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} data-variant={variant} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: ReactNode; className?: string }) => (
    <section className={className}>{children}</section>
  ),
  CardHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  CardFooter: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <PricingPage />
    </MemoryRouter>,
  );
}

describe("PricingPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockToast.mockReset();
    mockCompleteActionStep.mockReset();
    mockUseAuthSession.mockReturnValue({
      user: {
        id: 1,
        isPremium: false,
      },
    });
  });

  it("marks the premium checklist step as complete for authenticated users", () => {
    renderPage();

    expect(mockCompleteActionStep).toHaveBeenCalledWith("premium");
  });

  it("keeps the billing placeholder behavior for free authenticated users", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Assinar Premium/i }));

    expect(mockToast).toHaveBeenCalledWith("Assinatura online em breve.");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("sends unauthenticated users to signup from the free CTA", () => {
    mockUseAuthSession.mockReturnValue({
      user: null,
    });

    renderPage();

    fireEvent.click(screen.getAllByRole("button", { name: /Começar grátis/i })[0]!);

    expect(mockNavigate).toHaveBeenCalledWith(appRoutes.signup);
  });
});
