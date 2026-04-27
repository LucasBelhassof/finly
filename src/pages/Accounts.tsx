import { CheckCircle, CreditCard, Landmark, Lock, Pencil, RefreshCw, Trash2, TriangleAlert, Unlink, Wallet, Wifi } from "lucide-react";
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
import { ColorField } from "@/components/ui/color-field";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useBanks, useCreateBankConnection, useDeleteBankConnection, useUpdateBankConnection } from "@/hooks/use-banks";
import {
  usePluggyConnect,
  usePluggyConnectToken,
  usePluggyDisconnect,
  usePluggyStatus,
  usePluggySync,
  usePluggyWidget,
} from "@/hooks/use-pluggy";
import { ACCOUNT_COLOR_PRESETS, getInstitutionInitials, getSuggestedAccountColor } from "@/lib/account-colors";
import { resolveCategoryColorValue } from "@/lib/category-colors";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";
import type { BankItem, CreateBankConnectionInput, UpdateBankConnectionInput } from "@/types/api";

type AccountType = "bank_account" | "credit_card" | "cash";
type AccountFormState = {
  id?: string;
  name: string;
  accountType: AccountType;
  currentBalance: string;
  creditLimit: string;
  color: string;
  parentBankConnectionId: string;
  statementCloseDay: string;
  statementDueDay: string;
};

function emptyForm(accountType: AccountType = "bank_account"): AccountFormState {
  return {
    name: "",
    accountType,
    currentBalance: "0,00",
    creditLimit: "",
    color: getSuggestedAccountColor("", accountType),
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
    creditLimit: bank.creditLimit === null ? "" : String(bank.creditLimit).replace(".", ","),
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

function getErrorMessage(error: unknown, fallback = "Tente novamente em instantes.") {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getAccountTypeCopy(accountType: AccountType) {
  switch (accountType) {
    case "credit_card":
      return {
        createTitle: "Novo cartão",
        editTitle: "Editar cartão",
        description: "Cadastre manualmente um cartão de crédito vinculado a uma conta bancária.",
      };
    case "cash":
      return {
        createTitle: "Novo caixa",
        editTitle: "Editar caixa",
        description: "Cadastre manualmente uma conta de caixa ou dinheiro físico.",
      };
    default:
      return {
        createTitle: "Nova conta bancária",
        editTitle: "Editar conta bancária",
        description: "Cadastre manualmente uma conta bancária para organizar as origens financeiras.",
      };
  }
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

function LastSyncInfo({ lastSyncAt }: { lastSyncAt: string | null }) {
  if (!lastSyncAt) return null;
  const date = new Date(lastSyncAt);
  const formatted = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return <p className="text-xs text-muted-foreground">Última sincronização: {formatted}</p>;
}

function PluggyConnectSection({ isPremium }: { isPremium: boolean }) {
  const { data: status, isLoading } = usePluggyStatus();
  const { openWidget } = usePluggyWidget();
  const connectTokenMutation = usePluggyConnectToken();
  const connectMutation = usePluggyConnect();
  const syncMutation = usePluggySync();
  const disconnectMutation = usePluggyDisconnect();

  const isConnected = Boolean(status?.connected);
  const isBusy =
    connectTokenMutation.isPending ||
    connectMutation.isPending ||
    syncMutation.isPending ||
    disconnectMutation.isPending;

  const handleConnect = async () => {
    try {
      const connectToken = await connectTokenMutation.mutateAsync();
      openWidget(
        connectToken,
        async (itemId) => {
          if (!itemId) {
            toast.error("Nenhuma conta selecionada no widget.");
            return;
          }
          try {
            const result = await connectMutation.mutateAsync(itemId);
            const msg =
              result.imported > 0
                ? `${result.imported} transações importadas.`
                : "Nenhuma transação nova encontrada.";
            toast.success(`Open Finance conectado! ${msg}`);
          } catch (err) {
            toast.error("Erro ao conectar conta.", { description: getErrorMessage(err) });
          }
        },
        (err) => {
          if (err) {
            toast.error("Não foi possível abrir o widget Pluggy.", {
              description: getErrorMessage(err),
            });
          }
        },
      );
    } catch (err) {
      toast.error("Erro ao iniciar conexão.", { description: getErrorMessage(err) });
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      const msg =
        result.imported > 0
          ? `${result.imported} novas transações importadas.`
          : "Nenhuma transação nova encontrada.";
      toast.success(`Sincronizado! ${msg}`);
    } catch (err) {
      toast.error("Erro ao sincronizar.", { description: getErrorMessage(err) });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectMutation.mutateAsync();
      toast.success("Conexão com Open Finance removida.");
    } catch (err) {
      toast.error("Erro ao desconectar.", { description: getErrorMessage(err) });
    }
  };

  if (!isPremium) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border/30 p-4">
        <div className="pointer-events-none select-none blur-sm">
          <div className="mb-3 flex items-center gap-2">
            <Wifi size={16} className="text-primary" />
            <span className="text-sm font-medium text-foreground">Open Finance</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Conecte sua conta bancária e importe transações automaticamente.
          </p>
          <Button variant="outline" className="mt-3 h-8 w-full text-xs" disabled>
            Conectar banco
          </Button>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-card/70 p-4 text-center backdrop-blur-[1px]">
          <Lock size={18} className="text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">Recurso Premium</p>
          <p className="mt-1 text-xs text-muted-foreground">Importe transações automaticamente do seu banco</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/30 p-4">
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="mt-3 h-8 w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Wifi size={16} className={isConnected ? "text-income" : "text-muted-foreground"} />
        <span className="text-sm font-medium text-foreground">Open Finance</span>
        {isConnected ? (
          <span className="ml-auto rounded-full bg-income/15 px-2 py-0.5 text-xs text-income">
            {(status?.connectionCount ?? 0) > 1 ? `${status?.connectionCount} bancos` : "Conectado"}
          </span>
        ) : null}
      </div>

      {isConnected ? (
        <div className="space-y-3">
          {/* List of connected institutions */}
          {(status?.connections ?? []).map((conn) => (
            <div key={conn.pluggyItemId} className="flex items-center gap-2 rounded-lg bg-income/5 p-2.5">
              {conn.institutionName ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-income/20 text-[9px] font-bold text-income">
                  {getInstitutionInitials(conn.institutionName)}
                </span>
              ) : (
                <CheckCircle size={14} className="shrink-0 text-income" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">
                  {conn.institutionName ?? "Banco conectado via Pluggy"}
                </p>
                <LastSyncInfo lastSyncAt={conn.lastSyncAt} />
              </div>
              {conn.lastError ? (
                <TriangleAlert size={13} className="shrink-0 text-destructive" aria-label={conn.lastError} />
              ) : null}
            </div>
          ))}

          {status?.lastError && !(status?.connections ?? []).some((c) => c.lastError) ? (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/5 p-2.5">
              <TriangleAlert size={14} className="mt-0.5 shrink-0 text-destructive" />
              <p className="text-xs text-destructive">Erro na última sincronização. Tente sincronizar novamente.</p>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => void handleConnect()}
              disabled={isBusy}
              title="Conectar outro banco"
            >
              <Wifi size={12} />
              Outra Conexão
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => void handleSync()}
              disabled={isBusy}
              title={syncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
              aria-label={syncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
            >
              <RefreshCw size={12} className={syncMutation.isPending ? "animate-spin" : ""} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => void handleDisconnect()}
              disabled={isBusy}
            >
              <Unlink size={12} />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Conecte sua conta bancária via Open Finance e importe transações automaticamente com Pluggy.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full text-xs"
            onClick={() => void handleConnect()}
            disabled={isBusy}
          >
            <Wifi size={12} />
            {connectTokenMutation.isPending ? "Abrindo widget..." : "Conectar banco"}
          </Button>
        </div>
      )}
    </div>
  );
}

function CreditLimitBar({
  currentBalance,
  creditLimit,
  formattedCreditLimit,
}: {
  currentBalance: number;
  creditLimit: number;
  formattedCreditLimit: string | null;
}) {
  // currentBalance for a credit card represents the amount owed (positive = debt)
  const used = Math.max(0, currentBalance);
  const pct = Math.min(100, (used / creditLimit) * 100);
  const available = Math.max(0, creditLimit - used);
  const availablePct = Math.max(0, 100 - pct);

  const barColor =
    pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-income";

  const formattedUsed = used.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formattedLimit = formattedCreditLimit ?? creditLimit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formattedAvailable = available.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="mt-2 space-y-1.5">
      <div className="w-56 max-w-full space-y-1">
        <div className="text-xs text-muted-foreground">
          <span>{formattedUsed} de {formattedLimit}</span>
        </div>
        <div className="text-[11px] font-medium text-muted-foreground">
          <span>{pct.toFixed(0)}% usado</span>
        </div>
      </div>
      <TooltipProvider delayDuration={120}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-56 max-w-full cursor-default">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-border/40">
                <div
                  className={cn("h-full rounded-full transition-all", barColor)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="space-y-1 text-xs">
            <p>{pct.toFixed(0)}% do limite usado</p>
            <p>{availablePct.toFixed(0)}% disponivel</p>
            <p className="text-muted-foreground">{formattedAvailable} livre</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function AccountsSkeleton() {
  return (
    <div className="space-y-6">
      <div data-tour-id="accounts-summary" className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
  const { user } = useAuthSession();
  const isPremiumUser = Boolean(user?.isPremium);
  const { data: banks = [], isLoading, isError } = useBanks();
  const createBankConnection = useCreateBankConnection();
  const deleteBankConnection = useDeleteBankConnection();
  const updateBankConnection = useUpdateBankConnection();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AccountFormState>(emptyForm());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [hasManualColorSelection, setHasManualColorSelection] = useState(false);

  const bankAccounts = useMemo(() => banks.filter((bank) => bank.accountType === "bank_account"), [banks]);
  const creditCards = useMemo(() => banks.filter((bank) => bank.accountType === "credit_card"), [banks]);
  const cashAccounts = useMemo(() => banks.filter((bank) => bank.accountType === "cash"), [banks]);
  const hasBankAccounts = bankAccounts.length > 0;
  const linkedBankAccountIds = useMemo(() => new Set(bankAccounts.map((a) => String(a.id))), [bankAccounts]);
  const getCardUsagePercentage = (card: BankItem) => {
    if (!card.creditLimit || card.creditLimit <= 0) {
      return 0;
    }

    return Math.min(100, (Math.max(0, card.currentBalance) / card.creditLimit) * 100);
  };
  const groupedBankAccounts = useMemo(
    () =>
      bankAccounts
        .map((account) => {
          const cards = creditCards
            .filter((card) => String(card.parentBankConnectionId) === String(account.id))
            .sort((left, right) => {
              const usageDiff = getCardUsagePercentage(right) - getCardUsagePercentage(left);

              if (usageDiff !== 0) {
                return usageDiff;
              }

              const transactionDiff = right.transactionCount - left.transactionCount;

              if (transactionDiff !== 0) {
                return transactionDiff;
              }

              return left.name.localeCompare(right.name, "pt-BR");
            });

          return {
            account,
            cards,
            usageScore: cards.reduce((highest, card) => Math.max(highest, getCardUsagePercentage(card)), 0),
            transactionCount: account.transactionCount + cards.reduce((total, card) => total + card.transactionCount, 0),
          };
        })
        .sort((left, right) => {
          if (right.usageScore !== left.usageScore) {
            return right.usageScore - left.usageScore;
          }

          if (right.transactionCount !== left.transactionCount) {
            return right.transactionCount - left.transactionCount;
          }

          return left.account.name.localeCompare(right.account.name, "pt-BR");
        }),
    [bankAccounts, creditCards],
  );
  // Orphan credit cards: linked to a parent that is no longer in the list (shouldn't happen with new sync logic, kept as safety net)
  const orphanCreditCards = useMemo(
    () =>
      creditCards.filter(
        (card) => !card.parentBankConnectionId || !linkedBankAccountIds.has(String(card.parentBankConnectionId)),
      ).sort((left, right) => {
        const usageDiff = getCardUsagePercentage(right) - getCardUsagePercentage(left);

        if (usageDiff !== 0) {
          return usageDiff;
        }

        const transactionDiff = right.transactionCount - left.transactionCount;

        if (transactionDiff !== 0) {
          return transactionDiff;
        }

        return left.name.localeCompare(right.name, "pt-BR");
      }),
    [creditCards, linkedBankAccountIds],
  );
  const isEditing = Boolean(form.id);
  const formCopy = getAccountTypeCopy(form.accountType);
  const deleteTarget = banks.find((bank) => String(bank.id) === deleteTargetId) ?? null;

  const openCreateDialog = (accountType: AccountType) => {
    if (accountType === "credit_card" && !hasBankAccounts) {
      toast.error("Cadastre uma conta bancária antes de criar um cartão.");
      return;
    }

    setForm(emptyForm(accountType));
    setHasManualColorSelection(false);
    setDialogOpen(true);
  };

  const openEditDialog = (bank: BankItem) => {
    setForm(mapBankToForm(bank));
    setHasManualColorSelection(true);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const currentBalance = parseCurrencyInput(form.currentBalance);
    const creditLimit = form.creditLimit ? parseCurrencyInput(form.creditLimit) : null;

    if (!form.name.trim() || !Number.isFinite(currentBalance)) {
      toast.error("Informe um nome valido.");
      return;
    }

    if (form.accountType === "credit_card") {
      if (!Number.isFinite(creditLimit)) {
        toast.error("Informe o limite total do cartão.");
        return;
      }

      if (!form.parentBankConnectionId || !form.statementCloseDay || !form.statementDueDay) {
        toast.error("Cartoes exigem conta pai, dia de fechamento e dia de vencimento.");
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      accountType: form.accountType,
      currentBalance,
      creditLimit: form.accountType === "credit_card" ? creditLimit : null,
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
        toast.success(form.accountType === "credit_card" ? "Cartão criado." : "Conta criada.");
      }

      setDialogOpen(false);
      setForm(emptyForm());
      setHasManualColorSelection(false);
    } catch (error) {
      toast.error("Não foi possível salvar a conta.", {
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
      setHasManualColorSelection(false);
      toast.success("Conta removida.");
    } catch (error) {
      toast.error("Não foi possível excluir a conta.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  if (isLoading) {
    return (
      <AppShell title="Contas" description="Cadastre manualmente contas bancárias, cartões e caixa">
        <AccountsSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell title="Contas" description="Cadastre manualmente contas bancárias, cartões e caixa">
      <AlertDialog open={Boolean(deleteTargetId)} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent className="border-warning/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `A conta "${deleteTarget.name}" será excluída se não tiver cartões vinculados nem transações associadas.`
                : "Esta conta será excluída se não houver bloqueios de integridade."}
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
            <DialogTitle>{isEditing ? formCopy.editTitle : formCopy.createTitle}</DialogTitle>
            <DialogDescription>{formCopy.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                  color: hasManualColorSelection ? current.color : getSuggestedAccountColor(event.target.value, current.accountType),
                }))
              }
              placeholder="Nome da conta ou cartão"
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />

            <Select
              value={form.accountType}
              onValueChange={(value: AccountType) => {
                const nextType = value === "credit_card" && !hasBankAccounts ? form.accountType : value;

                setForm((current) => ({
                  ...current,
                  accountType: nextType,
                  creditLimit: nextType === "credit_card" ? current.creditLimit : "",
                  parentBankConnectionId: nextType === "credit_card" ? current.parentBankConnectionId : "",
                  statementCloseDay: nextType === "credit_card" ? current.statementCloseDay : "",
                  statementDueDay: nextType === "credit_card" ? current.statementDueDay : "",
                  color:
                    nextType === "cash" || !hasManualColorSelection
                      ? getSuggestedAccountColor(current.name, nextType)
                      : current.color,
                }));

                if (nextType === "cash") {
                  setHasManualColorSelection(false);
                }
              }}
            >
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                <SelectValue placeholder="Tipo da conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_account">Conta bancária</SelectItem>
                <SelectItem value="credit_card" disabled={!hasBankAccounts}>
                  Cartão
                </SelectItem>
                <SelectItem value="cash">Caixa / Dinheiro</SelectItem>
              </SelectContent>
            </Select>

            {form.accountType === "credit_card" ? (
              <>
                <Input
                  value={form.creditLimit}
                  onChange={(event) => setForm((current) => ({ ...current, creditLimit: event.target.value }))}
                  placeholder="Limite total do cartão"
                  inputMode="decimal"
                  className="h-11 rounded-xl border-border/60 bg-secondary/35"
                />

                <Select
                  value={form.parentBankConnectionId}
                  onValueChange={(value) => setForm((current) => ({ ...current, parentBankConnectionId: value }))}
                >
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                    <SelectValue placeholder="Conta bancária vinculada" />
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

            <ColorField
              label="Cor"
              value={form.color}
              onChange={(nextColor) => {
                setHasManualColorSelection(true);
                setForm((current) => ({ ...current, color: nextColor }));
              }}
              presets={ACCOUNT_COLOR_PRESETS}
              inputAriaLabel="Selecionar cor da conta"
              fallback={getSuggestedAccountColor(form.name, form.accountType)}
            />
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

      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => openCreateDialog("bank_account")}>
          Nova conta
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => openCreateDialog("credit_card")} disabled={!hasBankAccounts}>
          Novo cartão
        </Button>
        <Button className="w-full sm:w-auto" onClick={() => openCreateDialog("cash")}>Caixa / Dinheiro</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Contas bancárias</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{bankAccounts.length}</p>
        </div>
        <div className="glass-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Cartoes</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{creditCards.length}</p>
        </div>
        <div className="glass-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Caixa</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{cashAccounts.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div data-tour-id="accounts-structure" className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[1.35rem] font-semibold text-foreground sm:text-[1.6rem]">Estrutura financeira</h2>
              <p className="text-sm text-muted-foreground">Uma conta bancária pode concentrar vários cartões vinculados.</p>
            </div>
          </div>

          {!banks.length ? (
            <div className="rounded-xl border border-border/30 bg-secondary/20 p-4 text-sm text-muted-foreground">
              {isError ? "Não foi possível carregar as contas agora." : "Nenhuma conta cadastrada ainda."}
            </div>
          ) : (
            <div className="space-y-4">
              {groupedBankAccounts.map(({ account, cards }) => (
                <div key={account.id} className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: resolveCategoryColorValue(account.color) }}
                      >
                        {account.institutionName ? (
                          <span className="text-sm font-bold leading-none text-white">
                            {getInstitutionInitials(account.institutionName)}
                          </span>
                        ) : (
                          <AccountTypeIcon accountType="bank_account" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-foreground">
                            {account.institutionName ?? account.name}
                          </p>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Conta</span>
                        </div>
                        {account.institutionName && account.institutionName !== account.name ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">{account.name}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(account)}>
                        <Pencil size={15} />
                      </Button>
                    </div>
                  </div>

                  {cards.length ? (
                    <div className="mt-4 space-y-3 border-t border-border/30 pt-4">
                      {cards.map((card) => (
                        <div key={card.id} className="flex flex-col gap-3 rounded-xl border border-border/30 bg-card/50 p-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                              style={{ backgroundColor: resolveCategoryColorValue(card.color) }}
                            >
                              {account.institutionName ? (
                                <span className="text-[10px] font-bold leading-none text-white">
                                  {getInstitutionInitials(account.institutionName)}
                                </span>
                              ) : (
                                <AccountTypeIcon accountType="credit_card" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-foreground">{card.name}</p>
                                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">Cartão</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Fecha dia {card.statementCloseDay ?? "--"} - vence dia {card.statementDueDay ?? "--"}
                              </p>
                              {card.creditLimit && card.creditLimit > 0 ? (
                                <CreditLimitBar
                                  currentBalance={card.currentBalance}
                                  creditLimit={card.creditLimit}
                                  formattedCreditLimit={card.formattedCreditLimit}
                                />
                              ) : card.formattedCreditLimit ? (
                                <p className="text-sm text-muted-foreground">Limite total {card.formattedCreditLimit}</p>
                              ) : null}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="self-end sm:self-auto" onClick={() => openEditDialog(card)}>
                            <Pencil size={15} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-border/40 px-4 py-3 text-sm text-muted-foreground">
                      Nenhum cartão vinculado a esta conta ainda.
                    </div>
                  )}
                </div>
              ))}

              {orphanCreditCards.length > 0 ? (
                <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">Cartões sem conta vinculada</h3>
                  </div>
                  <div className="space-y-3">
                    {orphanCreditCards.map((card) => (
                      <div key={card.id} className="flex flex-col gap-3 rounded-xl border border-border/30 bg-card/50 p-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                            style={{ backgroundColor: resolveCategoryColorValue(card.color) }}
                          >
                            <AccountTypeIcon accountType="credit_card" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{card.name}</p>
                              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">Cartão</span>
                            </div>
                            {card.creditLimit && card.creditLimit > 0 ? (
                              <CreditLimitBar
                                currentBalance={card.currentBalance}
                                creditLimit={card.creditLimit}
                                formattedCreditLimit={card.formattedCreditLimit}
                              />
                            ) : card.formattedCreditLimit ? (
                              <p className="text-sm text-muted-foreground">Limite total {card.formattedCreditLimit}</p>
                            ) : null}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="self-end sm:self-auto" onClick={() => openEditDialog(card)}>
                          <Pencil size={15} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {cashAccounts.length ? (
                <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">Caixa e dinheiro</h3>
                  </div>
                  <div className="space-y-3">
                    {cashAccounts.map((cash) => (
                      <div key={cash.id} className="flex flex-col gap-3 rounded-xl border border-border/30 bg-card/50 p-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                            style={{ backgroundColor: resolveCategoryColorValue(cash.color) }}
                          >
                            <AccountTypeIcon accountType="cash" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{cash.name}</p>
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-500">Caixa</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="self-end sm:self-auto" onClick={() => openEditDialog(cash)}>
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

        <div data-tour-id="accounts-support" className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5">
          <h3 className="mb-4 text-[1.3rem] font-semibold text-foreground">Open Finance</h3>
          <PluggyConnectSection isPremium={isPremiumUser} />
        </div>
      </div>
    </AppShell>
  );
}
