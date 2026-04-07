import { ArrowDownCircle, ArrowUpCircle, Filter, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import ImportTransactionsModal from "@/components/transactions/ImportTransactionsModal";
import TransactionsDateFilter from "@/components/transactions/TransactionsDateFilter";
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
import { useBanks } from "@/hooks/use-banks";
import { useFilteredTransactionsData } from "@/hooks/use-filtered-transactions-data";
import {
  useCategories,
  useCreateCategory,
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
} from "@/hooks/use-transactions";
import { resolvePresetRange } from "@/lib/transactions-date-filter";
import { cn } from "@/lib/utils";
import type { CreateCategoryInput, CreateTransactionInput, TransactionItem, UpdateTransactionInput } from "@/types/api";
import { toast } from "@/components/ui/sonner";

type TransactionTypeFilter = "all" | "income" | "expense";
type TransactionsDateFilterPreset = "week" | "fifteen_days" | "month" | "custom";
type TransactionFormState = {
  id?: string;
  description: string;
  amount: string;
  occurredOn: string;
  bankConnectionId: string;
  categoryId: string;
  type: "income" | "expense";
};

const transactionTypeOptions: Array<{ label: string; value: "income" | "expense" }> = [
  { label: "Receita", value: "income" },
  { label: "Despesa", value: "expense" },
];

const colorSwatches = [
  { text: "text-income", bg: "bg-income", ring: "ring-income/40" },
  { text: "text-warning", bg: "bg-warning", ring: "ring-warning/40" },
  { text: "text-info", bg: "bg-info", ring: "ring-info/40" },
  { text: "text-expense", bg: "bg-expense", ring: "ring-expense/40" },
  { text: "text-primary", bg: "bg-primary", ring: "ring-primary/40" },
  { text: "text-muted-foreground", bg: "bg-muted-foreground", ring: "ring-muted-foreground/40" },
];

const typeFilters: Array<{ label: string; value: TransactionTypeFilter }> = [
  { label: "Todas", value: "all" },
  { label: "Receitas", value: "income" },
  { label: "Despesas", value: "expense" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function textColorFromGroup(groupColor: string) {
  if (groupColor.includes("warning")) {
    return "text-warning";
  }
  if (groupColor.includes("info")) {
    return "text-info";
  }
  if (groupColor.includes("expense")) {
    return "text-expense";
  }
  if (groupColor.includes("income")) {
    return "text-income";
  }
  if (groupColor.includes("muted")) {
    return "text-muted-foreground";
  }
  return "text-primary";
}

function emptyTransactionForm(type: "income" | "expense" = "expense"): TransactionFormState {
  return {
    description: "",
    amount: "",
    occurredOn: new Date().toISOString().slice(0, 10),
    bankConnectionId: "",
    categoryId: "",
    type,
  };
}

function mapTransactionToForm(transaction: TransactionItem): TransactionFormState {
  return {
    id: String(transaction.id),
    description: transaction.description,
    amount: String(Math.abs(transaction.amount)).replace(".", ","),
    occurredOn: transaction.occurredOn,
    bankConnectionId: String(transaction.account.id),
    categoryId: String(transaction.category.id),
    type: transaction.amount >= 0 ? "income" : "expense",
  };
}

function TransactionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="glass-card p-5">
            <Skeleton className="mb-4 h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="glass-card p-4">
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="glass-card p-5">
          <div className="space-y-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 rounded-xl p-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
        <div className="glass-card p-5">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const { data: transactions = [], isLoading, isError } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: banks = [] } = useBanks();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const removeTransaction = useDeleteTransaction();
  const createCategory = useCreateCategory();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("all");
  const [datePreset, setDatePreset] = useState<TransactionsDateFilterPreset>("month");
  const [dateRange, setDateRange] = useState(() => resolvePresetRange("month"));
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>(emptyTransactionForm("expense"));
  const [categoryForm, setCategoryForm] = useState<CreateCategoryInput>({
    label: "",
    transactionType: "expense",
    icon: "Wallet",
    color: "text-income",
    groupLabel: "",
    groupColor: "bg-income",
  });

  const { filteredTransactions, summaryCardsData, categoryCounts } = useFilteredTransactionsData(transactions, categories, {
    search,
    typeFilter,
    categoryFilter,
    range: dateRange,
  });

  const deleteTarget = transactions.find((transaction) => String(transaction.id) === deleteTargetId) ?? null;
  const isEditing = Boolean(transactionForm.id);
  const filteredTransactionCategories = useMemo(
    () => categories.filter((category) => category.transactionType === transactionForm.type),
    [categories, transactionForm.type],
  );

  const openCreateTransaction = (type: "income" | "expense") => {
    setTransactionForm(emptyTransactionForm(type));
    setTransactionDialogOpen(true);
  };

  const openEditTransaction = (transaction: TransactionItem) => {
    setTransactionForm(mapTransactionToForm(transaction));
    setTransactionDialogOpen(true);
  };

  const handleTransactionSave = async () => {
    const parsedAmount = Number(transactionForm.amount.replace(",", "."));

    if (!transactionForm.description.trim() || !Number.isFinite(parsedAmount) || !transactionForm.bankConnectionId || !transactionForm.categoryId) {
      toast.error("Preencha descricao, valor, conta e categoria.");
      return;
    }

    const payload = {
      description: transactionForm.description.trim(),
      amount: transactionForm.type === "expense" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount),
      occurredOn: transactionForm.occurredOn,
      bankConnectionId: transactionForm.bankConnectionId,
      categoryId: transactionForm.categoryId,
    };

    try {
      if (transactionForm.id) {
        await updateTransaction.mutateAsync({
          id: transactionForm.id,
          ...payload,
        } satisfies UpdateTransactionInput);
        toast.success("Transacao atualizada.");
      } else {
        await createTransaction.mutateAsync(payload satisfies CreateTransactionInput);
        toast.success("Transacao criada.");
      }

      setTransactionDialogOpen(false);
      setTransactionForm(emptyTransactionForm("expense"));
    } catch (error) {
      toast.error("Nao foi possivel salvar a transacao.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleCategoryCreate = async () => {
    if (!categoryForm.label.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }

    try {
      await createCategory.mutateAsync({
        ...categoryForm,
        label: categoryForm.label.trim(),
        groupLabel: categoryForm.label.trim(),
      });
      setCategoryDialogOpen(false);
      setCategoryForm({
        label: "",
        transactionType: "expense",
        icon: "Wallet",
        color: "text-income",
        groupLabel: "",
        groupColor: "bg-income",
      });
      toast.success("Categoria criada.");
    } catch (error) {
      toast.error("Nao foi possivel criar a categoria.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deleteTargetId) {
      return;
    }

    try {
      await removeTransaction.mutateAsync(deleteTargetId);
      setDeleteTargetId(null);
      setTransactionDialogOpen(false);
      toast.success("Transacao removida.");
    } catch (error) {
      toast.error("Nao foi possivel remover a transacao.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handlePresetChange = (preset: Exclude<TransactionsDateFilterPreset, "custom">) => {
    setDatePreset(preset);
    setDateRange(resolvePresetRange(preset));
  };

  const handleCustomRangeApply = (range: { startDate: string; endDate: string }) => {
    setDatePreset("custom");
    setDateRange(range);
  };

  if (isLoading) {
    return (
      <AppShell title="Transacoes" description="Gerencie suas despesas e receitas">
        <TransactionsSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell title="Transacoes" description="Gerencie suas despesas e receitas">
      <ImportTransactionsModal open={importDialogOpen} onOpenChange={setImportDialogOpen} categories={categories} banks={banks} />

      <AlertDialog open={Boolean(deleteTargetId)} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent className="border-warning/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transacao?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `A transacao "${deleteTarget.description}" sera excluida permanentemente.`
                : "Esta transacao sera excluida permanentemente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeTransaction.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteTransaction();
              }}
              disabled={removeTransaction.isPending}
            >
              {removeTransaction.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
        <DialogContent className="max-w-[510px] border-border/70 bg-card p-6">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Transacao" : "Nova Transacao"}</DialogTitle>
            <DialogDescription className="sr-only">Formulario de transacao</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/60 p-1">
              {transactionTypeOptions.map((option) => {
                const active = transactionForm.type === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTransactionForm((current) => ({ ...current, type: option.value, categoryId: "" }))}
                    className={cn(
                      "rounded-xl px-4 py-2.5 text-sm transition-colors",
                      active
                        ? option.value === "expense"
                          ? "bg-expense/20 text-expense"
                          : "bg-income/20 text-income"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <Input
              value={transactionForm.description}
              onChange={(event) => setTransactionForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Descricao"
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />
            <Input
              value={transactionForm.amount}
              onChange={(event) => setTransactionForm((current) => ({ ...current, amount: event.target.value }))}
              placeholder="Valor"
              inputMode="decimal"
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />
            <Select
              value={transactionForm.bankConnectionId}
              onValueChange={(value) => setTransactionForm((current) => ({ ...current, bankConnectionId: value }))}
            >
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                <SelectValue placeholder="Banco ou conta" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank) => (
                  <SelectItem key={bank.id} value={String(bank.id)}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={transactionForm.categoryId}
              onValueChange={(value) => setTransactionForm((current) => ({ ...current, categoryId: value }))}
            >
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {filteredTransactionCategories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={transactionForm.occurredOn}
              onChange={(event) => setTransactionForm((current) => ({ ...current, occurredOn: event.target.value }))}
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />
          </div>

          <DialogFooter className="justify-between sm:justify-between">
            <div>
              {isEditing ? (
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTargetId(transactionForm.id ?? null)}
                  disabled={removeTransaction.isPending}
                >
                  <Trash2 size={14} />
                  Excluir
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTransactionDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void handleTransactionSave()} disabled={createTransaction.isPending || updateTransaction.isPending}>
                {createTransaction.isPending || updateTransaction.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-[510px] border-border/70 bg-card p-6">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
            <DialogDescription className="sr-only">Formulario de categoria</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              value={categoryForm.label}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              placeholder="Nome da categoria"
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/60 p-1">
              {transactionTypeOptions.map((option) => {
                const active = categoryForm.transactionType === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCategoryForm((current) => ({ ...current, transactionType: option.value }))}
                    className={cn(
                      "rounded-xl px-4 py-2.5 text-sm transition-colors",
                      active
                        ? option.value === "expense"
                          ? "bg-expense/20 text-expense"
                          : "bg-income/20 text-income"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Cor</p>
              <div className="flex flex-wrap gap-3">
                {colorSwatches.map((swatch) => (
                  <button
                    key={swatch.text}
                    type="button"
                    onClick={() =>
                      setCategoryForm((current) => ({
                        ...current,
                        color: swatch.text,
                        groupColor: swatch.bg,
                      }))
                    }
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform hover:scale-105",
                      swatch.bg,
                      categoryForm.color === swatch.text ? `scale-105 border-white ring-2 ${swatch.ring}` : "border-transparent",
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCategoryCreate()} disabled={createCategory.isPending}>
              {createCategory.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          className="rounded-xl border-border/60 bg-secondary/20"
          onClick={() => setImportDialogOpen(true)}
        >
          Importar CSV
        </Button>
        <Button
          variant="outline"
          className="rounded-xl border-border/60 bg-secondary/20"
          onClick={() => openCreateTransaction("income")}
        >
          <ArrowUpCircle size={14} />
          Receita
        </Button>
        <Button className="rounded-xl bg-income text-background hover:bg-income/90" onClick={() => openCreateTransaction("expense")}>
          <ArrowDownCircle size={14} />
          Despesa
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-card rounded-2xl border border-border/40 p-5">
          <p className="text-sm text-muted-foreground">Total Receitas</p>
          <p className="mt-2 text-[2rem] font-semibold text-income">{formatCurrency(summaryCardsData.totalIncomes)}</p>
        </div>
        <div className="glass-card rounded-2xl border border-border/40 p-5">
          <p className="text-sm text-muted-foreground">Total Despesas</p>
          <p className="mt-2 text-[2rem] font-semibold text-expense">- {formatCurrency(summaryCardsData.totalExpenses)}</p>
        </div>
        <div className="glass-card rounded-2xl border border-border/40 p-5">
          <p className="text-sm text-muted-foreground">Saldo</p>
          <p className="mt-2 text-[2rem] font-semibold text-income">{formatCurrency(summaryCardsData.balance)}</p>
        </div>
      </div>

      <div className="glass-card rounded-2xl border border-border/40 p-4">
        <div className="flex flex-col gap-3">
          <TransactionsDateFilter
            preset={datePreset}
            range={dateRange}
            onSelectPreset={handlePresetChange}
            onApplyCustomRange={handleCustomRangeApply}
          />

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar transacao..."
              className="h-11 rounded-xl border-border/60 bg-secondary/35 pl-11"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-secondary/35 text-muted-foreground">
              <Filter size={16} />
            </div>
            {typeFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setTypeFilter(filter.value)}
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm transition-colors",
                  typeFilter === filter.value
                    ? "bg-primary/15 text-primary"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.label}
              </button>
            ))}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-11 min-w-[160px] rounded-xl border-border/60 bg-secondary/35">
                <SelectValue placeholder="Todas categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categoryCounts.map((group) => (
                  <SelectItem key={group.label} value={group.label}>
                    {group.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="glass-card rounded-2xl border border-border/40 p-5">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[1.7rem] font-semibold text-foreground">Todas as Transacoes</h2>
            <span className="text-sm text-muted-foreground">{filteredTransactions.length} transações</span>
          </div>

          {!filteredTransactions.length ? (
            <div className="rounded-xl border border-border/30 bg-secondary/20 p-4 text-sm text-muted-foreground">
              {isError ? "Nao foi possivel carregar as transacoes agora." : "Nenhuma transacao encontrada para os filtros atuais."}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((transaction) => {
                const Icon = transaction.amount >= 0 ? ArrowUpCircle : ArrowDownCircle;
                const accentColor = transaction.amount >= 0 ? "text-income" : "text-expense";
                const categoryTextColor = textColorFromGroup(transaction.category.groupColor);

                return (
                  <button
                    key={transaction.id}
                    type="button"
                    onClick={() => openEditTransaction(transaction)}
                    className="group flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left transition-colors hover:bg-secondary/30"
                  >
                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-full", accentColor)}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[1.15rem] font-medium text-foreground">{transaction.description}</p>
                        <Pencil size={14} className="opacity-0 transition-opacity text-muted-foreground group-hover:opacity-100" />
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm">
                        <span className={cn("font-medium", categoryTextColor)}>{transaction.category.groupLabel}</span>
                        <span className="text-muted-foreground">{transaction.account.name}</span>
                        <span className="text-muted-foreground">{transaction.occurredOn.split("-").reverse().join("/")}</span>
                      </div>
                    </div>
                    <div className={cn("text-lg font-semibold", accentColor)}>
                      {transaction.amount >= 0 ? "+ " : "- "}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl border border-border/40 p-5">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-[1.35rem] font-semibold text-foreground">Categorias</h3>
            <button
              type="button"
              onClick={() => setCategoryDialogOpen(true)}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-5">
            {categoryCounts.map((group) => (
              <div key={group.label} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={cn("h-3 w-3 rounded-full", group.color)} />
                  <span className="text-lg text-foreground">{group.label}</span>
                </div>
                <span className="text-base text-muted-foreground">{group.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
