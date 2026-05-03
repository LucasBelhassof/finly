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
  overview?: InstallmentsOverview;
  onChange: (nextFilters: InstallmentsOverviewFilters) => void;
}

export default function InstallmentsFilters({ filters, overview, onChange }: InstallmentsFiltersProps) {
  const amountRange = overview?.filterOptions.installmentAmountRange;
  const installmentCountOptions =
    filters.installmentCountMode === "remaining_installments"
      ? (overview?.filterOptions.remainingInstallmentValues ?? [])
      : (overview?.filterOptions.installmentCountValues ?? []);
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
      <label className="space-y-1 text-sm text-muted-foreground xl:col-span-2">
        <span>Cartões</span>
        <Select value={filters.cardId} onValueChange={(value) => update("cardId", value)}>
          <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
            <SelectValue placeholder="Todos os cartões" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cartões</SelectItem>
            {overview?.filterOptions.cards.map((card) => (
              <SelectItem key={card.id} value={String(card.id)}>
                {card.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="space-y-1 text-sm text-muted-foreground xl:col-span-2">
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

      <label className="space-y-1 text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
        <span>Ordenação</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
          <Select value={filters.sortBy} onValueChange={(value) => update("sortBy", value as InstallmentSortBy)}>
            <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/35">
              <SelectValue placeholder="Inteligente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="smart">Inteligente</SelectItem>
              <SelectItem value="installment_amount">Maior parcela</SelectItem>
              <SelectItem value="remaining_balance">Maior saldo</SelectItem>
              <SelectItem value="next_due_date">Próximo vencimento</SelectItem>
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

      <label className="space-y-1 text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
        <span>Quantidade de parcelas</span>
        <div
          className={
            shouldShowInstallmentCountValueSelect
              ? "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]"
              : "grid grid-cols-1"
          }
        >
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
              <SelectItem value="installment_count">Número total</SelectItem>
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

      <label className="space-y-1 text-sm text-muted-foreground xl:col-span-1">
        <span>Parcela mínima</span>
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

      <label className="space-y-1 text-sm text-muted-foreground xl:col-span-1">
        <span>Parcela máxima</span>
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
  );
}
