import { Download, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InstallmentSortBy, InstallmentSortOrder, InstallmentsOverview, InstallmentsOverviewFilters } from "@/types/api";

interface InstallmentsFiltersProps {
  filters: InstallmentsOverviewFilters;
  overview?: InstallmentsOverview;
  onChange: (nextFilters: InstallmentsOverviewFilters) => void;
  onExportCsv: () => void;
}

export default function InstallmentsFilters({ filters, overview, onChange, onExportCsv }: InstallmentsFiltersProps) {
  const amountRange = overview?.filterOptions.installmentAmountRange;

  const update = <K extends keyof InstallmentsOverviewFilters>(key: K, value: InstallmentsOverviewFilters[K]) => {
    onChange({
      ...filters,
      [key]: value,
    });
  };

  const handleNumberInput = (key: "installmentAmountMin" | "installmentAmountMax", value: string) => {
    const normalized = value.trim();
    update(key, normalized ? Number(normalized.replace(",", ".")) : null);
  };

  return (
    <div className="glass-card rounded-2xl border border-border/40 p-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-4">
        <label className="space-y-1 text-sm text-muted-foreground">
          <span>Cartao</span>
          <Select
            value={filters.cardId}
            onValueChange={(value) => update("cardId", value)}
          >
            <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
              <SelectValue placeholder="Todos os cartoes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os cartoes</SelectItem>
              {overview?.filterOptions.cards.map((card) => (
                <SelectItem key={card.id} value={String(card.id)}>
                  {card.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1 text-sm text-muted-foreground">
          <span>Categoria</span>
          <Select
            value={filters.categoryId}
            onValueChange={(value) => update("categoryId", value)}
          >
            <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {overview?.filterOptions.categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1 text-sm text-muted-foreground">
          <span>Status</span>
          <Select
            value={filters.status}
            onValueChange={(value) => update("status", value as InstallmentsOverviewFilters["status"])}
          >
            <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="overdue">Em atraso</SelectItem>
              <SelectItem value="paid">Quitados</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1 text-sm text-muted-foreground">
          <span>Ordenacao</span>
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
            <Select
              value={filters.sortBy}
              onValueChange={(value) => update("sortBy", value as InstallmentSortBy)}
            >
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                <SelectValue placeholder="Inteligente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="smart">Inteligente</SelectItem>
                <SelectItem value="installment_amount">Maior parcela</SelectItem>
                <SelectItem value="remaining_balance">Maior saldo</SelectItem>
                <SelectItem value="next_due_date">Proximo vencimento</SelectItem>
                <SelectItem value="purchase_date">Data da compra</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.sortOrder}
              onValueChange={(value) => update("sortOrder", value as InstallmentSortOrder)}
            >
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                <SelectValue placeholder="Desc" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Desc</SelectItem>
                <SelectItem value="asc">Asc</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-4">
        <label className="space-y-1 text-sm text-muted-foreground">
          <span>Parcela minima</span>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={filters.installmentAmountMin ?? ""}
            min={amountRange?.min ?? 0}
            max={amountRange?.max ?? undefined}
            onChange={(event) => handleNumberInput("installmentAmountMin", event.target.value)}
            placeholder={amountRange ? String(amountRange.min) : "0,00"}
            className="h-11 rounded-xl border-border/60 bg-secondary/35"
          />
        </label>

        <label className="space-y-1 text-sm text-muted-foreground">
          <span>Parcela maxima</span>
          <Input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={filters.installmentAmountMax ?? ""}
            min={amountRange?.min ?? 0}
            max={amountRange?.max ?? undefined}
            onChange={(event) => handleNumberInput("installmentAmountMax", event.target.value)}
            placeholder={amountRange ? String(amountRange.max) : "0,00"}
            className="h-11 rounded-xl border-border/60 bg-secondary/35"
          />
        </label>

        <label className="space-y-1 text-sm text-muted-foreground">
          <span>Compra de</span>
          <DatePickerInput
            value={filters.purchaseStart ?? ""}
            onChange={(value) => update("purchaseStart", value || null)}
            className="h-11"
            placeholder="Selecione a data inicial"
          />
        </label>

        <label className="space-y-1 text-sm text-muted-foreground">
          <span>Compra ate</span>
          <DatePickerInput
            value={filters.purchaseEnd ?? ""}
            onChange={(value) => update("purchaseEnd", value || null)}
            className="h-11"
            placeholder="Selecione a data final"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          className="rounded-xl border-border/60 bg-secondary/20"
          onClick={() =>
            onChange({
              cardId: "all",
              categoryId: "all",
              status: "all",
              installmentAmountMin: null,
              installmentAmountMax: null,
              purchaseStart: null,
              purchaseEnd: null,
              sortBy: "smart",
              sortOrder: "desc",
            })
          }
        >
          <RotateCcw size={14} />
          Limpar filtros
        </Button>
        <Button className="rounded-xl" onClick={onExportCsv}>
          <Download size={14} />
          Exportar CSV
        </Button>
      </div>
    </div>
  );
}
