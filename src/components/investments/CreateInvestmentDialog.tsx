import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { useBanks } from "@/hooks/use-banks";
import { useCreateInvestment } from "@/hooks/use-investments";
import type { InvestmentContributionMode, InvestmentItem } from "@/types/api";
import {
  buildEmptyInvestmentCoreForm,
  getInvestmentCoreFormError,
  NO_BANK_CONNECTION_VALUE,
  normalizeInvestmentCoreForm,
  type InvestmentCoreFormState,
} from "@/components/investments/investment-form-utils";

const MODAL_SELECT_TRIGGER_CLASSNAME = "h-10 rounded-md border-border/60 bg-background";

type CreateInvestmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (investment: InvestmentItem) => void;
  initialValues?: Partial<InvestmentCoreFormState>;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function CreateInvestmentDialog({
  open,
  onOpenChange,
  onCreated,
  initialValues,
}: CreateInvestmentDialogProps) {
  const { data: banks = [] } = useBanks(open);
  const createInvestment = useCreateInvestment();
  const initialForm = useMemo(
    () => ({
      ...buildEmptyInvestmentCoreForm(),
      ...initialValues,
    }),
    [initialValues],
  );
  const [form, setForm] = useState<InvestmentCoreFormState>(() => initialForm);

  useEffect(() => {
    if (open) {
      setForm(initialForm);
    }
  }, [initialForm, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setForm(buildEmptyInvestmentCoreForm());
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = getInvestmentCoreFormError(form);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const createdInvestment = await createInvestment.mutateAsync(normalizeInvestmentCoreForm(form));
      toast.success("Caixinha criada.");
      onCreated(createdInvestment);
      handleOpenChange(false);
    } catch (error) {
      toast.error("Não foi possível criar a caixinha.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova caixinha</DialogTitle>
          <DialogDescription>
            Os campos foram sugeridos com base no planejamento atual e continuam editaveis antes de criar a caixinha.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="create-investment-name" className="text-sm font-medium text-foreground">
              Nome
            </label>
            <Input
              id="create-investment-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="create-investment-description" className="text-sm font-medium text-foreground">
              Descrição
            </label>
            <Textarea
              id="create-investment-description"
              rows={3}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Modo de aporte</label>
              <Select
                value={form.contributionMode}
                onValueChange={(value: InvestmentContributionMode) =>
                  setForm((current) => ({
                    ...current,
                    contributionMode: value,
                    fixedAmount: value === "fixed_amount" ? current.fixedAmount : "",
                    incomePercentage: value === "income_percentage" ? current.incomePercentage : "",
                  }))
                }
              >
                <SelectTrigger className={MODAL_SELECT_TRIGGER_CLASSNAME}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_amount">Valor fixo</SelectItem>
                  <SelectItem value="income_percentage">% da receita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="create-investment-contribution-value" className="text-sm font-medium text-foreground">
                {form.contributionMode === "income_percentage" ? "Percentual da receita" : "Valor do aporte"}
              </label>
              <Input
                id="create-investment-contribution-value"
                inputMode="decimal"
                value={form.contributionMode === "income_percentage" ? form.incomePercentage : form.fixedAmount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [current.contributionMode === "income_percentage" ? "incomePercentage" : "fixedAmount"]:
                      event.target.value,
                  }))
                }
                placeholder={form.contributionMode === "income_percentage" ? "Ex.: 15" : "Ex.: 500,00"}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="create-investment-current-amount" className="text-sm font-medium text-foreground">
                Saldo atual
              </label>
              <Input
                id="create-investment-current-amount"
                inputMode="decimal"
                value={form.currentAmount}
                onChange={(event) => setForm((current) => ({ ...current, currentAmount: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="create-investment-target-amount" className="text-sm font-medium text-foreground">
                Meta da caixinha
              </label>
              <Input
                id="create-investment-target-amount"
                inputMode="decimal"
                value={form.targetAmount}
                onChange={(event) => setForm((current) => ({ ...current, targetAmount: event.target.value }))}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Conta vinculada</label>
            <Select
              value={form.bankConnectionId}
              onValueChange={(value) => setForm((current) => ({ ...current, bankConnectionId: value }))}
            >
              <SelectTrigger className={MODAL_SELECT_TRIGGER_CLASSNAME}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BANK_CONNECTION_VALUE}>Nenhuma</SelectItem>
                {banks.map((bank) => (
                  <SelectItem key={bank.id} value={String(bank.id)}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createInvestment.isPending}>
              Criar caixinha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
