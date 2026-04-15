import { useMemo, useState } from "react";

import CategoryPieChart, { type CategoryPieChartItem } from "@/components/CategoryPieChart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BankItem, TransactionItem } from "@/types/api";

interface SpendingChartProps {
  transactions?: TransactionItem[];
  banks?: BankItem[];
  isLoading?: boolean;
  isError?: boolean;
}

function SpendingChartSkeleton() {
  return (
    <div className="glass-card animate-fade-in p-4 sm:p-5">
      <h3 className="mb-4 font-semibold text-foreground">Gastos por Categoria</h3>
      <Skeleton className="mb-5 h-56 w-full rounded-2xl" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function SpendingChart({ transactions = [], banks = [], isLoading, isError }: SpendingChartProps) {
  const [selectedBankId, setSelectedBankId] = useState("all");
  const chartData = useMemo<CategoryPieChartItem[]>(() => {
    type GroupedSpendingItem = {
      slug: string;
      label: string;
      color: string;
      total: number;
    };

    const filteredExpenses = transactions.filter((transaction) => {
      if (transaction.amount >= 0) {
        return false;
      }

      if (selectedBankId === "all") {
        return true;
      }

      return String(transaction.account.id) === selectedBankId;
    });

    const totalExpenses = filteredExpenses.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    const grouped = new Map<string, GroupedSpendingItem>();

    filteredExpenses.forEach((transaction) => {
      const key = transaction.category.groupSlug || transaction.category.slug;
      const current = grouped.get(key);
      const nextTotal = (current?.total ?? 0) + Math.abs(transaction.amount);

      grouped.set(key, {
        slug: key,
        label: transaction.category.groupLabel || transaction.category.label,
        color: transaction.category.groupColor || "bg-muted-foreground",
        total: nextTotal,
      });
    });

    return Array.from(grouped.values())
      .sort((left, right) => right.total - left.total)
      .map((item) => ({
        id: item.slug,
        label: item.label,
        color: item.color,
        total: item.total,
        formattedTotal: formatCurrency(item.total),
        percentage: totalExpenses > 0 ? Math.round((item.total / totalExpenses) * 100) : 0,
      }));
  }, [selectedBankId, transactions]);

  if (isLoading) {
    return <SpendingChartSkeleton />;
  }

  return (
    <div className="glass-card animate-fade-in p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold text-foreground">Gastos por Categoria</h3>
        <Select value={selectedBankId} onValueChange={setSelectedBankId}>
          <SelectTrigger className="h-9 w-full rounded-xl border-border/60 bg-secondary/35 text-xs sm:w-[180px]">
            <SelectValue placeholder="Todas as contas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {banks.map((bank) => (
              <SelectItem key={bank.id} value={String(bank.id)}>
                {bank.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!chartData.length ? (
        <div className="rounded-lg border border-border/30 bg-secondary/30 p-4 text-sm text-muted-foreground">
          {isError
            ? "Nao foi possivel carregar o consolidado por categoria."
            : selectedBankId === "all"
              ? "Ainda nao existem gastos categorizados para exibir."
              : "Nao ha despesas categorizadas para a conta selecionada."}
        </div>
      ) : (
        <CategoryPieChart
          items={chartData}
          emptyMessage="Ainda nao existem gastos categorizados para exibir."
        />
      )}
    </div>
  );
}
