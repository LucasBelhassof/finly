import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, ChevronDown, CreditCard, Search, Settings2 } from "lucide-react";

import AppShell from "@/components/AppShell";
import TransactionsDateFilter from "@/components/transactions/TransactionsDateFilter";
import TransactionsMonthYearFilter from "@/components/transactions/TransactionsMonthYearFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { useInvoices, useMarkInvoicePaid, useUnmarkInvoicePaid, useUpdateInvoiceSettings } from "@/hooks/use-invoices";
import { useUrlPeriodFilter } from "@/hooks/use-url-period-filter";
import { getCurrentMonthSelection, resolveMonthYearRange } from "@/lib/transactions-date-filter";
import { cn } from "@/lib/utils";
import type { InvoiceItem, InvoiceSettingsInput, InvoiceStatus, InvoiceTransactionItem } from "@/types/api";

const FILTER_QUERY_PARAM_KEYS = {
  cardId: "cardId",
  status: "status",
  categoryId: "categoryId",
  search: "search",
} as const;

const statusOptions: Array<{ value: InvoiceStatus | "all"; label: string }> = [
  { value: "all", label: "Todos os status" },
  { value: "open", label: "Aberta" },
  { value: "closed", label: "Fechada" },
  { value: "due_soon", label: "Vence em breve" },
  { value: "overdue", label: "Atrasada" },
];

function updateUrlFilterParams(
  searchParams: URLSearchParams,
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  updates: Record<string, string | null>,
) {
  const nextSearchParams = new URLSearchParams(searchParams);

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === "") {
      nextSearchParams.delete(key);
    } else {
      nextSearchParams.set(key, value);
    }
  });

  setSearchParams(nextSearchParams, { replace: true });
}

function formatDate(value: string) {
  if (!value) {
    return "--";
  }

  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString("pt-BR");
}

function getStatusLabel(status: InvoiceStatus) {
  return statusOptions.find((item) => item.value === status)?.label ?? "Aberta";
}

function getStatusBadgeClassName(status: InvoiceStatus) {
  if (status === "overdue") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  if (status === "due_soon") {
    return "border-warning/30 bg-warning/10 text-warning";
  }

  if (status === "closed") {
    return "border-info/30 bg-info/10 text-info";
  }

  return "border-primary/30 bg-primary/10 text-primary";
}

function getInvoiceCardClassName(status: InvoiceStatus, isPaid?: boolean) {
  if (isPaid) {
    return "border-success/30 bg-success/5";
  }

  if (status === "overdue") {
    return "border-destructive/30 bg-destructive/5";
  }

  if (status === "due_soon") {
    return "border-warning/30 bg-warning/5";
  }

  if (status === "closed") {
    return "border-info/25 bg-info/5";
  }

  return "border-border/50 bg-card";
}

const INVOICE_CATEGORY_COLORS = [
  "bg-primary/70",
  "bg-info/70",
  "bg-warning/70",
  "bg-success/70",
  "bg-destructive/70",
  "bg-purple-500/70",
  "bg-pink-500/70",
  "bg-orange-400/70",
];

function InvoiceCategoryBreakdown({ transactions }: { transactions: InvoiceTransactionItem[] }) {
  const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const grouped = transactions.reduce(
    (acc, t) => {
      const key = String(t.category.id);
      if (!acc[key]) {
        acc[key] = { label: t.category.label, total: 0, count: 0 };
      }
      acc[key].total += Math.abs(t.amount);
      acc[key].count += 1;
      return acc;
    },
    {} as Record<string, { label: string; total: number; count: number }>,
  );

  const sorted = Object.values(grouped).sort((a, b) => b.total - a.total);

  return (
    <div className="mt-3 rounded-lg border border-border/50 bg-background/40 px-3 py-3">
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Análise por categoria</p>
      <div className="space-y-2">
        {sorted.map((cat, index) => {
          const pct = total > 0 ? (cat.total / total) * 100 : 0;
          const barColor = INVOICE_CATEGORY_COLORS[index % INVOICE_CATEGORY_COLORS.length];

          return (
            <div key={cat.label} className="flex items-center gap-3">
              <span className="w-[120px] shrink-0 truncate text-xs text-foreground sm:w-[150px]">{cat.label}</span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
                <div className={cn("absolute inset-y-0 left-0 rounded-full", barColor)} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right text-[11px] text-muted-foreground">{pct.toFixed(0)}%</span>
              <span className="w-[84px] shrink-0 text-right text-xs font-medium tabular-nums text-foreground">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cat.total)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsForm({ invoice, onSave, isSaving }: { invoice: InvoiceItem; onSave: (input: InvoiceSettingsInput) => void; isSaving: boolean }) {
  const [statementCloseDay, setStatementCloseDay] = useState(String(invoice.card.statementCloseDay ?? ""));
  const [statementDueDay, setStatementDueDay] = useState(String(invoice.card.statementDueDay ?? ""));
  const [notifyInvoiceClosed, setNotifyInvoiceClosed] = useState(invoice.card.notifyInvoiceClosed);
  const [notifyInvoiceDueSoon, setNotifyInvoiceDueSoon] = useState(invoice.card.notifyInvoiceDueSoon);
  const [invoiceDueReminderDays, setInvoiceDueReminderDays] = useState(String(invoice.card.invoiceDueReminderDays ?? 3));

  const handleSave = () => {
    const closeDay = Number(statementCloseDay);
    const dueDay = Number(statementDueDay);
    const reminderDays = Number(invoiceDueReminderDays);

    if (!Number.isInteger(closeDay) || closeDay < 1 || closeDay > 31 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      toast.error("Informe dias de fechamento e vencimento entre 1 e 31.");
      return;
    }

    if (!Number.isInteger(reminderDays) || reminderDays < 1 || reminderDays > 15) {
      toast.error("Informe um lembrete entre 1 e 15 dias.");
      return;
    }

    onSave({
      cardId: invoice.card.id,
      statementCloseDay: closeDay,
      statementDueDay: dueDay,
      notifyInvoiceClosed,
      notifyInvoiceDueSoon,
      invoiceDueReminderDays: reminderDays,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          value={statementCloseDay}
          onChange={(event) => setStatementCloseDay(event.target.value)}
          placeholder="Dia de fechamento"
          inputMode="numeric"
          className="h-11 rounded-xl border-border/60 bg-secondary/35"
        />
        <Input
          value={statementDueDay}
          onChange={(event) => setStatementDueDay(event.target.value)}
          placeholder="Dia de vencimento"
          inputMode="numeric"
          className="h-11 rounded-xl border-border/60 bg-secondary/35"
        />
      </div>

      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-4 text-sm text-foreground">
            <span>Notificar fatura fechada</span>
            <Switch checked={notifyInvoiceClosed} onCheckedChange={setNotifyInvoiceClosed} />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm text-foreground">
            <span>Notificar vencimento próximo</span>
            <Switch checked={notifyInvoiceDueSoon} onCheckedChange={setNotifyInvoiceDueSoon} />
          </label>
          <Input
            value={invoiceDueReminderDays}
            onChange={(event) => setInvoiceDueReminderDays(event.target.value)}
            placeholder="Dias antes do vencimento"
            inputMode="numeric"
            className="h-11 rounded-xl border-border/60 bg-background/60"
          />
        </div>
      </div>

      <DialogFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Salvando..." : "Salvar ajustes"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function CreditCardInvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSelection = useMemo(() => getCurrentMonthSelection(), []);
  const defaultDateRange = useMemo(
    () => resolveMonthYearRange(currentSelection.monthIndex, currentSelection.year),
    [currentSelection.monthIndex, currentSelection.year],
  );
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
    datePreset: "month",
    dateRange: defaultDateRange,
  });

  const selectedCardId = searchParams.get(FILTER_QUERY_PARAM_KEYS.cardId)?.trim() || "all";
  const selectedCategoryId = searchParams.get(FILTER_QUERY_PARAM_KEYS.categoryId)?.trim() || "all";
  const statusParam = searchParams.get(FILTER_QUERY_PARAM_KEYS.status);
  const selectedStatus = statusOptions.some((item) => item.value === statusParam) ? (statusParam as InvoiceStatus | "all") : "all";
  const search = searchParams.get(FILTER_QUERY_PARAM_KEYS.search) ?? "";
  const filters = useMemo(
    () => ({
      cardId: selectedCardId,
      referenceStart: dateRange.startDate,
      referenceEnd: dateRange.endDate,
      status: selectedStatus,
      categoryId: selectedCategoryId,
      search,
    }),
    [dateRange.endDate, dateRange.startDate, search, selectedCardId, selectedCategoryId, selectedStatus],
  );
  const { data, isLoading, isError, refetch } = useInvoices(filters);
  const updateSettings = useUpdateInvoiceSettings();
  const markPaid = useMarkInvoicePaid();
  const unmarkPaid = useUnmarkInvoicePaid();
  const [openInvoiceIds, setOpenInvoiceIds] = useState<Set<string>>(new Set());
  const [settingsInvoice, setSettingsInvoice] = useState<InvoiceItem | null>(null);
  const invoices = data?.invoices ?? [];

  const handleTogglePaid = async (invoice: InvoiceItem) => {
    try {
      if (invoice.isPaid) {
        await unmarkPaid.mutateAsync({ cardId: invoice.card.id, periodEnd: invoice.periodEnd });
        toast.success("Fatura desmarcada como paga.");
      } else {
        await markPaid.mutateAsync({ cardId: invoice.card.id, periodEnd: invoice.periodEnd });
        toast.success("Fatura marcada como paga.");
      }
    } catch (error) {
      toast.error("Não foi possível atualizar o pagamento.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleResetFilters = () => {
    const nextSearchParams = new URLSearchParams(searchParams);

    nextSearchParams.set("month", String(currentSelection.monthIndex));
    nextSearchParams.set("year", String(currentSelection.year));
    nextSearchParams.set("preset", "month");
    nextSearchParams.set("startDate", defaultDateRange.startDate);
    nextSearchParams.set("endDate", defaultDateRange.endDate);
    Object.values(FILTER_QUERY_PARAM_KEYS).forEach((key) => nextSearchParams.delete(key));
    setSearchParams(nextSearchParams, { replace: true });
  };



  const headerContent = (
    <section data-tour-id="invoices-filters" className="glass-card rounded-[28px] border border-border/40 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
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

        <Select
          value={selectedCardId}
          onValueChange={(value) =>
            updateUrlFilterParams(searchParams, setSearchParams, {
              [FILTER_QUERY_PARAM_KEYS.cardId]: value === "all" ? null : value,
            })
          }
        >
          <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:flex-1">
            <SelectValue placeholder="Todos os cartões" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cartões</SelectItem>
            {(data?.filterOptions.cards ?? []).map((card) => (
              <SelectItem key={card.id} value={String(card.id)}>
                {card.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedStatus}
          onValueChange={(value) =>
            updateUrlFilterParams(searchParams, setSearchParams, {
              [FILTER_QUERY_PARAM_KEYS.status]: value === "all" ? null : value,
            })
          }
        >
          <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:flex-1">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedCategoryId}
          onValueChange={(value) =>
            updateUrlFilterParams(searchParams, setSearchParams, {
              [FILTER_QUERY_PARAM_KEYS.categoryId]: value === "all" ? null : value,
            })
          }
        >
          <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-border/60 bg-secondary/35 xl:flex-1">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {(data?.filterOptions.categories ?? []).map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full xl:max-w-sm xl:flex-1">
          <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) =>
              updateUrlFilterParams(searchParams, setSearchParams, {
                [FILTER_QUERY_PARAM_KEYS.search]: event.target.value.trim() || null,
              })
            }
            placeholder="Buscar despesa, cartão ou categoria..."
            className="h-11 rounded-xl border-border/60 bg-secondary/35 pl-11"
          />
        </div>

        <Button variant="ghost" className="h-11 text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={handleResetFilters}>
          Limpar filtros
        </Button>
      </div>
    </section>
  );

  return (
    <AppShell
      title="Faturas"
      description="Acompanhe fechamento, vencimento e despesas dos cartões de crédito."
      headerContent={headerContent}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="glass-card p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-28" />
            </div>
          ))
        ) : (
          <>
            <div className="glass-card p-4">
              <p className="text-sm text-muted-foreground">Total filtrado</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{data?.summary.formattedTotalAmount ?? "R$ 0,00"}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-sm text-muted-foreground">Vencendo</p>
              <p className="mt-1 text-2xl font-bold text-warning">{data?.summary.dueSoonCount ?? 0}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-sm text-muted-foreground">Atrasadas</p>
              <p className="mt-1 text-2xl font-bold text-destructive">{data?.summary.overdueCount ?? 0}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-sm text-muted-foreground">Cartões ativos</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{data?.summary.activeCardsCount ?? 0}</p>
            </div>
          </>
        )}
      </div>

      {isError ? (
        <div className="glass-card rounded-2xl border border-destructive/20 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 text-destructive" size={20} />
              <div>
                <h2 className="font-semibold text-foreground">Não foi possível carregar as faturas</h2>
                <p className="text-sm text-muted-foreground">Tente novamente em instantes.</p>
              </div>
            </div>
            <Button onClick={() => void refetch()}>Tentar novamente</Button>
          </div>
        </div>
      ) : null}

      {!isLoading && !isError && invoices.length === 0 ? (
        <div className="glass-card rounded-2xl border border-border/40 p-6 text-sm text-muted-foreground">
          Nenhuma fatura encontrada para os filtros selecionados.
        </div>
      ) : null}

      <div className="space-y-4">
        {isLoading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="glass-card rounded-2xl border border-border/40 p-5">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-4 h-16 w-full" />
              </div>
            ))
          : invoices.map((invoice) => {
              const isOpen = openInvoiceIds.has(invoice.id);

              return (
                <Collapsible
                  key={invoice.id}
                  open={isOpen}
                  onOpenChange={(open) =>
                    setOpenInvoiceIds((current) => {
                      const next = new Set(current);
                      if (open) {
                        next.add(invoice.id);
                      } else {
                        next.delete(invoice.id);
                      }
                      return next;
                    })
                  }
                >
                  <div className={cn("rounded-lg border transition-colors", getInvoiceCardClassName(invoice.status, invoice.isPaid))}>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground", invoice.card.color)}>
                        <CreditCard size={16} />
                      </div>

                      <CollapsibleTrigger asChild>
                        <button type="button" className="group min-w-0 flex-1 cursor-pointer text-left">
                          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                            <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">{invoice.card.name}</p>
                            {invoice.isPaid ? (
                              <Badge variant="outline" className="w-fit text-[11px] border-success/30 bg-success/10 text-success">
                                <CheckCircle2 size={10} className="mr-1" />
                                Paga
                              </Badge>
                            ) : (
                              <Badge variant="outline" className={cn("w-fit text-[11px]", getStatusBadgeClassName(invoice.status))}>
                                {getStatusLabel(invoice.status)}
                              </Badge>
                            )}
                            <span className="hidden text-xs text-muted-foreground sm:inline">{invoice.referenceMonthLabel}</span>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            Fecha {formatDate(invoice.closingDate)} · Vence {formatDate(invoice.dueDate)}
                          </p>
                        </button>
                      </CollapsibleTrigger>

                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-foreground tabular-nums">{invoice.formattedTotalAmount}</p>
                        <p className="text-xs text-muted-foreground">{invoice.transactionCount} despesa(s)</p>
                      </div>

                      {(invoice.status === "closed" || invoice.status === "overdue") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 shrink-0 gap-1.5 rounded-lg px-2 text-xs",
                            invoice.isPaid
                              ? "text-success hover:bg-success/10 hover:text-success"
                              : "text-muted-foreground hover:bg-success/10 hover:text-success",
                          )}
                          disabled={markPaid.isPending || unmarkPaid.isPending}
                          onClick={() => void handleTogglePaid(invoice)}
                          aria-label={invoice.isPaid ? "Desmarcar fatura como paga" : "Marcar fatura como paga"}
                        >
                          <CheckCircle2 size={14} />
                          <span className="hidden sm:inline">{invoice.isPaid ? "Paga" : "Marcar paga"}</span>
                        </Button>
                      )}

                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label={isOpen ? `Recolher fatura ${invoice.card.name}` : `Expandir fatura ${invoice.card.name}`}
                        >
                          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
                        </button>
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent>
                      <div className="border-t border-border/50 px-3 pb-3 pt-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays size={11} />
                            {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-7 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            onClick={() => setSettingsInvoice(invoice)}
                          >
                            <Settings2 size={12} />
                            Configurar
                          </Button>
                        </div>

                        <div className="mt-3 overflow-hidden rounded-lg border border-border/50 bg-background/40">
                          <div className="divide-y divide-border/40">
                            {invoice.transactions.map((transaction) => (
                              <div key={transaction.id} className="flex items-center gap-3 px-3 py-2">
                                <span className="w-[80px] shrink-0 text-xs text-muted-foreground">
                                  {formatDate(transaction.occurredOn)}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-foreground">{transaction.description}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {transaction.isInstallment && transaction.installmentNumber && transaction.installmentCount
                                      ? `Parcela ${transaction.installmentNumber}/${transaction.installmentCount} · `
                                      : ""}
                                    {transaction.category.label}
                                  </p>
                                </div>
                                <span className="shrink-0 text-sm font-semibold text-destructive tabular-nums">
                                  {transaction.formattedAmount}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {invoice.transactions.length > 0 && (
                          <InvoiceCategoryBreakdown transactions={invoice.transactions} />
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
      </div>

      <Dialog open={Boolean(settingsInvoice)} onOpenChange={(open) => !open && setSettingsInvoice(null)}>
        <DialogContent className="max-w-[520px] border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Ajustar fatura</DialogTitle>
            <DialogDescription>{settingsInvoice ? settingsInvoice.card.name : "Cartão"}</DialogDescription>
          </DialogHeader>
          {settingsInvoice ? (
            <SettingsForm
              key={settingsInvoice.id}
              invoice={settingsInvoice}
              isSaving={updateSettings.isPending}
              onSave={async (input) => {
                try {
                  await updateSettings.mutateAsync(input);
                  setSettingsInvoice(null);
                  toast.success("Ajustes da fatura salvos.");
                } catch (error) {
                  toast.error("Não foi possível salvar os ajustes.", {
                    description: error instanceof Error ? error.message : "Tente novamente em instantes.",
                  });
                }
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

    </AppShell>
  );
}
