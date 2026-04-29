import { ArrowDownCircle, ArrowUpCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import CategoryPieChart from "@/components/CategoryPieChart";
import ImportTransactionsModal from "@/components/transactions/ImportTransactionsModal";
import TransactionsDateFilter from "@/components/transactions/TransactionsDateFilter";
import TransactionsMonthYearFilter from "@/components/transactions/TransactionsMonthYearFilter";
import MetricInfoTooltip from "@/components/MetricInfoTooltip";
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
import { DatePickerInput } from "@/components/ui/date-picker-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBanks } from "@/hooks/use-banks";
import { useFilteredTransactionsData } from "@/hooks/use-filtered-transactions-data";
import { useUrlPeriodFilter } from "@/hooks/use-url-period-filter";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateCategory,
  useUpdateTransaction,
} from "@/hooks/use-transactions";
import {
  TRANSACTIONS_YEAR_SELECTION,
  getCurrentMonthSelection,
  resolveMonthYearRange,
} from "@/lib/transactions-date-filter";
import { DEFAULT_CATEGORY_COLOR, resolveCategoryColorPresentation } from "@/lib/category-colors";
import { cn } from "@/lib/utils";
import type { CreateCategoryInput, CreateTransactionInput, TransactionItem, UpdateTransactionInput } from "@/types/api";
import { toast } from "@/components/ui/sonner";

type TransactionTypeFilter = "all" | "income" | "expense";
type TransactionFormState = {
  id?: string;
  sourceTransactionId?: string;
  description: string;
  amount: string;
  occurredOn: string;
  bankConnectionId: string;
  categoryId: string;
  type: "income" | "expense";
  isRecurring: boolean;
};

const transactionTypeOptions: Array<{ label: string; value: "income" | "expense" }> = [
  { label: "Receita", value: "income" },
  { label: "Despesa", value: "expense" },
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

function emptyTransactionForm(type: "income" | "expense" = "expense"): TransactionFormState {
  return {
    description: "",
    amount: "",
    occurredOn: new Date().toISOString().slice(0, 10),
    bankConnectionId: "",
    categoryId: "",
    type,
    isRecurring: false,
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
    isRecurring: Boolean(transaction.isRecurring),
    sourceTransactionId: String(transaction.sourceTransactionId ?? transaction.id),
  };
}

function TransactionsSkeleton() {
  return (
    <div className="space-y-6">
      <div data-tour-id="transactions-summary" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="glass-card p-5">
            <Skeleton className="mb-4 h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
      <div data-tour-id="transactions-filters" className="glass-card p-4">
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div data-tour-id="transactions-table" className="glass-card p-5">
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
        <div data-tour-id="transactions-categories" className="glass-card p-5">
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
  const updateCategory = useUpdateCategory();
  const removeCategory = useDeleteCategory();
  const currentSelection = getCurrentMonthSelection();
  const {
    selectedMonthIndex,
    selectedYear,
    datePreset,
    dateRange,
    handleMonthChange,
    handleYearChange,
    handlePresetChange,
    handleCustomRangeApply,
  } = useUrlPeriodFilter({
    selectedMonthIndex: currentSelection.monthIndex,
    selectedYear: currentSelection.year,
    datePreset: currentSelection.monthIndex === TRANSACTIONS_YEAR_SELECTION ? "year" : "month",
    dateRange: resolveMonthYearRange(currentSelection.monthIndex, currentSelection.year),
  });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("all");
  const [selectedAccountType, setSelectedAccountType] = useState<"all" | "bank_account" | "credit_card">("all");
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [deleteCategoryTargetId, setDeleteCategoryTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingCategoryTransactionId, setEditingCategoryTransactionId] = useState<string | null>(null);
  const [updatingCategoryTransactionId, setUpdatingCategoryTransactionId] = useState<string | null>(null);
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>(emptyTransactionForm("expense"));
  const [categoryForm, setCategoryForm] = useState<CreateCategoryInput>({
    label: "",
    transactionType: "expense",
    icon: "Wallet",
    color: DEFAULT_CATEGORY_COLOR,
    groupLabel: "",
    groupColor: DEFAULT_CATEGORY_COLOR,
  });
  const transactionBanks = useMemo(
    () =>
      banks.filter((bank) => {
        if (transactionForm.type === "income") {
          return bank.accountType === "bank_account" || bank.accountType === "cash";
        }

        return bank.accountType === "bank_account" || bank.accountType === "credit_card" || bank.accountType === "cash";
      }),
    [banks, transactionForm.type],
  );
  const bankAccounts = useMemo(() => banks.filter((bank) => bank.accountType === "bank_account"), [banks]);
  const creditCards = useMemo(() => banks.filter((bank) => bank.accountType === "credit_card"), [banks]);
  const selectedBankAccount = useMemo(
    () => bankAccounts.find((bank) => String(bank.id) === selectedBankAccountId) ?? null,
    [bankAccounts, selectedBankAccountId],
  );
  const availableAccountTypeOptions = useMemo(() => {
    if (!selectedBankAccount) {
      return [];
    }

    const hasLinkedCards = creditCards.some(
      (card) => String(card.parentBankConnectionId) === String(selectedBankAccount.id),
    );

    return [
      { value: "bank_account" as const, label: "Conta corrente" },
      ...(hasLinkedCards ? [{ value: "credit_card" as const, label: "Cartão" }] : []),
    ];
  }, [creditCards, selectedBankAccount]);
  const selectedBankLinkedCardIds = useMemo(
    () =>
      new Set(
        creditCards
          .filter((card) => String(card.parentBankConnectionId) === String(selectedBankAccount?.id))
          .map((card) => String(card.id)),
      ),
    [creditCards, selectedBankAccount],
  );

  useEffect(() => {
    if (!selectedBankAccount) {
      setSelectedAccountType("all");
      return;
    }

    if (availableAccountTypeOptions.length === 1) {
      setSelectedAccountType(availableAccountTypeOptions[0].value);
      return;
    }

    const isCurrentTypeAvailable =
      selectedAccountType === "all" || availableAccountTypeOptions.some((option) => option.value === selectedAccountType);

    if (!isCurrentTypeAvailable) {
      setSelectedAccountType("all");
    }
  }, [availableAccountTypeOptions, selectedAccountType, selectedBankAccount]);

  const visibleTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) => {
          const isSupportedAccountType =
            transaction.account.accountType === "bank_account" ||
            transaction.account.accountType === "credit_card" ||
            transaction.account.accountType === "cash";

          if (transaction.housingId !== null || !isSupportedAccountType) {
            return false;
          }

          if (!selectedBankAccount) {
            return true;
          }

          const transactionAccountId = String(transaction.account.id);
          const isSelectedBankTransaction = transactionAccountId === String(selectedBankAccount.id);
          const isLinkedCardTransaction = selectedBankLinkedCardIds.has(transactionAccountId);

          if (selectedAccountType === "bank_account") {
            return isSelectedBankTransaction;
          }

          if (selectedAccountType === "credit_card") {
            return isLinkedCardTransaction;
          }

          return isSelectedBankTransaction || isLinkedCardTransaction;
        },
      ),
    [selectedAccountType, selectedBankAccount, selectedBankLinkedCardIds, transactions],
  );
  const { filteredTransactions, summaryCardsData, categoryBreakdown, breakdownTransactionType } = useFilteredTransactionsData(visibleTransactions, categories, {
    search,
    typeFilter,
    categoryFilter,
    range: dateRange,
  });
  const categoriesWithBreakdown = useMemo(() => {
    const breakdownById = new Map(categoryBreakdown.map((item) => [item.id, item]));

    return categories
      .filter((category) => category.transactionType === breakdownTransactionType)
      .map((category) => {
        const breakdown = breakdownById.get(String(category.id));

        return {
          id: String(category.id),
          label: category.label,
          color: category.groupColor || category.color,
          count: breakdown?.count ?? 0,
          total: breakdown?.total ?? 0,
        };
      })
      .sort((left, right) => right.count - left.count || right.total - left.total || left.label.localeCompare(right.label, "pt-BR"));
  }, [breakdownTransactionType, categories, categoryBreakdown]);

  const deleteTarget = visibleTransactions.find((transaction) => String(transaction.id) === deleteTargetId) ?? null;
  const editingCategory = categories.find((category) => String(category.id) === editingCategoryId) ?? null;
  const deleteCategoryTarget = categories.find((category) => String(category.id) === deleteCategoryTargetId) ?? null;
  const isEditing = Boolean(transactionForm.id);
  const filteredTransactionCategories = useMemo(
    () => categories.filter((category) => category.transactionType === transactionForm.type),
    [categories, transactionForm.type],
  );
  const categoryIsRequired = transactionForm.type === "income";

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

    if (
      !transactionForm.description.trim() ||
      !Number.isFinite(parsedAmount) ||
      !transactionForm.bankConnectionId ||
      (categoryIsRequired && !transactionForm.categoryId)
    ) {
      toast.error(categoryIsRequired ? "Preencha descrição, valor, conta e categoria." : "Preencha descrição, valor e conta.");
      return;
    }

    const payload = {
      description: transactionForm.description.trim(),
      amount: transactionForm.type === "expense" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount),
      occurredOn: transactionForm.occurredOn,
      bankConnectionId: transactionForm.bankConnectionId,
      isRecurring: transactionForm.type === "income" ? transactionForm.isRecurring : false,
      ...(transactionForm.categoryId ? { categoryId: transactionForm.categoryId } : {}),
    };

    try {
      if (transactionForm.id) {
        await updateTransaction.mutateAsync({
          id: transactionForm.sourceTransactionId ?? transactionForm.id,
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
      toast.error("Não foi possível salvar a transação.", {
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
      if (editingCategoryId) {
        await updateCategory.mutateAsync({
          id: editingCategoryId,
          ...categoryForm,
          label: categoryForm.label.trim(),
          groupLabel: categoryForm.label.trim(),
        });
        toast.success("Categoria atualizada.");
      } else {
        await createCategory.mutateAsync({
          ...categoryForm,
          label: categoryForm.label.trim(),
          groupLabel: categoryForm.label.trim(),
        });
        toast.success("Categoria criada.");
      }
      setCategoryDialogOpen(false);
      setEditingCategoryId(null);
      setCategoryForm({
        label: "",
        transactionType: "expense",
        icon: "Wallet",
        color: DEFAULT_CATEGORY_COLOR,
        groupLabel: "",
        groupColor: DEFAULT_CATEGORY_COLOR,
      });
    } catch (error) {
      toast.error(editingCategoryId ? "Não foi possível atualizar a categoria." : "Não foi possível criar a categoria.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await removeTransaction.mutateAsync({
        id: deleteTarget.sourceTransactionId ?? deleteTarget.id,
        occurredOn: deleteTarget.occurredOn,
      });
      setDeleteTargetId(null);
      setTransactionDialogOpen(false);
      toast.success("Transacao removida.");
    } catch (error) {
      toast.error("Não foi possível remover a transação.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryTargetId) {
      return;
    }

    try {
      await removeCategory.mutateAsync(deleteCategoryTargetId);
      setDeleteCategoryTargetId(null);
      setCategoryDialogOpen(false);
      setEditingCategoryId(null);
      setCategoryForm({
        label: "",
        transactionType: "expense",
        icon: "Wallet",
        color: DEFAULT_CATEGORY_COLOR,
        groupLabel: "",
        groupColor: DEFAULT_CATEGORY_COLOR,
      });
      setCategoryFilter((current) => (current === deleteCategoryTargetId ? "all" : current));
      toast.success("Categoria removida.");
    } catch (error) {
      toast.error("Não foi possível remover a categoria.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleInlineCategoryChange = async (transaction: TransactionItem, nextCategoryId: string) => {
    if (!nextCategoryId || String(transaction.category.id) === nextCategoryId) {
      setEditingCategoryTransactionId(null);
      return;
    }

    setUpdatingCategoryTransactionId(String(transaction.id));

    try {
      await updateTransaction.mutateAsync({
        id: transaction.sourceTransactionId ?? transaction.id,
        description: transaction.description,
        amount: transaction.amount,
        occurredOn: transaction.occurredOn,
        bankConnectionId: transaction.account.id,
        categoryId: nextCategoryId,
        isRecurring: transaction.isRecurring,
      } satisfies UpdateTransactionInput);
      setEditingCategoryTransactionId(null);
      toast.success("Categoria atualizada.");
    } catch (error) {
      toast.error("Não foi possível atualizar a categoria.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    } finally {
      setUpdatingCategoryTransactionId(null);
    }
  };

  const handleCategoryFilterChange = (nextCategoryId: string) => {
    setCategoryFilter((current) => (current === nextCategoryId ? "all" : nextCategoryId));
  };

  const renderTransactionsTable = () => {
    if (!filteredTransactions.length) {
      return (
        <div className="rounded-2xl border border-border/30 bg-secondary/20 p-6 text-sm text-muted-foreground">
          {isError ? "Não foi possível carregar as transações agora." : "Nenhuma transação encontrada para os filtros atuais."}
        </div>
      );
    }

    return (
      <Table className="min-w-[1080px]">
        <TableHeader>
          <TableRow>
            <TableHead>Transacao</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Conta</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-[96px] text-right">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTransactions.map((transaction) => {
            const accentColor = transaction.amount >= 0 ? "text-income" : "text-expense";
            const categoryColor = resolveCategoryColorPresentation(transaction.category.groupColor || transaction.category.color);
            const transactionCategories = categories.filter(
              (category) => category.transactionType === (transaction.amount >= 0 ? "income" : "expense"),
            );
            const isEditingCategory = editingCategoryTransactionId === String(transaction.id);
            const isUpdatingCategory = updatingCategoryTransactionId === String(transaction.id);

            return (
              <TableRow key={transaction.id}>
                <TableCell>
                  <div className="space-y-1">
                    <button type="button" onClick={() => openEditTransaction(transaction)} className="text-left font-medium text-foreground transition-colors hover:text-primary">
                      {transaction.description}
                    </button>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {transaction.isRecurring ? <span className="rounded-full bg-income/10 px-2 py-0.5 font-medium text-income">Recorrente</span> : null}
                      {transaction.isRecurringProjection ? <span>Ocorrencia gerada automaticamente</span> : null}
                      {transaction.isInstallment && transaction.installmentNumber && transaction.installmentCount ? (
                        <span className="rounded-full bg-info/10 px-2 py-0.5 font-medium text-info">
                          {transaction.installmentNumber}/{transaction.installmentCount}
                        </span>
                      ) : null}
                      {transaction.isInstallment && transaction.purchaseOccurredOn ? (
                        <span>Compra em {transaction.purchaseOccurredOn.split("-").reverse().join("/")}</span>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {isEditingCategory ? (
                    <div className="min-w-[168px]">
                      <Select
                        open={isEditingCategory}
                        onOpenChange={(open) => {
                          if (!open) {
                            setEditingCategoryTransactionId(null);
                          }
                        }}
                        value={String(transaction.category.id)}
                        onValueChange={(value) => {
                          void handleInlineCategoryChange(transaction, value);
                        }}
                      >
                        <SelectTrigger className="h-8 w-full rounded-lg border-border/60 bg-secondary/35 text-xs">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {transactionCategories.map((category) => (
                            <SelectItem key={category.id} value={String(category.id)}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="max-w-full rounded-md px-1.5 py-0.5 text-left font-medium transition-colors hover:bg-secondary/50"
                      style={{ color: categoryColor.text }}
                      onClick={() => {
                        if (isUpdatingCategory) {
                          return;
                        }
                        setEditingCategoryTransactionId(String(transaction.id));
                      }}
                      disabled={isUpdatingCategory}
                    >
                      {isUpdatingCategory ? "Atualizando..." : transaction.category.label}
                    </button>
                  )}
                </TableCell>
                <TableCell>{transaction.account.name}</TableCell>
                <TableCell>{transaction.occurredOn.split("-").reverse().join("/")}</TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">
                  {transaction.amount >= 0 ? "Receita" : "Despesa"}
                </TableCell>
                <TableCell className={cn("text-right font-semibold", accentColor)}>
                  {transaction.amount >= 0 ? "+ " : "- "}
                  {formatCurrency(Math.abs(transaction.amount))}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditTransaction(transaction)}>
                      <Pencil size={14} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  if (isLoading) {
    return (
      <AppShell title="Transações" description="Gerencie suas despesas e receitas">
        <TransactionsSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell title="Transações" description="Gerencie suas despesas e receitas">
      <ImportTransactionsModal open={importDialogOpen} onOpenChange={setImportDialogOpen} categories={categories} banks={banks} />

      <AlertDialog open={Boolean(deleteTargetId)} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent className="border-warning/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `A transação "${deleteTarget.description}" será excluída permanentemente.`
                : "Esta transação será excluída permanentemente."}
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

      <AlertDialog open={Boolean(deleteCategoryTargetId)} onOpenChange={(open) => !open && setDeleteCategoryTargetId(null)}>
        <AlertDialogContent className="border-warning/20 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCategoryTarget
                ? `A categoria "${deleteCategoryTarget.label}" será excluída e as referências vinculadas serão movidas para ${deleteCategoryTarget.transactionType === "income" ? '"Salário"' : '"Outros"'}.`
                : "A categoria será excluída e as referências vinculadas serão movidas para uma categoria padrão."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeCategory.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteCategory();
              }}
              disabled={removeCategory.isPending}
            >
              {removeCategory.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
        <DialogContent className="max-w-[510px] border-border/70 bg-card p-6">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Transação" : "Nova Transação"}</DialogTitle>
            <DialogDescription className="sr-only">Formulário de transação</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/60 p-1">
              {transactionTypeOptions.map((option) => {
                const active = transactionForm.type === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setTransactionForm((current) => ({
                        ...current,
                        type: option.value,
                        bankConnectionId:
                          option.value === "income" &&
                          banks.some(
                            (bank) =>
                              String(bank.id) === current.bankConnectionId && bank.accountType === "credit_card",
                          )
                            ? ""
                            : current.bankConnectionId,
                        categoryId: "",
                        isRecurring: option.value === "income" ? current.isRecurring : false,
                      }))
                    }
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
                  <SelectValue placeholder={transactionForm.type === "income" ? "Conta ou caixa" : "Conta, cartão ou caixa"} />
                </SelectTrigger>
              <SelectContent>
                {transactionBanks.map((bank) => (
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
                <SelectValue placeholder={categoryIsRequired ? "Categoria" : "Categoria (opcional)"} />
              </SelectTrigger>
              <SelectContent>
                {filteredTransactionCategories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!categoryIsRequired ? (
              <p className="text-xs text-muted-foreground">Se não escolher, a despesa será salva como Outros.</p>
            ) : null}
            {transactionForm.type === "income" ? (
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-secondary/20 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Receita recorrente</p>
                  <p className="text-xs text-muted-foreground">
                    Quando ativa, essa renda será projetada automaticamente nos próximos meses.
                  </p>
                </div>
                <Switch
                  checked={transactionForm.isRecurring}
                  onCheckedChange={(checked) => setTransactionForm((current) => ({ ...current, isRecurring: checked }))}
                  aria-label="Marcar receita como recorrente"
                />
              </div>
            ) : null}
            <DatePickerInput
              value={transactionForm.occurredOn}
              onChange={(value) => setTransactionForm((current) => ({ ...current, occurredOn: value }))}
              className="h-11"
              placeholder="Selecione a data"
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
            <DialogTitle>{editingCategoryId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
            <DialogDescription className="sr-only">Formulário de categoria</DialogDescription>
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
                    onClick={() => {
                      if (editingCategoryId) {
                        return;
                      }
                      setCategoryForm((current) => ({ ...current, transactionType: option.value }));
                    }}
                    className={cn(
                      "rounded-xl px-4 py-2.5 text-sm transition-colors",
                      active
                        ? option.value === "expense"
                          ? "bg-expense/20 text-expense"
                          : "bg-income/20 text-income"
                        : "text-muted-foreground hover:text-foreground",
                      editingCategoryId && "cursor-not-allowed opacity-60",
                    )}
                    disabled={Boolean(editingCategoryId)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <ColorField
              label="Cor"
              value={categoryForm.groupColor || categoryForm.color}
              onChange={(nextColor) =>
                setCategoryForm((current) => ({
                  ...current,
                  color: nextColor,
                  groupColor: nextColor,
                }))
              }
              inputAriaLabel="Selecionar cor da categoria"
              fallback={DEFAULT_CATEGORY_COLOR}
            />
          </div>

          <DialogFooter className="justify-between sm:justify-between">
            <div>
              {editingCategory && editingCategory.isSystem === false ? (
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteCategoryTargetId(String(editingCategory.id))}
                  disabled={removeCategory.isPending}
                >
                  <Trash2 size={14} />
                  Excluir
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => void handleCategoryCreate()}
                disabled={createCategory.isPending || updateCategory.isPending || removeCategory.isPending}
              >
                {createCategory.isPending || updateCategory.isPending
                  ? editingCategoryId
                    ? "Salvando..."
                    : "Criando..."
                  : editingCategoryId
                    ? "Salvar"
                    : "Criar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div data-tour-id="transactions-filters" className="glass-card rounded-[28px] border border-border/40 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
            <TransactionsMonthYearFilter
              selectedMonthIndex={selectedMonthIndex}
              selectedYear={selectedYear}
              onMonthChange={handleMonthChange}
              onYearChange={handleYearChange}
            />

            <TransactionsDateFilter
              preset={datePreset}
              range={dateRange}
              onSelectPreset={handlePresetChange}
              onApplyCustomRange={handleCustomRangeApply}
              showPresetButtons={false}
            />

            {bankAccounts.length ? (
              <div
                className={cn(
                  "grid gap-3",
                  selectedBankAccount ? "md:grid-cols-2 xl:min-w-[460px]" : "xl:min-w-[220px]",
                )}
              >
                <div className="space-y-1.5">
                  <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                    <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35">
                      <SelectValue placeholder="Todas as contas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as contas</SelectItem>
                      {bankAccounts.map((bank) => (
                        <SelectItem key={bank.id} value={String(bank.id)}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedBankAccount ? (
                  <div className="space-y-1.5">
                    <Select
                      value={selectedAccountType}
                      onValueChange={(value) => setSelectedAccountType(value as "all" | "bank_account" | "credit_card")}
                    >
                      <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35">
                        <SelectValue placeholder="Tipo da conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAccountTypeOptions.length > 1 ? <SelectItem value="all">Todos</SelectItem> : null}
                        {availableAccountTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : null}

            <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value)}>
              <SelectTrigger
                data-testid="transactions-category-filter-trigger-hidden"
                className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:flex-1"
              >
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categoriesWithBreakdown.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar transação..."
                className="h-11 rounded-xl border-border/60 bg-secondary/35 pl-11"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 xl:flex xl:flex-wrap">
              {typeFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setTypeFilter(filter.value)}
                  className={cn(
                    "min-h-11 rounded-2xl px-3 py-2 text-center text-sm transition-colors sm:px-4 sm:py-2.5",
                    typeFilter === filter.value
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              {dateRange.startDate.split("-").reverse().join("/")} - {dateRange.endDate.split("-").reverse().join("/")}
            </div>
            
          </div>
        </div>
      </div>

      <div data-tour-id="transactions-summary" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-card rounded-2xl border border-border/40 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Total Receitas</p>
            <MetricInfoTooltip content="Soma de todas as transações de receita visíveis com os filtros atuais de período, busca, tipo e categoria." />
          </div>
          <p className="mt-2 text-[2rem] font-semibold text-income">{formatCurrency(summaryCardsData.totalIncomes)}</p>
        </div>
        <div className="glass-card rounded-2xl border border-border/40 p-5">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Total Despesas</p>
            <MetricInfoTooltip content="Soma de todas as transações de despesa visíveis com os filtros atuais de período, busca, tipo e categoria." />
          </div>
          <p className="mt-2 text-[2rem] font-semibold text-expense">- {formatCurrency(summaryCardsData.totalExpenses)}</p>
        </div>
        <div className="glass-card rounded-2xl border border-border/40 p-5">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Saldo</p>
            <MetricInfoTooltip content="Resultado entre o total de receitas e o total de despesas dentro dos filtros aplicados na tela." />
          </div>
          <p className="mt-2 text-[2rem] font-semibold text-income">{formatCurrency(summaryCardsData.balance)}</p>
        </div>
      </div>

      <div hidden className="hidden rounded-2xl border border-border/40 p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
            <TransactionsMonthYearFilter
              selectedMonthIndex={selectedMonthIndex}
              selectedYear={selectedYear}
              onMonthChange={handleMonthChange}
              onYearChange={handleYearChange}
            />

            <TransactionsDateFilter
              preset={datePreset}
              range={dateRange}
              onSelectPreset={handlePresetChange}
              onApplyCustomRange={handleCustomRangeApply}
              showPresetButtons={false}
            />

            {bankAccounts.length ? (
              <div
                className={cn(
                  "grid gap-3",
                  selectedBankAccount ? "md:grid-cols-2 xl:min-w-[460px]" : "xl:min-w-[220px]",
                )}
              >
                <div className="space-y-1.5">
                  <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                    <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35">
                      <SelectValue placeholder="Todas as contas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as contas</SelectItem>
                      {bankAccounts.map((bank) => (
                        <SelectItem key={bank.id} value={String(bank.id)}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedBankAccount ? (
                  <div className="space-y-1.5">
                    <Select
                      value={selectedAccountType}
                      onValueChange={(value) => setSelectedAccountType(value as "all" | "bank_account" | "credit_card")}
                    >
                      <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35">
                        <SelectValue placeholder="Tipo da conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAccountTypeOptions.length > 1 ? <SelectItem value="all">Todos</SelectItem> : null}
                        {availableAccountTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : null}

            <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value)}>
              <SelectTrigger
                data-testid="transactions-category-filter-trigger"
                className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:flex-1"
              >
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categoriesWithBreakdown.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar transação..."
                className="h-11 rounded-xl border-border/60 bg-secondary/35 pl-11"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 xl:flex xl:flex-wrap">
              {typeFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setTypeFilter(filter.value)}
                  className={cn(
                    "min-h-11 rounded-2xl px-3 py-2 text-center text-sm transition-colors sm:px-4 sm:py-2.5",
                    typeFilter === filter.value
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div data-tour-id="transactions-table" className="glass-card rounded-2xl border border-border/40 p-5">
          <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[1.35rem] font-semibold text-foreground sm:text-[1.7rem]">Todas as Transações</h2>
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <Button
                variant="outline"
                className="w-full rounded-xl border-border/60 bg-secondary/20 sm:w-auto"
                onClick={() => setImportDialogOpen(true)}
              >
                Importar CSV/PDF
              </Button>
            <Button
                variant="outline"
                className="w-full rounded-xl border-border/60 bg-secondary/20 sm:w-auto"
                aria-label="Nova transação"
                onClick={() => openCreateTransaction("income")}
              >
                <ArrowUpCircle size={14} />
                /
                <ArrowDownCircle size={14} />
              </Button>
            </div>
          </div>
          {renderTransactionsTable()}
          <div className="flex flex-col sm:flex-row sm:justify-end">
          <span className="text-sm text-muted-foreground sm:justify-end">{filteredTransactions.length} transações</span>
          </div>
        </div>

        <div data-tour-id="transactions-categories" className="glass-card rounded-2xl border border-border/40 p-5">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-[1.35rem] font-semibold text-foreground">Categorias</h3>
            <button
              type="button"
              onClick={() => {
                setEditingCategoryId(null);
                setCategoryForm({
                  label: "",
                  transactionType: "expense",
                  icon: "Wallet",
                  color: DEFAULT_CATEGORY_COLOR,
                  groupLabel: "",
                  groupColor: DEFAULT_CATEGORY_COLOR,
                });
                setCategoryDialogOpen(true);
              }}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Nova categoria"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-5">
            <CategoryPieChart
              items={categoryBreakdown}
              selectedItemId={categoryFilter === "all" ? undefined : categoryFilter}
              onSelectItem={handleCategoryFilterChange}
              emptyMessage="Nenhuma categoria encontrada para os filtros atuais."
              isError={isError}
              emptyErrorMessage="Não foi possível carregar o consolidado por categoria."
            />

            {categoriesWithBreakdown.length ? (
              <div className="space-y-2 border-t border-border/40 pt-4">
                {categoriesWithBreakdown.map((categoryItem) => {
                  const color = resolveCategoryColorPresentation(categoryItem.color);
                  const selected = categoryFilter === categoryItem.id;

                  return (
                    <div
                      key={categoryItem.id}
                      className="group grid grid-cols-[minmax(0,1fr)_44px_24px] items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-secondary/30"
                      style={selected ? { backgroundColor: color.soft } : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => handleCategoryFilterChange(categoryItem.id)}
                        className="flex min-w-0 items-center gap-2.5 text-left"
                        aria-label={`Filtrar por categoria ${categoryItem.label}`}
                        aria-pressed={selected}
                      >
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color.solid }} />
                        <span className="break-words text-[0.96rem] font-medium leading-snug text-foreground">{categoryItem.label}</span>
                      </button>
                      <span className="text-right text-sm tabular-nums text-muted-foreground">{categoryItem.count}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const category = categories.find((item) => String(item.id) === categoryItem.id);

                          if (!category) {
                            return;
                          }

                          setEditingCategoryId(categoryItem.id);
                          setCategoryForm({
                            label: category.label,
                            transactionType: category.transactionType,
                            icon: category.iconName || "Wallet",
                            color: category.color,
                            groupLabel: category.label,
                            groupColor: category.groupColor,
                          });
                          setCategoryDialogOpen(true);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100"
                        aria-label={`Editar categoria ${categoryItem.label}`}
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
