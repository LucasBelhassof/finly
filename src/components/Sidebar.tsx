import { Building2, CreditCard, LayoutDashboard, Lightbulb, LogOut, MessageSquare, Settings } from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { useDashboard } from "@/hooks/use-dashboard";
import { appRoutes } from "@/lib/routes";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", to: appRoutes.dashboard, end: true },
  { icon: CreditCard, label: "Transacoes", to: appRoutes.transactions },
  { icon: MessageSquare, label: "Chat IA", to: appRoutes.chat },
  { icon: Lightbulb, label: "Insights", to: appRoutes.insights },
  { icon: Building2, label: "Contas", to: appRoutes.accounts },
  { icon: Settings, label: "Configuracoes", to: appRoutes.settings },
];

export default function Sidebar() {
  const { data } = useDashboard();
  const userName = data?.user.name ?? "Joao";
  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4">
      <div className="mb-8 flex items-center gap-3 px-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-primary-foreground">F</span>
        </div>
        <span className="text-lg font-semibold text-foreground">FinAI</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
            activeClassName="bg-primary/10 text-primary"
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 border-t border-sidebar-border pt-4">
        <div className="mb-3 flex items-center gap-3 px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
            <span className="text-xs font-medium text-secondary-foreground">{initials || "JD"}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">joao@email.com</p>
          </div>
        </div>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
}
