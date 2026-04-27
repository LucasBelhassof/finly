import { FormEvent, useMemo, useState } from "react";
import { Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";

import AppShell from "@/components/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  buildEmptyInvestmentCoreForm,
  formatDecimalInput,
  getInvestmentCoreFormError,
  normalizeInvestmentCoreForm,
  type InvestmentCoreFormState,
} from "@/components/investments/investment-form-utils";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useBanks } from "@/hooks/use-banks";
import { useCreateInvestment, useDeleteInvestment, useInvestments, useUpdateInvestment } from "@/hooks/use-investments";
import { useCreatePlan, usePlans, useUpdatePlan } from "@/hooks/use-plans";
import type {
  CreateInvestmentInput,
  InvestmentContributionMode,
  InvestmentItem,
  InvestmentStatus,
  PlanGoal,
  PlanItemStatus,
  PlanPriority,
  UpdateInvestmentInput,
} from "@/types/api";

type InvestmentFormState = {
  planLinkMode: "none" | "existing_manual" | "new_manual";
  existingPlanId: string;
  manualGoalTargetAmount: string;
  manualGoalStartDate: string;
  manualGoalEndDate: string;
  manualPlanTitle: string;
  manualPlanDescription: string;
  manualPlanItems: Array<{
    title: string;
    description: string;
    status: PlanItemStatus;
    priority: PlanPriority;
  }>;
} & InvestmentCoreFormState;

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthRange() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    startDate: formatInputDate(firstDay),
    endDate: formatInputDate(lastDay),
  };
}

function buildDefaultPlanItem() {
  return {
    title: "",
    description: "",
    status: "todo" as const,
    priority: "medium" as const,
  };
}

function buildEmptyForm(): InvestmentFormState {
  const range = getCurrentMonthRange();

  return {
    ...buildEmptyInvestmentCoreForm(),
    planLinkMode: "none",
    existingPlanId: "",
    manualGoalTargetAmount: "",
    manualGoalStartDate: range.startDate,
    manualGoalEndDate: range.endDate,
    manualPlanTitle: "",
    manualPlanDescription: "",
    manualPlanItems: [buildDefaultPlanItem()],
  };
}

function createFormFromInvestment(investment: InvestmentItem): InvestmentFormState {
  return {
    ...buildEmptyInvestmentCoreForm(),
    name: investment.name,
    description: investment.description,
    contributionMode: investment.contributionMode,
    fixedAmount: formatDecimalInput(investment.fixedAmount),
    incomePercentage: formatDecimalInput(investment.incomePercentage),
    currentAmount: formatDecimalInput(investment.currentAmount),
    targetAmount: formatDecimalInput(investment.targetAmount),
    status: investment.status,
    color: investment.color ?? "",
    notes: investment.notes,
    bankConnectionId: investment.bank ? String(investment.bank.id) : "none",
    planLinkMode: "none",
    existingPlanId: "",
    manualGoalTargetAmount: formatDecimalInput(investment.targetAmount),
    manualGoalStartDate: getCurrentMonthRange().startDate,
    manualGoalEndDate: getCurrentMonthRange().endDate,
    manualPlanTitle: "",
    manualPlanDescription: "",
    manualPlanItems: [buildDefaultPlanItem()],
  };
}
function getFormError(form: InvestmentFormState) {
  const coreFormError = getInvestmentCoreFormError(form);

  if (coreFormError) {
    return coreFormError;
  }

  if (form.planLinkMode !== "none") {
    const goalTargetAmount = parseDecimalInput(form.manualGoalTargetAmount);

    if (!Number.isFinite(goalTargetAmount) || goalTargetAmount <= 0) {
      return "Informe o valor da meta financeira para o planejamento manual.";
    }

    if (!form.manualGoalStartDate || !form.manualGoalEndDate) {
      return "Informe o periodo da meta financeira para o planejamento manual.";
    }

    if (form.manualGoalStartDate > form.manualGoalEndDate) {
      return "A data inicial da meta deve ser anterior a data final.";
    }
  }

  if (form.planLinkMode === "existing_manual" && !form.existingPlanId) {
    return "Selecione um planejamento manual para vincular a caixinha.";
  }

  if (form.planLinkMode === "new_manual") {
    if (!form.manualPlanTitle.trim()) {
      return "Informe o titulo do novo planejamento manual.";
    }

    const filledItems = form.manualPlanItems.filter((item) => item.title.trim());

    if (!filledItems.length) {
      return "Adicione pelo menos um item no novo planejamento manual.";
    }
  }

  return null;
}

function buildManualPlanGoal(form: InvestmentFormState, investmentId: number | string): PlanGoal {
  return {
    type: "transaction_sum",
    source: "manual",
    targetAmount: Number(parseDecimalInput(form.manualGoalTargetAmount).toFixed(2)),
    transactionType: "income",
    targetModel: "investment_box",
    categoryIds: [],
    investmentBoxId: investmentId,
    investmentBox: null,
    investmentBoxIds: [investmentId],
    investmentBoxes: [],
    startDate: form.manualGoalStartDate,
    endDate: form.manualGoalEndDate,
  };
}
export default function InvestmentsPage() {
  const { data: investments = [], isLoading, isError } = useInvestments();
  const { data: plans = [] } = usePlans();
  const { data: banks = [] } = useBanks();
  const createInvestment = useCreateInvestment();
  const updateInvestment = useUpdateInvestment();
  const deleteInvestment = useDeleteInvestment();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<InvestmentItem | null>(null);
  const [form, setForm] = useState<InvestmentFormState>(buildEmptyForm());
  const [deletingInvestment, setDeletingInvestment] = useState<InvestmentItem | null>(null);

  const manualPlans = useMemo(
    () => plans.filter((plan) => plan.source === "manual"),
    [plans],
  );

  const linkedManualPlansByInvestmentId = useMemo(() => {
    const map = new Map<string, Array<{ id: string; title: string }>>();

    for (const plan of manualPlans) {
      if (plan.goal.targetModel !== "investment_box" || (!plan.goal.investmentBoxId && !plan.goal.investmentBoxIds.length)) {
        continue;
      }

      const investmentIds = plan.goal.investmentBoxIds.length ? plan.goal.investmentBoxIds : [plan.goal.investmentBoxId];

      for (const investmentId of investmentIds) {
        if (!investmentId) {
          continue;
        }

        const key = String(investmentId);
        const current = map.get(key) ?? [];
        current.push({ id: plan.id, title: plan.title });
        map.set(key, current);
      }
    }

    return map;
  }, [manualPlans]);

  const summary = useMemo(() => {
    const totalCurrentAmount = investments.reduce((sum, item) => sum + item.currentAmount, 0);
    const totalTargetAmount = investments.reduce((sum, item) => sum + (item.targetAmount ?? 0), 0);
    const activeCount = investments.filter((item) => item.status === "active").length;

    return {
      totalCurrentAmount,
      totalTargetAmount,
      activeCount,
    };
  }, [investments]);

  const openCreateDialog = () => {
    setEditingInvestment(null);
    setForm(buildEmptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (investment: InvestmentItem) => {
    setEditingInvestment(investment);
    setForm(createFormFromInvestment(investment));
    setDialogOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = getFormError(form);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      if (editingInvestment) {
        const payload: UpdateInvestmentInput = {
          id: editingInvestment.id,
          ...normalizeInvestmentCoreForm(form),
        };

        await updateInvestment.mutateAsync(payload);
        toast.success("Caixinha atualizada.");
      } else {
        const createdInvestment = await createInvestment.mutateAsync(normalizeInvestmentCoreForm(form));

        if (form.planLinkMode === "existing_manual") {
          const goal = buildManualPlanGoal(form, createdInvestment.id);
          await updatePlan.mutateAsync({
            planId: form.existingPlanId,
            goal,
          });

          toast.success("Caixinha criada e vinculada ao planejamento manual.");
        } else if (form.planLinkMode === "new_manual") {
          const goal = buildManualPlanGoal(form, createdInvestment.id);
          await createPlan.mutateAsync({
            title: form.manualPlanTitle.trim(),
            description: form.manualPlanDescription.trim(),
            source: "manual",
            goal,
            items: form.manualPlanItems
              .filter((item) => item.title.trim())
              .map((item, index) => ({
                title: item.title.trim(),
                description: item.description.trim(),
                status: item.status,
                priority: item.priority,
                sortOrder: index,
              })),
          });

          toast.success("Caixinha e planejamento manual criados com sucesso.");
        } else {
          toast.success("Caixinha criada.");
        }
      }

      setDialogOpen(false);
      setEditingInvestment(null);
      setForm(buildEmptyForm());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar a caixinha.");
    }
  };

  const updateManualItem = (
    index: number,
    item: Partial<InvestmentFormState["manualPlanItems"][number]>,
  ) => {
    setForm((current) => ({
      ...current,
      manualPlanItems: current.manualPlanItems.map((currentItem, currentIndex) =>
        currentIndex === index ? { ...currentItem, ...item } : currentItem,
      ),
    }));
  };

  const addManualItem = () => {
    setForm((current) => ({
      ...current,
      manualPlanItems: [...current.manualPlanItems, buildDefaultPlanItem()],
    }));
  };

  const removeManualItem = (index: number) => {
    setForm((current) => {
      const nextItems = current.manualPlanItems.filter((_item, itemIndex) => itemIndex !== index);

      return {
        ...current,
        manualPlanItems: nextItems.length ? nextItems : [buildDefaultPlanItem()],
      };
    });
  };

  const handleDelete = async () => {
    if (!deletingInvestment) {
      return;
    }

    try {
      await deleteInvestment.mutateAsync(deletingInvestment.id);
      toast.success("Caixinha removida.");
      setDeletingInvestment(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel remover a caixinha.");
    }
  };

  return (
    <AppShell
      title="Caixinhas"
      description="Gerencie suas caixinhas e vincule manualmente aos planejamentos sem depender de IA."
    >
      <div className="flex justify-end">
        <Button onClick={openCreateDialog}>
          <Plus size={16} />
          Nova caixinha
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Saldo acumulado</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(summary.totalCurrentAmount)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Meta total das caixinhas</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(summary.totalTargetAmount)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Caixinhas ativas</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.activeCount}</p>
        </div>
      </div>

      <div className="glass-card mt-6 p-5">
        <div className="mb-4 flex items-center gap-3">
          <PiggyBank size={18} className="text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Caixinhas cadastradas</h2>
            <p className="text-sm text-muted-foreground">Essas caixinhas podem ser usadas manualmente ou vinculadas pela IA em um planejamento.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Nao foi possivel carregar as caixinhas.
          </div>
        ) : investments.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 p-8 text-center text-sm text-muted-foreground">
            Nenhuma caixinha criada ainda. Crie a primeira para organizar metas e planejamentos manuais.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caixinha</TableHead>
                <TableHead>Modo de aporte</TableHead>
                <TableHead>Saldo atual</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Planejamento manual</TableHead>
                <TableHead className="w-[120px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investments.map((investment) => (
                <TableRow key={investment.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{investment.name}</p>
                      <p className="text-xs text-muted-foreground">{investment.description || "Sem descricao."}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {investment.contributionMode === "income_percentage"
                      ? `${investment.incomePercentage ?? 0}% da receita`
                      : investment.fixedAmount !== null
                        ? `${formatCurrency(investment.fixedAmount)} fixo`
                        : "A definir"}
                  </TableCell>
                  <TableCell>{investment.formattedCurrentAmount}</TableCell>
                  <TableCell>{investment.formattedTargetAmount ?? "Sem meta"}</TableCell>
                  <TableCell>{investment.status === "paused" ? "Pausada" : investment.status === "archived" ? "Arquivada" : "Ativa"}</TableCell>
                  <TableCell>{investment.bank?.name ?? "Nao vinculada"}</TableCell>
                  <TableCell>
                    {(() => {
                      const linkedPlans = linkedManualPlansByInvestmentId.get(String(investment.id)) ?? [];

                      if (!linkedPlans.length) {
                        return "Sem vinculo";
                      }

                      if (linkedPlans.length === 1) {
                        return linkedPlans[0].title;
                      }

                      return `${linkedPlans[0].title} +${linkedPlans.length - 1}`;
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="icon" onClick={() => openEditDialog(investment)}>
                        <Pencil size={16} />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setDeletingInvestment(investment)}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingInvestment ? "Editar caixinha" : "Nova caixinha"}</DialogTitle>
            <DialogDescription>
              Defina o aporte da caixinha e, se quiser, ja vincule a um planejamento manual existente ou crie um novo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nome</label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Descricao</label>
              <Textarea
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed_amount">Valor fixo</SelectItem>
                    <SelectItem value="income_percentage">% da receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {form.contributionMode === "income_percentage" ? "Percentual da receita" : "Valor do aporte"}
                </label>
                <Input
                  inputMode="decimal"
                  value={form.contributionMode === "income_percentage" ? form.incomePercentage : form.fixedAmount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [current.contributionMode === "income_percentage" ? "incomePercentage" : "fixedAmount"]: event.target.value,
                    }))
                  }
                  placeholder={form.contributionMode === "income_percentage" ? "Ex.: 15" : "Ex.: 500,00"}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Saldo atual</label>
                <Input
                  inputMode="decimal"
                  value={form.currentAmount}
                  onChange={(event) => setForm((current) => ({ ...current, currentAmount: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Meta da caixinha</label>
                <Input
                  inputMode="decimal"
                  value={form.targetAmount}
                  onChange={(event) => setForm((current) => ({ ...current, targetAmount: event.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Status</label>
                <Select value={form.status} onValueChange={(value: InvestmentStatus) => setForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="archived">Arquivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Conta vinculada</label>
                <Select value={form.bankConnectionId} onValueChange={(value) => setForm((current) => ({ ...current, bankConnectionId: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {banks.map((bank) => (
                      <SelectItem key={bank.id} value={String(bank.id)}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Cor</label>
                <Input value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} placeholder="#0ea5e9" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Observações</label>
                <Input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
              </div>
            </div>

            {!editingInvestment ? (
              <div className="space-y-4 rounded-lg border border-border/40 bg-secondary/20 p-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Planejamento manual</label>
                  <Select
                    value={form.planLinkMode}
                    onValueChange={(value: "none" | "existing_manual" | "new_manual") =>
                      setForm((current) => ({
                        ...current,
                        planLinkMode: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nao vincular agora</SelectItem>
                      <SelectItem value="existing_manual">Vincular a planejamento manual existente</SelectItem>
                      <SelectItem value="new_manual">Criar novo planejamento manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.planLinkMode !== "none" ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Meta financeira</label>
                        <Input
                          inputMode="decimal"
                          value={form.manualGoalTargetAmount}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              manualGoalTargetAmount: event.target.value,
                            }))
                          }
                          placeholder="Ex.: 1000,00"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Inicio</label>
                        <Input
                          type="date"
                          value={form.manualGoalStartDate}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              manualGoalStartDate: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Fim</label>
                        <Input
                          type="date"
                          value={form.manualGoalEndDate}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              manualGoalEndDate: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    {form.planLinkMode === "existing_manual" ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Planejamento manual existente</label>
                        <Select
                          value={form.existingPlanId}
                          onValueChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              existingPlanId: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um planejamento manual" />
                          </SelectTrigger>
                          <SelectContent>
                            {manualPlans.length ? (
                              manualPlans.map((plan) => (
                                <SelectItem key={plan.id} value={plan.id}>
                                  {plan.title}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="__empty" disabled>
                                Nenhum planejamento manual disponivel
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {form.planLinkMode === "new_manual" ? (
                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Titulo do planejamento</label>
                            <Input
                              value={form.manualPlanTitle}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  manualPlanTitle: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Descricao</label>
                            <Input
                              value={form.manualPlanDescription}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  manualPlanDescription: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm font-medium text-foreground">Itens do planejamento</label>
                            <Button type="button" variant="secondary" size="sm" onClick={addManualItem}>
                              <Plus size={14} />
                              Item
                            </Button>
                          </div>

                          <div className="space-y-3">
                            {form.manualPlanItems.map((item, index) => (
                              <div key={`manual-plan-item-${index}`} className="space-y-3 rounded-md border border-border/40 bg-background p-3">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <Input
                                    placeholder="Titulo do item"
                                    value={item.title}
                                    onChange={(event) => updateManualItem(index, { title: event.target.value })}
                                  />
                                  <Input
                                    placeholder="Descricao"
                                    value={item.description}
                                    onChange={(event) => updateManualItem(index, { description: event.target.value })}
                                  />
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                  <Select
                                    value={item.status}
                                    onValueChange={(value: PlanItemStatus) =>
                                      updateManualItem(index, {
                                        status: value === "done" ? "done" : "todo",
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-10 w-full rounded-md border-border/60 bg-background">
                                      <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="todo">Pendente</SelectItem>
                                      <SelectItem value="done">Concluido</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Select
                                    value={item.priority}
                                    onValueChange={(value: PlanPriority) => {
                                      const priority = value;
                                      updateManualItem(index, {
                                        priority: priority === "high" || priority === "low" ? priority : "medium",
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-10 w-full rounded-md border-border/60 bg-background">
                                      <SelectValue placeholder="Prioridade" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="low">Prioridade baixa</SelectItem>
                                      <SelectItem value="medium">Prioridade media</SelectItem>
                                      <SelectItem value="high">Prioridade alta</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button type="button" variant="ghost" onClick={() => removeManualItem(index)}>
                                    <Trash2 size={16} />
                                    Remover
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  createInvestment.isPending ||
                  updateInvestment.isPending ||
                  createPlan.isPending ||
                  updatePlan.isPending
                }
              >
                {editingInvestment ? "Salvar alterações" : "Criar caixinha"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingInvestment)} onOpenChange={(open) => !open && setDeletingInvestment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover caixinha</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingInvestment
                ? `A caixinha ${deletingInvestment.name} sera removida. Planejamentos vinculados perderao o vínculo.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
