import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductTourProvider } from "@/modules/product-tour/ProductTourProvider";
import { useProductTour } from "@/modules/product-tour/use-product-tour";

const { setUserStateMock, updateProductTourProgressMock, useAuthSessionMock } = vi.hoisted(() => ({
  setUserStateMock: vi.fn(),
  updateProductTourProgressMock: vi.fn(),
  useAuthSessionMock: vi.fn(),
}));

vi.mock("@/modules/auth/hooks/use-auth-session", () => ({
  useAuthSession: useAuthSessionMock,
}));

vi.mock("@/modules/auth/services/auth-service", () => ({
  updateProductTourProgress: updateProductTourProgressMock,
}));

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    name: "Joao",
    email: "joao@finance.test",
    hasCompletedOnboarding: false,
    onboardingProgress: {
      currentStep: 0,
      completedSteps: [],
      skippedSteps: [],
      dismissed: false,
    },
    ...overrides,
  };
}

function ReplayButton() {
  const { restartTour } = useProductTour();

  return <button onClick={() => void restartTour()}>Reiniciar tour</button>;
}

describe("ProductTourProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    Element.prototype.scrollIntoView = vi.fn();

    updateProductTourProgressMock.mockResolvedValue({
      user: buildUser(),
    });

    useAuthSessionMock.mockReturnValue({
      isAuthenticated: true,
      user: buildUser(),
      setUserState: setUserStateMock,
    });
  });

  it("starts automatically on dashboard for users with pending tour", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ProductTourProvider>
          <div data-tour-id="dashboard-summary">Resumo</div>
        </ProductTourProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("dialog", { name: /resumo financeiro/i })).toBeInTheDocument();
  });

  it("persists dismissed state when the user closes the tour", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ProductTourProvider>
          <div data-tour-id="dashboard-summary">Resumo</div>
        </ProductTourProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /pular tour/i }));

    await waitFor(() => {
      expect(updateProductTourProgressMock).toHaveBeenCalledWith(
        expect.objectContaining({
          dismissed: true,
          currentStep: 0,
        }),
      );
    });
  });

  it("allows replaying the tour manually", async () => {
    render(
      <MemoryRouter initialEntries={["/accounts"]}>
        <ProductTourProvider>
          <ReplayButton />
        </ProductTourProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /reiniciar tour/i }));

    await waitFor(() => {
      expect(updateProductTourProgressMock).toHaveBeenCalledWith({
        currentStep: 0,
        completedSteps: [],
        skippedSteps: [],
        dismissed: false,
      });
    });
  });

  it("skips predictably when a target is missing", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ProductTourProvider>
          <div>Sem target do primeiro passo</div>
        </ProductTourProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(updateProductTourProgressMock).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: 1,
          skippedSteps: ["dashboard_overview"],
        }),
      );
    }, { timeout: 1500 });
  }, 10000);
});
