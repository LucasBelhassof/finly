import {
  Bell,
  Building2,
  ChevronDown,
  Layers3,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MessageSquare,
  Settings,
  Shield,
  UserCircle2,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";

import { NavLink } from "@/components/NavLink";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { toast } from "@/components/ui/sonner";
import { appRoutes } from "@/lib/routes";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";
import { useLogout } from "@/modules/auth/hooks/use-logout";
import { useProductTour } from "@/modules/product-tour/use-product-tour";

const navItems = [{ icon: LayoutDashboard, label: "Dashboard", to: appRoutes.dashboard, end: true }];

const secondaryNavItems = [
  { icon: MessageSquare, label: "Chat IA", to: appRoutes.chat },
  { icon: Lightbulb, label: "Insights", to: appRoutes.insights },
  { icon: Building2, label: "Contas", to: appRoutes.accounts },
];

const expenseManagementItems = [
  { label: "Transacoes", to: appRoutes.transactions },
  { label: "Receitas recorrentes", to: appRoutes.expenseManagementRecurringIncome },
  { label: "Habitacao", to: appRoutes.expenseManagementHousing },
  { label: "Parcelamentos", to: appRoutes.expenseManagementInstallments },
  { label: "Metricas", to: appRoutes.expenseManagementMetrics },
];

const adminItems = [
  { label: "Visao geral", to: appRoutes.adminOverview },
  { label: "Usuarios", to: appRoutes.adminUsers },
  { label: "Financeiro", to: appRoutes.adminFinancialMetrics },
  { label: "Assinaturas", to: appRoutes.adminSubscriptions },
  { label: "Atividade", to: appRoutes.adminActivity },
  { label: "Notificacoes", to: appRoutes.adminNotifications },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const { restartTour } = useProductTour();
  const { isMobile, openMobile, setOpenMobile, state } = useSidebar();
  const { user } = useAuthSession();
  const previousPathnameRef = useRef(location.pathname);
  const userName = user?.name ?? "Usuario";
  const userEmail = user?.email ?? "usuario@email.com";
  const isAdmin = user?.role === "admin";
  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const isCollapsed = state === "collapsed";
  const isExpenseManagementActive = Boolean(
    location.pathname === appRoutes.transactions ||
      matchPath({ path: `${appRoutes.expenseManagement}/*`, end: false }, location.pathname),
  );
  const isAdminActive = Boolean(
    location.pathname === appRoutes.admin || matchPath({ path: `${appRoutes.admin}/*`, end: false }, location.pathname),
  );

  useEffect(() => {
    if (isMobile && openMobile && previousPathnameRef.current !== location.pathname) {
      setOpenMobile(false);
    }
    previousPathnameRef.current = location.pathname;
  }, [isMobile, location.pathname, openMobile, setOpenMobile]);

  return (
    <SidebarRoot collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-3 overflow-hidden rounded-lg px-2 py-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">F</span>
          </div>
          <span className="truncate text-lg font-semibold text-foreground group-data-[collapsible=icon]:hidden">Finly</span>
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
                  data-tour-id={item.to === appRoutes.dashboard ? "nav-dashboard" : undefined}
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

          <Collapsible asChild defaultOpen={isExpenseManagementActive}>
            <SidebarMenuItem>
              {isAdmin ? (
                <Collapsible asChild defaultOpen={isAdminActive}>
                  <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    isActive={isAdminActive}
                        tooltip="Administracao"
                        className="h-11 rounded-lg px-3 text-muted-foreground hover:bg-secondary hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                      >
                        <Shield size={18} className="shrink-0" />
                        <span className="truncate group-data-[collapsible=icon]:hidden">Admin</span>
                        <ChevronDown
                          size={16}
                          className="ml-auto shrink-0 transition-transform group-data-[collapsible=icon]:hidden group-data-[state=open]/menu-item:rotate-180"
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {adminItems.map((item) => {
                          const isActive = location.pathname === item.to;

                          return (
                            <SidebarMenuSubItem key={item.label}>
                              <SidebarMenuSubButton asChild isActive={isActive}>
                                <NavLink to={item.to}>
                                  <span>{item.label}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ) : null}

              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  isActive={isExpenseManagementActive}
                  tooltip="Gestao de Gastos"
                  data-tour-id="nav-expense-management"
                  className="h-11 rounded-lg px-3 text-muted-foreground hover:bg-secondary hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                >
                  <Layers3 size={18} className="shrink-0" />
                  <span className="truncate group-data-[collapsible=icon]:hidden">Gestao de Gastos</span>
                  <ChevronDown
                    size={16}
                    className="ml-auto shrink-0 transition-transform group-data-[collapsible=icon]:hidden group-data-[state=open]/menu-item:rotate-180"
                  />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {expenseManagementItems.map((item) => {
                    const isActive = location.pathname === item.to;

                    return (
                      <SidebarMenuSubItem key={item.label}>
                        <SidebarMenuSubButton asChild isActive={isActive}>
                          <NavLink to={item.to}>
                            <span>{item.label}</span>
                          </NavLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>

          {secondaryNavItems.map((item) => {
            const isActive = Boolean(
              matchPath({ path: `${item.to}/*`, end: false }, location.pathname) || location.pathname === item.to,
            );

            return (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  data-tour-id={
                    item.to === appRoutes.insights
                      ? "nav-insights"
                      : item.to === appRoutes.accounts
                        ? "nav-accounts"
                        : undefined
                  }
                  className="h-11 rounded-lg px-3 text-muted-foreground hover:bg-secondary hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                >
                  <NavLink to={item.to}>
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
              <DropdownMenuItem className="gap-2" onClick={() => navigate(appRoutes.notifications)}>
                <Bell size={16} />
                Notificacoes
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => navigate(appRoutes.settings)}>
                <Settings size={16} />
                Configuracoes
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2"
                onClick={() => {
                  void restartTour();
                }}
              >
                <Lightbulb size={16} />
                Fazer tour novamente
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/60" />
              <DropdownMenuItem
                className="gap-2 text-destructive hover:bg-destructive hover:text-black focus:bg-destructive focus:text-black"
                disabled={logoutMutation.isPending}
                onClick={async () => {
                  try {
                    await logoutMutation.mutateAsync();
                  } catch (error) {
                    toast.error("Nao foi possivel encerrar a sessao.", {
                      description: error instanceof Error ? error.message : "Tente novamente em instantes.",
                    });
                  }
                }}
              >
                <LogOut size={16} />
                {logoutMutation.isPending ? "Saindo..." : "Sair"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <SidebarTrigger
            className="hidden h-11 w-11 shrink-0 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground md:inline-flex"
            aria-label="Alternar sidebar"
            title="Alternar sidebar"
          />
        </div>
      </SidebarFooter>
    </SidebarRoot>
  );
}
