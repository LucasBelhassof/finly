import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

import { appRoutes } from "@/lib/routes";
import AccountDeletedPage from "@/pages/AccountDeleted";

describe("AccountDeletedPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigateMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the cancellation notice and redirects to login automatically", () => {
    render(<AccountDeletedPage />);

    expect(screen.getByRole("heading", { name: /cancelamento concluído/i })).toBeInTheDocument();
    expect(screen.getByText(/sua conta foi cancelada com sucesso/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(navigateMock).toHaveBeenCalledWith(appRoutes.login, { replace: true });
  });

  it("allows going to login immediately", () => {
    render(<AccountDeletedPage />);

    fireEvent.click(screen.getByRole("button", { name: /ir para login/i }));

    expect(navigateMock).toHaveBeenCalledWith(appRoutes.login, { replace: true });
  });
});
