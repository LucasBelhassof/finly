import { CreditCard, Landmark, Pencil, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { useBanks, useCreateBankConnection, useDeleteBankConnection, useUpdateBankConnection } from "@/hooks/use-banks";
import { cn } from "@/lib/utils";
import type { BankItem, CreateBankConnectionInput, UpdateBankConnectionInput } from "@/types/api";

type AccountType = "bank_account" | "credit_card" | "cash";
type AccountFormState = {
  id?: string;
  name: string;
  accountType: AccountType;
  currentBalance: string;
  color: string;
  parentBankConnectionId: string;
  statementCloseDay: string;
  statementDueDay: string;
};

const colorOptions = [
  "bg-primary",
  "bg-income",
  "bg-expense",
  "bg-info",
  "bg-warning",
  "bg-orange-500",
  "bg-purple-500",
  "bg-red-500",
  "bg-amber-500",
];

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function emptyForm(accountType: AccountType = "bank_account"): AccountFormState {
  return {
    name: "",
    accountType,
    currentBalance: "0,00",
    color: accountType === "cash" ? "bg-amber-500" : accountType === "credit_card" ? "bg-purple-500" : "bg-primary",
    parentBankConnectionId: "",
    statementCloseDay: "",
    statementDueDay: "",
  };
}

function mapBankToForm(bank: BankItem): AccountFormState {
  return {
    id: String(bank.id),
    name: bank.name,
    accountType: bank.accountType,
    currentBalance: String(bank.currentBalance).replace(".", ","),
    color: bank.color,
    parentBankConnectionId: bank.parentBankConnectionId ? String(bank.parentBankConnectionId) : "",
    statementCloseDay: bank.statementCloseDay ? String(bank.statementCloseDay) : "",
    statementDueDay: bank.statementDueDay ? String(bank.statementDueDay) : "",
  };
}

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function AccountTypeIcon({ accountType }: { accountType: AccountType }) {
  if (accountType === "credit_card") {
    return <CreditCard size={16} />;
  }

  if (accountType === "cash") {
    return <Wallet size={16} />;
  }

  return <Landmark size={16} />;
}

function AccountsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="glass-card p-5">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </div>
      <div className="glass-card p-5">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border/40 p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const { data: banks = [], isLoading, isError } = useBanks();
  const createBankConnection = useCreateBankConnection();
  const deleteBankConnection = useDeleteBankConnection();
  const updateBankConnection = useUpdateBankConnection();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AccountFormState>(emptyForm());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const bankAccounts = useMemo(() => banks.filter((bank) => bank.accountType === "bank_account"), [banks]);
  const creditCards = useMemo(() => banks.filter((bank) => bank.accountType === "credit_card"), [banks]);
  const cashAccounts = useMemo(() => banks.filter((bank) => bank.accountType === "cash"), [banks]);
  const totalBalance = useMemo(
    () => banks.filter((bank) => bank.accountType !== "credit_card").reduce((sum, bank) => sum + bank.currentBalance, 0),
    [banks],
  );
  const groupedBankAccounts = useMemo(
    () =>
      bankAccounts.map((account) => ({
        account,
        cards: creditCards.filter((card) => String(card.parentBankConnectionId) === String(account.id)),
      })),
    [bankAccounts, creditCards],
  );
  const isEditing = Boolean(form.id);
  const deleteTarget = banks.find((bank) => String(bank.id) === deleteTargetId) ?? null;

  const openCreateDialog = (accountType: AccountType) => {
    setForm(emptyForm(accountType));
    setDialogOpen(true);
  };

  const openEditDialog = (bank: BankItem) => {
    setForm(mapBankToForm(bank));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const currentBalance = parseCurrencyInput(form.currentBalance);

    if (!form.name.trim() || !Number.isFinite(currentBalance)) {
      toast.error("Informe nome e saldo validos.");
      return;
    }

    if (form.accountType === "credit_card") {
      if (!form.parentBankConnectionId || !form.statementCloseDay || !form.statementDueDay) {
        toast.error("Cartoes exigem conta pai, dia de fechamento e dia de vencimento.");
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      accountType: form.accountType,
      currentBalance,
      color: form.color,
      parentBankConnectionId: form.accountType === "credit_card" ? form.parentBankConnectionId : null,
      statementCloseDay: form.accountType === "credit_card" ? Number(form.statementCloseDay) : null,
      statementDueDay: form.accountType === "credit_card" ? Number(form.statementDueDay) : null,
      connected: true,
    } satisfies CreateBankConnectionInput;

    try {
      if (form.id) {
        await updateBankConnection.mutateAsync({
          id: form.id,
          ...payload,
        } satisfies UpdateBankConnectionInput);
        toast.success("Conta atualizada.");
      } else {
        await createBankConnection.mutateAsync(payload);
        toast.success(form.accountType === "credit_card" ? "Cartao criado." : "Conta criada.");
      }

      setDialogOpen(false);
      setForm(emptyForm());
    } catch (error) {
      toast.error("Nao foi possivel salvar a conta.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) {
      return;
    }

    try {
      await deleteBankConnection.mutateAsync(deleteTargetId);
      setDeleteTargetId(null);
      setDialogOpen(false);
      setForm(emptyForm());
      toast.success("Conta removida.");
    } catch (error) {
      toast.error("Nao foi possivel excluir a conta.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  if (isLoading) {
    return (
      <AppShell title="Contas" description="Cadastre manualmente contas bancarias, cartoes e caixa">
        <AccountsSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell title="Contas" description="Cadastre manualmente contas bancarias, cartoes e caixa">
      <AlertDialog open={Boolean(deleteTargetId)} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent className="border-warning/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `A conta "${deleteTarget.name}" sera excluida se nao tiver cartoes vinculados nem transacoes associadas.`
                : "Esta conta sera excluida se nao houver bloqueios de integridade."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBankConnection.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={deleteBankConnection.isPending}
            >
              {deleteBankConnection.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[560px] border-border/70 bg-card p-6">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar conta" : "Nova conta ou cartao"}</DialogTitle>
            <DialogDescription>
              Cadastre manualmente a origem financeira. Cartoes podem ser vinculados a uma conta bancaria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nome da conta ou cartao"
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />

            <Select
              value={form.accountType}
              onValueChange={(value: AccountType) =>
                setForm((current) => ({
                  ...current,
                  accountType: value,
                  parentBankConnectionId: value === "credit_card" ? current.parentBankConnectionId : "",
                  statementCloseDay: value === "credit_card" ? current.statementCloseDay : "",
                  statementDueDay: value === "credit_card" ? current.statementDueDay : "",
                  color:
                    value === "cash" ? "bg-amber-500" : value === "credit_card" ? current.color || "bg-purple-500" : current.color || "bg-primary",
                }))
              }
            >
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                <SelectValue placeholder="Tipo da conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_account">Conta bancaria</SelectItem>
                <SelectItem value="credit_card">Cartao</SelectItem>
                <SelectItem value="cash">Caixa / Dinheiro</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={form.currentBalance}
              onChange={(event) => setForm((current) => ({ ...current, currentBalance: event.target.value }))}
              placeholder={form.accountType === "credit_card" ? "Limite ou saldo atual" : "Saldo atual"}
              inputMode="decimal"
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />

            {form.accountType === "credit_card" ? (
              <>
                <Select
                  value={form.parentBankConnectionId}
                  onValueChange={(value) => setForm((current) => ({ ...current, parentBankConnectionId: value }))}
                >
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                    <SelectValue placeholder="Conta bancaria vinculada" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((bank) => (
                      <SelectItem key={bank.id} value={String(bank.id)}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={form.statementCloseDay}
                    onChange={(event) => setForm((current) => ({ ...current, statementCloseDay: event.target.value }))}
                    placeholder="Dia de fechamento"
                    inputMode="numeric"
                    className="h-11 rounded-xl border-border/60 bg-secondary/35"
                  />
                  <Input
                    value={form.statementDueDay}
                    onChange={(event) => setForm((current) => ({ ...current, statementDueDay: event.target.value }))}
                    placeholder="Dia de vencimento"
                    inputMode="numeric"
                    className="h-11 rounded-xl border-border/60 bg-secondary/35"
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Cor</p>
              <div className="flex flex-wrap gap-3">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, color }))}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform hover:scale-105",
                      color,
                      form.color === color ? "scale-105 border-white ring-2 ring-white/30" : "border-transparent",
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <div className="mr-auto">
              {isEditing ? (
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTargetId(form.id ?? null)}
                  disabled={deleteBankConnection.isPending}
                >
                  <Trash2 size={14} />
                  Excluir
                </Button>
              ) : null}
            </div>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={createBankConnection.isPending || updateBankConnection.isPending}>
              {createBankConnection.isPending || updateBankConnection.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={() => openCreateDialog("bank_account")}>
          Nova conta
        </Button>
        <Button variant="outline" onClick={() => openCreateDialog("credit_card")}>
          Novo cartao
        </Button>
        <Button onClick={() => openCreateDialog("cash")}>Caixa / Dinheiro</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Contas bancarias</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{bankAccounts.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Cartoes</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{creditCards.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Caixa</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{cashAccounts.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Saldo consolidado</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{currencyFormatter.format(totalBalance)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="glass-card rounded-2xl border border-border/40 p-5">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-[1.6rem] font-semibold text-foreground">Estrutura financeira</h2>
              <p className="text-sm text-muted-foreground">Uma conta bancaria pode concentrar varios cartoes vinculados.</p>
            </div>
          </div>

          {!banks.length ? (
            <div className="rounded-xl border border-border/30 bg-secondary/20 p-4 text-sm text-muted-foreground">
              {isError ? "Nao foi possivel carregar as contas agora." : "Nenhuma conta cadastrada ainda."}
            </div>
          ) : (
            <div className="space-y-4">
              {groupedBankAccounts.map(({ account, cards }) => (
                <div key={account.id} className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-1 flex h-10 w-10 items-center justify-center rounded-xl text-foreground", account.color)}>
                        <AccountTypeIcon accountType="bank_account" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-foreground">{account.name}</p>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Conta</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{account.formattedBalance}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(account)}>
                        <Pencil size={15} />
                      </Button>
                    </div>
                  </div>

                  {cards.length ? (
                    <div className="mt-4 space-y-3 border-t border-border/30 pt-4">
                      {cards.map((card) => (
                        <div key={card.id} className="flex items-start justify-between rounded-xl border border-border/30 bg-card/50 p-3">
                          <div className="flex items-start gap-3">
                            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-foreground", card.color)}>
                              <AccountTypeIcon accountType="credit_card" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground">{card.name}</p>
                                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">Cartao</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Fecha dia {card.statementCloseDay ?? "--"} - vence dia {card.statementDueDay ?? "--"}
                              </p>
                              <p className="text-sm text-muted-foreground">{card.formattedBalance}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(card)}>
                            <Pencil size={15} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-border/40 px-4 py-3 text-sm text-muted-foreground">
                      Nenhum cartao vinculado a esta conta ainda.
                    </div>
                  )}
                </div>
              ))}

              {cashAccounts.length ? (
                <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">Caixa e dinheiro</h3>
                  </div>
                  <div className="space-y-3">
                    {cashAccounts.map((cash) => (
                      <div key={cash.id} className="flex items-start justify-between rounded-xl border border-border/30 bg-card/50 p-3">
                        <div className="flex items-start gap-3">
                          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-foreground", cash.color)}>
                            <AccountTypeIcon accountType="cash" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{cash.name}</p>
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-500">Caixa</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{cash.formattedBalance}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(cash)}>
                          <Pencil size={15} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl border border-border/40 p-5">
          <h3 className="text-[1.3rem] font-semibold text-foreground">Regras desta versao</h3>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>Contas e cartoes sao cadastrados manualmente. Open Finance fica para depois.</p>
            <p>Cartoes devem ser vinculados a uma conta bancaria pai.</p>
            <p>Importacao de extrato aceita apenas conta bancaria. Importacao de fatura aceita apenas cartao.</p>
            <p>O dia de fechamento e o dia de vencimento ficam salvos no cartao para uso futuro em faturas.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
