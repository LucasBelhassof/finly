import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminOverview } from "@/hooks/use-admin";

const numberFormatter = new Intl.NumberFormat("pt-BR");
const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminOverviewPage() {
  const { data, isLoading } = useAdminOverview();

  const cards = [
    { label: "Usuários", value: numberFormatter.format(data?.totals.totalUsers ?? 0) },
    { label: "Ativos", value: numberFormatter.format(data?.totals.activeUsers ?? 0) },
    { label: "Premium", value: numberFormatter.format(data?.totals.premiumUsers ?? 0) },
    { label: "Online agora", value: numberFormatter.format(data?.totals.usersOnlineNow ?? 0) },
    { label: "Sessoes ativas", value: numberFormatter.format(data?.totals.activeSessions ?? 0) },
    { label: "Transações", value: numberFormatter.format(data?.totals.totalTransactions ?? 0) },
  ];

  return (
    <AdminLayout title="Admin" description="Visao global da plataforma e sinais operacionais principais.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-foreground">{isLoading ? "..." : card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saldo agregado da plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-semibold">{currencyFormatter.format(data?.totals.aggregateBalance ?? 0)}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Período analisado: {data?.period.startDate ?? "--"} até {data?.period.endDate ?? "--"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cadastros por dia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.signups ?? []).slice(-10).map((item) => (
            <div
              key={item.date}
              className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3"
            >
              <span className="text-sm text-muted-foreground">{item.date}</span>
              <span className="text-sm font-semibold">{numberFormatter.format(item.total)}</span>
            </div>
          ))}
          {!isLoading && (data?.signups?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cadastro encontrado no período.</p>
          ) : null}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
