import { Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCategories,
  useCreateCategory,
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
} from "@/hooks/use-transactions";
import { toast } from "@/components/ui/sonner";

const transactionTypeOptions = [
  { label: "Despesa", value: "expense" },
  { label: "Receita", value: "income" },
];

const categoryIconOptions = ["ShoppingCart", "Coffee", "Car", "Home", "Utensils", "Wallet", "Heart", "Sparkles"];
const categoryColorOptions = ["text-primary", "text-warning", "text-info", "text-income", "text-expense"];
const categoryGroupOptions = [
  { label: "Alimentacao", color: "bg-warning" },
  { label: "Moradia", color: "bg-primary" },
  { label: "Transporte", color: "bg-info" },
  { label: "Saude", color: "bg-income" },
  { label: "Outros", color: "bg-muted-foreground" },
  { label: "Lazer", color: "bg-expense" },
  { label: "Receitas", color: "bg-income" },
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

function TransactionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="glass-card p-5">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="glass-card p-5">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg p-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-10 w-24" />
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
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const removeTransaction = useDeleteTransaction();
  const createCategory = useCreateCategory();

  const [transactionForm, setTransactionForm] = useState({
    description: "",
    amount: "",
    occurredOn: new Date().toISOString().slice(0, 10),
    categoryId: "",
    type: "expense",
  });
  const [categoryForm, setCategoryForm] = useState({
    label: "",
    icon: "ShoppingCart",
    color: "text-primary",
    groupLabel: "Outros",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<Record<string, { description: string; amount: string; occurredOn: string; categoryId: string }>>(
    {},
  );

  const expenses = transactions.filter((transaction) => transaction.amount < 0);
  const incomes = transactions.filter((transaction) => transaction.amount > 0);
  const totalExpenses = expenses.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const totalIncomes = incomes.reduce((sum, transaction) => sum + transaction.amount, 0);

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        value: String(category.id),
      })),
    [categories],
  );

  const categoryFormGroup = categoryGroupOptions.find((group) => group.label === categoryForm.groupLabel) ?? categoryGroupOptions[4];

  const handleCreateTransaction = async () => {
    const parsedAmount = Number(transactionForm.amount.replace(",", "."));

    if (!transactionForm.description.trim() || !Number.isFinite(parsedAmount) || !transactionForm.categoryId) {
      toast.error("Preencha descricao, valor e categoria da transacao.");
      return;
    }

    try {
      await createTransaction.mutateAsync({
        description: transactionForm.description.trim(),
        amount: transactionForm.type === "expense" ? -Math.abs(parsedAmount) : Math.abs(parsedAmount),
        occurredOn: transactionForm.occurredOn,
        categoryId: transactionForm.categoryId,
      });

      setTransactionForm({
        description: "",
        amount: "",
        occurredOn: new Date().toISOString().slice(0, 10),
        categoryId: "",
        type: "expense",
      });
      toast.success("Transacao cadastrada com sucesso.");
    } catch (error) {
      toast.error("Nao foi possivel cadastrar a transacao.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleCreateCategory = async () => {
    if (!categoryForm.label.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }

    try {
      const category = await createCategory.mutateAsync({
        label: categoryForm.label.trim(),
        icon: categoryForm.icon,
        color: categoryForm.color,
        groupLabel: categoryForm.groupLabel,
        groupColor: categoryFormGroup.color,
      });

      setCategoryForm({
        label: "",
        icon: "ShoppingCart",
        color: "text-primary",
        groupLabel: "Outros",
      });
      setTransactionForm((current) => ({ ...current, categoryId: String(category.id) }));
      toast.success("Categoria criada com sucesso.");
    } catch (error) {
      toast.error("Nao foi possivel criar a categoria.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const startEditing = (transactionId: string, transaction: (typeof transactions)[number]) => {
    setEditingId(transactionId);
    setEditingDraft((current) => ({
      ...current,
      [transactionId]: {
        description: transaction.description,
        amount: String(Math.abs(transaction.amount)),
        occurredOn: transaction.occurredOn,
        categoryId: String(transaction.category.id),
      },
    }));
  };

  const handleUpdateTransaction = async (transactionId: string) => {
    const draft = editingDraft[transactionId];
    const currentTransaction = transactions.find((transaction) => String(transaction.id) === transactionId);
    const parsedAmount = Number(draft?.amount?.replace(",", "."));

    if (!draft || !currentTransaction || !draft.description.trim() || !Number.isFinite(parsedAmount) || !draft.categoryId) {
      toast.error("Preencha os dados da transacao antes de salvar.");
      return;
    }

    try {
      await updateTransaction.mutateAsync({
        id: transactionId,
        description: draft.description.trim(),
        amount: currentTransaction.amount < 0 ? -Math.abs(parsedAmount) : Math.abs(parsedAmount),
        occurredOn: draft.occurredOn,
        categoryId: draft.categoryId,
      });
      setEditingId(null);
      toast.success("Transacao atualizada.");
    } catch (error) {
      toast.error("Nao foi possivel atualizar a transacao.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      await removeTransaction.mutateAsync(transactionId);
      if (editingId === transactionId) {
        setEditingId(null);
      }
      toast.success("Transacao removida.");
    } catch (error) {
      toast.error("Nao foi possivel remover a transacao.", {
        description: getErrorMessage(error, "Tente novamente em instantes."),
      });
    }
  };

  if (isLoading) {
    return (
      <AppShell title="Transacoes" description="Cadastre, categorize e gerencie suas movimentacoes">
        <TransactionsSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell title="Transacoes" description="Cadastre, categorize e gerencie suas movimentacoes">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Movimentacoes</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{transactions.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Entradas</p>
          <p className="mt-1 text-2xl font-bold text-income">{formatCurrency(totalIncomes)}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-muted-foreground">Saidas</p>
          <p className="mt-1 text-2xl font-bold text-expense">{formatCurrency(totalExpenses)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="glass-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Nova transacao</h2>
            <div className="space-y-3">
              <Input
                value={transactionForm.description}
                onChange={(event) => setTransactionForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Descricao"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={transactionForm.amount}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="Valor"
                  inputMode="decimal"
                />
                <Input
                  type="date"
                  value={transactionForm.occurredOn}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, occurredOn: event.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={transactionForm.type}
                  onValueChange={(value) => setTransactionForm((current) => ({ ...current, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {transactionTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={transactionForm.categoryId}
                  onValueChange={(value) => setTransactionForm((current) => ({ ...current, categoryId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleCreateTransaction} disabled={createTransaction.isPending}>
                <Plus size={16} />
                {createTransaction.isPending ? "Salvando..." : "Adicionar transacao"}
              </Button>
            </div>
          </div>

          <div className="glass-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Nova categoria</h2>
            <div className="space-y-3">
              <Input
                value={categoryForm.label}
                onChange={(event) => setCategoryForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Nome da categoria"
              />
              <div className="grid grid-cols-2 gap-3">
                <Select value={categoryForm.icon} onValueChange={(value) => setCategoryForm((current) => ({ ...current, icon: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Icone" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryIconOptions.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={categoryForm.color} onValueChange={(value) => setCategoryForm((current) => ({ ...current, color: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cor" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryColorOptions.map((color) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Select
                value={categoryForm.groupLabel}
                onValueChange={(value) => setCategoryForm((current) => ({ ...current, groupLabel: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Grupo" />
                </SelectTrigger>
                <SelectContent>
                  {categoryGroupOptions.map((group) => (
                    <SelectItem key={group.label} value={group.label}>
                      {group.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="secondary" className="w-full" onClick={handleCreateCategory} disabled={createCategory.isPending}>
                <Plus size={16} />
                {createCategory.isPending ? "Criando..." : "Criar categoria"}
              </Button>
            </div>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Gerenciar transacoes</h2>
            <span className="text-xs text-muted-foreground">{transactions.length} registros</span>
          </div>

          {!transactions.length ? (
            <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
              {isError ? "Nao foi possivel carregar as transacoes agora." : "Nenhuma transacao encontrada."}
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => {
                const transactionId = String(transaction.id);
                const isEditing = editingId === transactionId;
                const draft = editingDraft[transactionId] ?? {
                  description: transaction.description,
                  amount: String(Math.abs(transaction.amount)),
                  occurredOn: transaction.occurredOn,
                  categoryId: String(transaction.category.id),
                };
                const Icon = transaction.category.icon;

                return (
                  <div key={transactionId} className="rounded-xl border border-border/30 bg-secondary/20 p-4">
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                        <Icon size={16} className={transaction.category.color} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {transaction.category.label} • {transaction.relativeDate}
                        </p>
                      </div>
                      <p className={`text-sm font-semibold ${transaction.amount < 0 ? "text-expense" : "text-income"}`}>
                        {transaction.formattedAmount}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_120px_140px_160px]">
                      <Input
                        value={draft.description}
                        disabled={!isEditing}
                        onChange={(event) =>
                          setEditingDraft((current) => ({
                            ...current,
                            [transactionId]: { ...draft, description: event.target.value },
                          }))
                        }
                      />
                      <Input
                        value={draft.amount}
                        disabled={!isEditing}
                        inputMode="decimal"
                        onChange={(event) =>
                          setEditingDraft((current) => ({
                            ...current,
                            [transactionId]: { ...draft, amount: event.target.value },
                          }))
                        }
                      />
                      <Input
                        type="date"
                        value={draft.occurredOn}
                        disabled={!isEditing}
                        onChange={(event) =>
                          setEditingDraft((current) => ({
                            ...current,
                            [transactionId]: { ...draft, occurredOn: event.target.value },
                          }))
                        }
                      />
                      <Select
                        value={draft.categoryId}
                        disabled={!isEditing}
                        onValueChange={(value) =>
                          setEditingDraft((current) => ({
                            ...current,
                            [transactionId]: { ...draft, categoryId: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingId(null)}
                            disabled={updateTransaction.isPending}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => void handleUpdateTransaction(transactionId)}
                            disabled={updateTransaction.isPending}
                          >
                            <Save size={14} />
                            Salvar
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => startEditing(transactionId, transaction)}>
                          Editar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void handleDeleteTransaction(transactionId)}
                        disabled={removeTransaction.isPending}
                      >
                        <Trash2 size={14} />
                        Excluir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
