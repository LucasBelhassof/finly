import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App";
import { appRoutes } from "@/lib/routes";

vi.mock("./pages/Accounts.tsx", () => ({ default: () => <h1>Contas</h1> }));
vi.mock("./pages/Chat.tsx", () => ({ default: () => <h1>Chat IA</h1> }));
vi.mock("./pages/ExpenseMetrics.tsx", () => ({ default: () => <h1>Métricas</h1> }));
vi.mock("./pages/Housing.tsx", () => ({ default: () => <h1>Habitação</h1> }));
vi.mock("./pages/Installments.tsx", () => ({ default: () => <h1>Parcelamentos</h1> }));
vi.mock("./pages/Index.tsx", () => ({ default: () => <h1>Dashboard</h1> }));
vi.mock("./pages/Insights.tsx", () => ({ default: () => <h1>Insights</h1> }));
vi.mock("./pages/NotFound.tsx", () => ({ default: () => <h1>Not found</h1> }));
vi.mock("./pages/Profile.tsx", () => ({ default: () => <h1>Perfil</h1> }));
vi.mock("./pages/Settings.tsx", () => ({ default: () => <h1>Configuracoes</h1> }));
vi.mock("./pages/Transactions.tsx", () => ({ default: () => <h1>Transacoes</h1> }));

describe("App routes", () => {
  beforeEach(() => {
    window.history.pushState({}, "", appRoutes.dashboard);
  });

  it("redirects the legacy installments route to expense management installments", async () => {
    window.history.pushState({}, "", appRoutes.installments);

    render(<App />);

    expect(await screen.findByRole("heading", { name: /parcelamentos/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe(appRoutes.expenseManagementInstallments);
  });

  it("redirects the legacy financing route to housing", async () => {
    window.history.pushState({}, "", appRoutes.expenseManagementFinancing);

    render(<App />);

    expect(await screen.findByRole("heading", { name: /habitação/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe(appRoutes.expenseManagementHousing);
  });

  it("renders the housing route", async () => {
    window.history.pushState({}, "", appRoutes.expenseManagementHousing);

    render(<App />);

    expect(await screen.findByRole("heading", { name: /habitação/i })).toBeInTheDocument();
  });

  it("renders the metrics placeholder route", async () => {
    window.history.pushState({}, "", appRoutes.expenseManagementMetrics);

    render(<App />);

    expect(await screen.findByRole("heading", { name: /métricas/i })).toBeInTheDocument();
  });
});
