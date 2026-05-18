import type { ReactNode } from "react";

import { Crown, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { appRoutes } from "@/lib/routes";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";

interface AppShellProps {
  title: string;
  description: string;
  children: ReactNode;
  headerContent?: ReactNode;
  showGreeting?: boolean;
}

export default function AppShell({ title, description, children, headerContent, showGreeting = false }: AppShellProps) {
  const { user } = useAuthSession();
  const navigate = useNavigate();
  const shouldShowPremiumBar = Boolean(user) && !user?.isPremium;

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen w-full min-w-0 overflow-hidden">
        <Sidebar />

        <main className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">
          <header
            className="sm:sticky sm:top-0 z-10 border-b border-border/50 bg-background/80 px-4 py-4 backdrop-blur-lg sm:px-6"
            data-tour-id="app-header"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary md:hidden">
                    Navegacao
                  </p>
                  <h1 className="text-xl font-bold text-foreground">
                    {showGreeting ? `${title}, ${user?.name ?? "UsuÃ¡rio"} ` : title}
                    {showGreeting ? "\u{1F44B}" : null}
                  </h1>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>

                <div data-tour-id="header-notifications">
                  <NotificationBell />
                </div>
              </div>

              {headerContent ? <div>{headerContent}</div> : null}
            </div>
          </header>

          {shouldShowPremiumBar ? (
            <div className="sm:sticky sm:top-[97px] z-[9] border-b border-primary/15 bg-primary/10 px-4 py-3 backdrop-blur-lg sm:px-6">
              <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-background/85 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Crown size={16} className="shrink-0 text-primary" />
                    <span>Torne-se Premium</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Desbloqueie conversas com Kip, insights e planejamentos gerados com base em suas conversas!
                  </p>
                </div>
                <Button type="button" className="shrink-0" onClick={() => navigate(appRoutes.pricing)}>
                  <Sparkles size={16} />
                  Conhecer Premium
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-6 p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
