import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PremiumGate } from "@/components/premium/PremiumGate";

const { useAuthContextMock } = vi.hoisted(() => ({
  useAuthContextMock: vi.fn(),
}));

vi.mock("@/modules/auth/components/AuthProvider", () => ({
  useAuthContext: useAuthContextMock,
}));

describe("PremiumGate", () => {
  it("renders children without overlay for premium users", () => {
    useAuthContextMock.mockReturnValue({
      user: { isPremium: true },
    });

    render(
      <PremiumGate featureLabel="Chat IA">
        <div>Conteúdo premium</div>
      </PremiumGate>,
    );

    expect(screen.getByText("Conteúdo premium")).toBeInTheDocument();
    expect(screen.queryByText(/disponível apenas na versão premium/i)).not.toBeInTheDocument();
  });

  it("renders blur and overlay for free users", () => {
    useAuthContextMock.mockReturnValue({
      user: { isPremium: false },
    });

    render(
      <PremiumGate featureLabel="Chat IA" description="Faça upgrade para desbloquear o chat.">
        <button type="button">Enviar mensagem</button>
      </PremiumGate>,
    );

    expect(screen.getByText(/disponível apenas na versão premium/i)).toBeInTheDocument();
    expect(screen.getByText(/faça upgrade para desbloquear o chat/i)).toBeInTheDocument();
    expect(screen.getByTestId("premium-gate-blurred")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("premium-gate-overlay")).toBeInTheDocument();
  });

  it("renders inline fallback for free users in inline mode", () => {
    useAuthContextMock.mockReturnValue({
      user: { isPremium: false },
    });

    render(
      <PremiumGate featureLabel="Insights" mode="inline">
        <button type="button">Gerar insight</button>
      </PremiumGate>,
    );

    expect(screen.getByText(/disponível apenas na versão premium/i)).toBeInTheDocument();
    expect(screen.queryByText("Gerar insight")).not.toBeInTheDocument();
  });
});
