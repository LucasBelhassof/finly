import type { ReactNode } from "react";

import AppShell from "@/components/AppShell";
import { NavLink } from "@/components/NavLink";
import { appRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const adminTabs = [
  { label: "Visao geral", to: appRoutes.adminOverview },
  { label: "Usuários", to: appRoutes.adminUsers },
  { label: "Financeiro", to: appRoutes.adminFinancialMetrics },
  { label: "IA", to: appRoutes.adminAiUsage },
  { label: "Assinaturas", to: appRoutes.adminSubscriptions },
  { label: "Atividade", to: appRoutes.adminActivity },
  { label: "Notificações", to: appRoutes.adminNotifications },
];

export default function AdminLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <AppShell title={title} description={description}>
      <div className="flex flex-wrap gap-2">
        {adminTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={cn(
              "rounded-full border border-border/70 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            )}
            activeClassName="border-primary/40 bg-primary/10 text-primary"
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {children}
    </AppShell>
  );
}
