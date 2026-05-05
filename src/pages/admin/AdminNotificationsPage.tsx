import { useMemo, useState } from "react";

import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdminNotificationTargets, useAdminNotifications, useCreateAdminNotification } from "@/hooks/use-admin";
import type { NotificationCategory } from "@/types/api";
import { toast } from "@/components/ui/sonner";

const categoryOptions: Array<{ value: NotificationCategory; label: string }> = [
  { value: "general", label: "Sistema" },
  { value: "custom", label: "Usuários selecionados" },
];

const audienceOptions = [
  { value: "all", label: "Todos os ativos" },
  { value: "premium", label: "Apenas premium" },
  { value: "non_premium", label: "Apenas não premium" },
] as const;

function getAudienceLabel(audience: "all" | "premium" | "non_premium" | "selected") {
  switch (audience) {
    case "premium":
      return "Premium";
    case "non_premium":
      return "Não premium";
    case "selected":
      return "Usuários selecionados";
    default:
      return "Todos os ativos";
  }
}

function buildNotificationDateValue(value: string) {
  return value ? `${value}T12:00:00.000Z` : null;
}

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<NotificationCategory>("general");
  const [triggerAt, setTriggerAt] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [audience, setAudience] = useState<(typeof audienceOptions)[number]["value"]>("all");

  const { data: targets } = useAdminNotificationTargets();
  const { data: notifications, isLoading } = useAdminNotifications();
  const createNotification = useCreateAdminNotification();

  const selectableUsers = useMemo(() => targets?.users ?? [], [targets?.users]);

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Informe um titulo e uma mensagem.");
      return;
    }

    if (category === "custom" && selectedUserIds.length === 0) {
      toast.error("Selecione pelo menos um usuário ativo.");
      return;
    }

    try {
      const result = await createNotification.mutateAsync({
        title: title.trim(),
        message: message.trim(),
        category,
        triggerAt: buildNotificationDateValue(triggerAt),
        target: {
          mode: category === "custom" ? "selected" : "all",
          audience,
          userIds: category === "custom" ? selectedUserIds : [],
        },
      });

      toast.success(`Notificação enviada para ${result.recipientsCount} usuário(s).`);
      setTitle("");
      setMessage("");
      setTriggerAt("");
      setSelectedUserIds([]);
      setAudience("all");
    } catch (error) {
      toast.error("Não foi possível enviar a notificação.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const toggleSelectedUser = (userId: string, checked: boolean) => {
    setSelectedUserIds((current) => {
      if (checked) {
        return current.includes(userId) ? current : [...current, userId];
      }

      return current.filter((value) => value !== userId);
    });
  };

  return (
    <AdminLayout
      title="Notificações"
      description="Crie notificações do sistema para todos os ativos, por tipo de usuário ou para os usuários que você selecionar."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Nova notificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notification-title">Título</Label>
              <Input
                id="notification-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex.: Manutencao agendada"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notification-message">Mensagem</Label>
              <Textarea
                id="notification-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Escreva a mensagem que os usuários vão receber."
                rows={5}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Destino</Label>
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
            </div>

            {category === "general" ? (
              <div className="space-y-2">
                <Label>Publico</Label>
                <Select
                  value={audience}
                  onValueChange={(value) => setAudience(value as (typeof audienceOptions)[number]["value"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {audienceOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {category === "custom" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Usuários ativos</Label>
                  <Badge variant="outline">{selectedUserIds.length} selecionado(s)</Badge>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border/60 p-3">
                  {selectableUsers.map((user) => {
                    const userId = String(user.id);
                    const checked = selectedUserIds.includes(userId);

                    return (
                      <label
                        key={userId}
                        htmlFor={`notification-user-${userId}`}
                        className="flex cursor-pointer items-start gap-3 rounded-md border border-border/40 p-3 transition-colors hover:bg-secondary/20"
                      >
                        <Checkbox
                          id={`notification-user-${userId}`}
                          checked={checked}
                          onCheckedChange={(value) => toggleSelectedUser(userId, value === true)}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email || "Sem email"}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {user.isPremium ? "Premium" : "Não premium"}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                  {selectableUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum usuário ativo disponível.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <Button onClick={() => void handleSubmit()} disabled={createNotification.isPending}>
              {createNotification.isPending ? "Enviando..." : "Enviar notificação"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(notifications?.notifications ?? []).map((item) => (
              <div key={String(item.id)} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{item.title}</p>
                  <Badge variant="secondary">Sistema</Badge>
                  <Badge variant="outline">{getAudienceLabel(item.audience)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString("pt-BR")} - Lidas: {item.readCount}/{item.recipientsCount}
                </p>
              </div>
            ))}

            {!isLoading && (notifications?.notifications.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma notificação enviada por enquanto.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
