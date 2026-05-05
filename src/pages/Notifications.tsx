import { Bell, CalendarClock, CheckCheck, FileText, Landmark, ReceiptText, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import AppShell from "@/components/AppShell";
import { ListPaginationBar } from "@/components/ListPaginationBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerInput, DateRangePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageSizeSelect } from "@/components/ui/page-size-select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateSelfNotification,
  useDeleteNotification,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useMarkNotificationAsUnread,
  useNotifications,
} from "@/hooks/use-notifications";
import { usePagination } from "@/hooks/use-pagination";
import { appRoutes } from "@/lib/routes";
import { toast } from "@/components/ui/sonner";
import type {
  NotificationCategory,
  NotificationItem,
  NotificationSourceFilter,
  NotificationStatusFilter,
} from "@/types/api";

const categoryOptions: Array<{ value: NotificationCategory; label: string }> = [
  { value: "invoice_due", label: "Vencimento de fatura" },
  { value: "financing_due", label: "Vencimento de financiamento" },
  { value: "installment_due", label: "Vencimento de parcelamento" },
  { value: "housing_due", label: "Vencimento de moradia" },
  { value: "custom", label: "Personalizado" },
];

const statusOptions: Array<{ value: NotificationStatusFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Não lidas" },
  { value: "read", label: "Lidas" },
];

const sourceOptions: Array<{ value: NotificationSourceFilter; label: string }> = [
  { value: "all", label: "Tudo" },
  { value: "system", label: "Sistema" },
  { value: "user", label: "Usuário" },
];

function getNotificationIcon(category: NotificationCategory) {
  switch (category) {
    case "invoice_due":
      return ReceiptText;
    case "financing_due":
      return Landmark;
    case "installment_due":
      return CalendarClock;
    case "housing_due":
      return FileText;
    default:
      return Bell;
  }
}

function getNotificationCategoryLabel(category: NotificationCategory) {
  return categoryOptions.find((item) => item.value === category)?.label ?? "Geral";
}

function getNotificationSourceLabel(notification: NotificationItem) {
  return notification.source === "user_self" ? "Criada por você" : "Do sistema";
}

function getNotificationCreatorLabel(notification: NotificationItem) {
  return notification.source === "user_self" ? "Voce" : "Sistema";
}

function formatNotificationDate(notification: NotificationItem) {
  return new Date(notification.triggerAt ?? notification.createdAt).toLocaleString("pt-BR");
}

function buildNotificationDateValue(value: string) {
  return value ? `${value}T12:00:00.000Z` : null;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { recipientId } = useParams();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<NotificationCategory>("invoice_due");
  const [triggerAt, setTriggerAt] = useState("");
  const [statusFilter, setStatusFilter] = useState<NotificationStatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<NotificationSourceFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filters = useMemo(
    () => ({
      limit: 100,
      status: statusFilter,
      source: sourceFilter,
      startDate: startDate || null,
      endDate: endDate || null,
    }),
    [endDate, sourceFilter, startDate, statusFilter],
  );

  const { data, isLoading } = useNotifications(filters);
  const createNotification = useCreateSelfNotification();
  const markRead = useMarkNotificationAsRead();
  const markUnread = useMarkNotificationAsUnread();
  const markAllRead = useMarkAllNotificationsAsRead();
  const deleteNotification = useDeleteNotification();

  const notifications = data?.notifications ?? [];
  const {
    page: notifPage,
    pageSize: notifPageSize,
    totalPages: notifTotalPages,
    setPage: setNotifPage,
    setPageSize: setNotifPageSize,
    paginate: paginateNotifications,
  } = usePagination(notifications.length);
  const paginatedNotifications = paginateNotifications(notifications);
  const selectedNotification = useMemo(
    () => notifications.find((item) => String(item.recipientId) === String(recipientId)) ?? notifications[0] ?? null,
    [notifications, recipientId],
  );

  useEffect(() => {
    if (!recipientId && notifications[0]) {
      navigate(`${appRoutes.notifications}/${notifications[0].recipientId}`, { replace: true });
      return;
    }

    if (recipientId && notifications.length === 0) {
      navigate(appRoutes.notifications, { replace: true });
      return;
    }

    if (
      recipientId &&
      !notifications.some((item) => String(item.recipientId) === String(recipientId)) &&
      notifications[0]
    ) {
      navigate(`${appRoutes.notifications}/${notifications[0].recipientId}`, { replace: true });
    }
  }, [navigate, notifications, recipientId]);

  const handleCreateNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Preencha titulo e mensagem.");
      return;
    }

    try {
      await createNotification.mutateAsync({
        title: title.trim(),
        message: message.trim(),
        category,
        triggerAt: buildNotificationDateValue(triggerAt),
      });
      toast.success("Notificação criada com sucesso.");
      setTitle("");
      setMessage("");
      setCategory("invoice_due");
      setTriggerAt("");
    } catch (error) {
      toast.error("Não foi possível criar a notificação.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleMarkSelectedAsRead = async () => {
    if (!selectedNotification || selectedNotification.isRead) {
      return;
    }

    try {
      await markRead.mutateAsync(selectedNotification.recipientId);
      toast.success("Notificação marcada como lida.");
    } catch (error) {
      toast.error("Não foi possível atualizar a notificação.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleMarkSelectedAsUnread = async () => {
    if (!selectedNotification || !selectedNotification.isRead) {
      return;
    }

    try {
      await markUnread.mutateAsync(selectedNotification.recipientId);
      toast.success("Notificação marcada como não lida.");
    } catch (error) {
      toast.error("Não foi possível atualizar a notificação.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleDeleteSelectedNotification = async () => {
    if (!selectedNotification) {
      return;
    }

    try {
      await deleteNotification.mutateAsync(selectedNotification.recipientId);
      toast.success("Notificação excluída.");
    } catch (error) {
      toast.error("Não foi possível excluir a notificação.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const result = await markAllRead.mutateAsync();
      toast.success(
        result.updatedCount > 0
          ? `${result.updatedCount} notificações marcadas como lidas.`
          : "Não havia notificações pendentes.",
      );
    } catch (error) {
      toast.error("Não foi possível marcar todas como lidas.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  return (
    <AppShell title="Notificações" description="Filtre seus alertas, veja detalhes e crie novos lembretes pessoais.">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card data-tour-id="notifications-filters">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Filtros</CardTitle>
                <Badge variant="secondary">{notifications.length} resultado(s)</Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as NotificationStatusFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select
                    value={sourceFilter}
                    onValueChange={(value) => setSourceFilter(value as NotificationSourceFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Período</Label>
                  <DateRangePickerInput
                    startValue={startDate || null}
                    endValue={endDate || null}
                    onChange={({ startValue, endValue }) => {
                      setStartDate(startValue ?? "");
                      setEndDate(endValue ?? "");
                    }}
                    placeholder="Selecionar período"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setSourceFilter("all");
                    setStartDate("");
                    setEndDate("");
                  }}
                >
                  Limpar filtros
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleMarkAllAsRead()}
                  disabled={markAllRead.isPending || (data?.unreadCount ?? 0) === 0}
                >
                  <CheckCheck size={14} />
                  Marcar todas como lidas
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Card data-tour-id="notifications-inbox" className="xl:h-fit">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Caixa de entrada</CardTitle>
                {notifications.length > 0 && <PageSizeSelect value={notifPageSize} onChange={setNotifPageSize} />}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {paginatedNotifications.map((item) => {
                const Icon = getNotificationIcon(item.category);
                const isSelected = String(item.recipientId) === String(selectedNotification?.recipientId);

                return (
                  <button
                    key={String(item.recipientId)}
                    type="button"
                    onClick={() => navigate(`${appRoutes.notifications}/${item.recipientId}`)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      isSelected ? "border-primary/40 bg-primary/10" : "border-border/60 hover:bg-secondary/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-secondary/40 p-2">
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                          {!item.isRead ? (
                            <Badge variant="destructive">Nova</Badge>
                          ) : (
                            <Badge variant="outline">Lida</Badge>
                          )}
                          <Badge variant="secondary">{item.source === "user_self" ? "Usuário" : "Sistema"}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground">{formatNotificationDate(item)}</p>
                      </div>
                    </div>
                  </button>
                );
              })}

              {!isLoading && notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma notificação encontrada para os filtros selecionados.
                </p>
              ) : null}
              <ListPaginationBar
                page={notifPage}
                totalPages={notifTotalPages}
                totalItems={notifications.length}
                pageSize={notifPageSize}
                onPageChange={setNotifPage}
                itemLabel="notificações"
              />
            </CardContent>
          </Card>
        </div>

        <Card data-tour-id="notifications-details">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Detalhes da notificação</CardTitle>
              {selectedNotification ? (
                <div className="flex flex-wrap gap-2">
                  {selectedNotification.isRead ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleMarkSelectedAsUnread()}
                      disabled={markUnread.isPending}
                    >
                      Marcar como não lida
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleMarkSelectedAsRead()}
                      disabled={markRead.isPending}
                    >
                      Marcar como lida
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleDeleteSelectedNotification()}
                    disabled={deleteNotification.isPending}
                  >
                    <Trash2 size={14} />
                    Excluir
                  </Button>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {selectedNotification ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{getNotificationCategoryLabel(selectedNotification.category)}</Badge>
                  <Badge variant="outline">{getNotificationSourceLabel(selectedNotification)}</Badge>
                  <Badge variant={selectedNotification.isRead ? "outline" : "destructive"}>
                    {selectedNotification.isRead ? "Lida" : "Não lida"}
                  </Badge>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">{selectedNotification.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selectedNotification.message}</p>
                  {selectedNotification.actionHref ? (
                    <Button className="mt-4" onClick={() => navigate(selectedNotification.actionHref!)}>
                      Abrir planejamento
                    </Button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-secondary/25 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Data da notificação</p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {formatNotificationDate(selectedNotification)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary/25 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Criada por</p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {getNotificationCreatorLabel(selectedNotification)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary/25 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {selectedNotification.isRead ? "Notificação lida" : "Aguardando leitura"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary/25 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Leitura em</p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {selectedNotification.readAt
                        ? new Date(selectedNotification.readAt).toLocaleString("pt-BR")
                        : "Ainda não lida"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione uma notificação para ver os detalhes.</p>
            )}
          </CardContent>
        </Card>

        <Card data-tour-id="notifications-form">
          <CardHeader>
            <CardTitle>Novo lembrete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notification-title">Título</Label>
              <Input
                id="notification-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: Vencimento da fatura"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notification-message">Mensagem</Label>
              <Textarea
                id="notification-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                placeholder="Ex.: Lembrar de pagar ate o dia 10."
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as NotificationCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data</Label>
              <DatePickerInput value={triggerAt} onChange={setTriggerAt} placeholder="Selecionar data" />
            </div>

            <Button onClick={() => void handleCreateNotification()} disabled={createNotification.isPending}>
              {createNotification.isPending ? "Salvando..." : "Adicionar notificação"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
