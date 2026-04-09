import { Building2, CreditCard, LayoutDashboard, Lightbulb, LogOut, MessageSquare, UserCircle2 } from "lucide-react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";

import { NavLink } from "@/components/NavLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { toast } from "@/components/ui/sonner";
import { useDashboard } from "@/hooks/use-dashboard";
import { appRoutes } from "@/lib/routes";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", to: appRoutes.dashboard, end: true },
  { icon: CreditCard, label: "Transacoes", to: appRoutes.transactions },
  { icon: MessageSquare, label: "Chat IA", to: appRoutes.chat },
  { icon: Lightbulb, label: "Insights", to: appRoutes.insights },
  { icon: Building2, label: "Contas", to: appRoutes.accounts },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { data } = useDashboard();
  const userName = data?.user.name ?? "Joao";
  const userEmail = "joao@email.com";
  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const isCollapsed = state === "collapsed";

  return (
    <SidebarRoot collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-3 overflow-hidden rounded-lg px-2 py-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">F</span>
          </div>
          <span className="truncate text-lg font-semibold text-foreground group-data-[collapsible=icon]:hidden">FinAI</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive = item.end
              ? location.pathname === item.to
              : Boolean(matchPath({ path: `${item.to}/*`, end: false }, location.pathname) || location.pathname === item.to);

            return (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className="h-11 rounded-lg px-3 text-muted-foreground hover:bg-secondary hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                >
                  <NavLink to={item.to} end={item.end}>
                    <item.icon size={18} className="shrink-0" />
                    <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarSeparator className="mx-4 group-data-[collapsible=icon]:mx-2" />

      <SidebarFooter className="p-4 pt-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="flex w-full items-center gap-2 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:flex-col">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-lg px-2 py-1.5 text-left text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                aria-label="Abrir menu de perfil"
                title={isCollapsed ? "Perfil" : undefined}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <span className="text-xs font-medium text-secondary-foreground">{initials || "JD"}</span>
                </div>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-medium text-foreground">{userName}</p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={isCollapsed ? "right" : "top"}
              align={isCollapsed ? "start" : "end"}
              className="w-56 border-border/60 bg-card text-foreground"
            >
              <DropdownMenuLabel className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                    <span className="text-xs font-medium text-secondary-foreground">{initials || "JD"}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{userName}</p>
                    <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/60" />
              <DropdownMenuItem className="gap-2" onClick={() => navigate(appRoutes.profile)}>
                <UserCircle2 size={16} />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => navigate(appRoutes.settings)}>
                <Building2 size={16} />
                Configuracoes
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/60" />
              <DropdownMenuItem
                className="gap-2 text-destructive hover:bg-destructive hover:text-black focus:bg-destructive focus:text-black"
                onClick={() =>
                  toast.info("Logout ainda nao esta disponivel.", {
                    description: "A acao sera conectada quando o fluxo de autenticacao for implementado.",
                  })
                }
              >
                <LogOut size={16} />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <SidebarTrigger
            className="h-11 w-11 shrink-0 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Alternar sidebar"
            title="Alternar sidebar"
          />
        </div>
      </SidebarFooter>
    </SidebarRoot>
  );
}
