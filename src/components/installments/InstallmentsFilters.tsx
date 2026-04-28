import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  InstallmentCountMode,
  InstallmentSortBy,
  InstallmentSortOrder,
  InstallmentsOverview,
  InstallmentsOverviewFilters,
} from "@/types/api";

interface InstallmentsFiltersProps {
  filters: InstallmentsOverviewFilters;
  appliedRangeLabel: string;
  overview?: InstallmentsOverview;
  onChange: (nextFilters: InstallmentsOverviewFilters) => void;
  onResetFilters: () => void;
  onExportCsv: () => void;
}

export default function InstallmentsFilters({
  filters,
  appliedRangeLabel,
  overview,
  onChange,
  onResetFilters,
  onExportCsv: _onExportCsv,
}: InstallmentsFiltersProps) {
  const amountRange = overview?.filterOptions.installmentAmountRange;
  const installmentCountOptions =
    filters.installmentCountMode === "remaining_installments"
      ? overview?.filterOptions.remainingInstallmentValues ?? []
      : overview?.filterOptions.installmentCountValues ?? [];
  const shouldShowInstallmentCountValueSelect = filters.installmentCountMode !== "all";

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
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-4">
        <label className="space-y-1 text-sm text-muted-foreground">
          <span>CartÃ£o</span>
          <Select value={filters.cardId} onValueChange={(value) => update("cardId", value)}>
            <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
              <SelectValue placeholder="Todos os cartÃµes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os cartÃµes</SelectItem>
              {overview?.filterOptions.cards.map((card) => (
                <SelectItem key={card.id} value={String(card.id)}>
                  {card.name}
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Select value={filters.sortBy} onValueChange={(value) => update("sortBy", value as InstallmentSortBy)}>
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
            <Select value={filters.sortOrder} onValueChange={(value) => update("sortOrder", value as InstallmentSortOrder)}>
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

        <label className="space-y-1 text-sm text-muted-foreground">
          <span>Quantidade de parcelas</span>
          <div className={shouldShowInstallmentCountValueSelect ? "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]" : "grid grid-cols-1"}>
            <Select
              value={filters.installmentCountMode}
              onValueChange={(value) => {
                const nextMode = value as InstallmentCountMode;
                onChange({
                  ...filters,
                  installmentCountMode: nextMode,
                  installmentCountValue: nextMode === "all" ? null : filters.installmentCountValue,
                });
              }}
            >
              <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="installment_count">Numero total</SelectItem>
                <SelectItem value="remaining_installments">Parcelas restantes</SelectItem>
              </SelectContent>
            </Select>
            {shouldShowInstallmentCountValueSelect ? (
              <Select
                value={filters.installmentCountValue !== null ? String(filters.installmentCountValue) : "all"}
                onValueChange={(value) => update("installmentCountValue", value === "all" ? null : Number(value))}
              >
                <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {installmentCountOptions.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </label>

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
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{appliedRangeLabel}</div>

        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
          <Button
            variant="ghost"
            className="w-full rounded-xl px-0 text-destructive hover:bg-transparent hover:text-destructive/80 sm:w-auto"
            onClick={onResetFilters}
          >
            <RotateCcw size={14} />
            Limpar filtros
          </Button>
        </div>
      </div>
    </div>
  );
}
