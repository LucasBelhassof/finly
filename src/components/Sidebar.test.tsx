import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Sidebar from "@/components/Sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { appRoutes } from "@/lib/routes";

vi.mock("@/hooks/use-dashboard", () => ({
  useDashboard: () => ({
    data: {
      user: {
        name: "Joao Silva",
      },
    },
  }),
}));

function renderSidebar(initialPath = appRoutes.dashboard) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SidebarProvider>
        <Sidebar />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

describe("Sidebar", () => {
  it("places transactions as the first expense management submenu item", () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: /gest.o de gastos/i }));

    const transactionsLink = screen.getByRole("link", { name: /transacoes/i });
    const installmentsLink = screen.getByRole("link", { name: /parcelamentos/i });

    expect(transactionsLink).toHaveAttribute("href", appRoutes.transactions);
    expect(transactionsLink.compareDocumentPosition(installmentsLink)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("renders the expense management submenu and links", () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: /gest.o de gastos/i }));

    expect(screen.getByRole("button", { name: /gest.o de gastos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /transacoes/i })).toHaveAttribute("href", appRoutes.transactions);
    expect(screen.getByRole("link", { name: /parcelamentos/i })).toHaveAttribute(
      "href",
      appRoutes.expenseManagementInstallments,
    );
    expect(screen.getByRole("link", { name: /habita..o/i })).toHaveAttribute(
      "href",
      appRoutes.expenseManagementHousing,
    );
    expect(screen.getByRole("link", { name: /m.tricas/i })).toHaveAttribute(
      "href",
      appRoutes.expenseManagementMetrics,
    );
  });

  it("opens and marks expense management active on nested routes", () => {
    renderSidebar(appRoutes.expenseManagementInstallments);

    expect(screen.getByRole("button", { name: /gest.o de gastos/i })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("link", { name: /parcelamentos/i })).toHaveAttribute("data-active", "true");
  });
});
