import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreateInvestmentDialog from "@/components/investments/CreateInvestmentDialog";

const mockUseBanks = vi.fn();
const mockUseCreateInvestment = vi.fn();
const mockOnCreated = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock("@/hooks/use-banks", () => ({
  useBanks: (...args: unknown[]) => mockUseBanks(...args),
}));

vi.mock("@/hooks/use-investments", () => ({
  useCreateInvestment: (...args: unknown[]) => mockUseCreateInvestment(...args),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) => <>{open ? children : null}</>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder}</>,
}));

describe("CreateInvestmentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBanks.mockReturnValue({
      data: [
        {
          id: 1,
          name: "Itau",
        },
      ],
    });
    mockUseCreateInvestment.mockReturnValue({
      isPending: false,
      mutateAsync: mockMutateAsync.mockResolvedValue({
        id: 99,
        name: "Reserva",
        description: "",
        contributionMode: "fixed_amount",
        fixedAmount: 500,
        incomePercentage: null,
        currentAmount: 0,
        formattedCurrentAmount: "R$ 0,00",
        targetAmount: null,
        formattedTargetAmount: null,
        status: "active",
        color: null,
        notes: "",
        bank: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    });
  });

  it("creates an investment and returns it to the caller", async () => {
    render(<CreateInvestmentDialog open onOpenChange={vi.fn()} onCreated={mockOnCreated} />);

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "Reserva" },
    });
    fireEvent.change(screen.getByLabelText("Valor do aporte"), {
      target: { value: "500,00" },
    });
    fireEvent.change(screen.getByLabelText("Saldo atual"), {
      target: { value: "0" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Criar caixinha" }).closest("form")!);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Reserva",
          contributionMode: "fixed_amount",
          fixedAmount: 500,
          currentAmount: 0,
          status: "active",
        }),
      );
    });
    expect(mockOnCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 99,
        name: "Reserva",
      }),
    );
  });

  it("prefills editable fields from the planning context", () => {
    render(
      <CreateInvestmentDialog
        open
        onOpenChange={vi.fn()}
        onCreated={mockOnCreated}
        initialValues={{
          name: "Viagem 2027",
          description: "Meta sugerida pelo planejamento",
          fixedAmount: "300,00",
          currentAmount: "50,00",
          targetAmount: "1200,00",
        }}
      />,
    );

    expect(screen.getByLabelText("Nome")).toHaveValue("Viagem 2027");
    expect(screen.getByLabelText("Descrição")).toHaveValue("Meta sugerida pelo planejamento");
    expect(screen.getByLabelText("Valor do aporte")).toHaveValue("300,00");
    expect(screen.getByLabelText("Saldo atual")).toHaveValue("50,00");
    expect(screen.getByLabelText("Meta da caixinha")).toHaveValue("1200,00");
  });
});
