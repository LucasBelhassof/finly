import type { ReactNode } from "react";

import { NotificationBell } from "@/components/NotificationBell";
import Sidebar from "@/components/Sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuthSession } from "@/modules/auth/hooks/use-auth-session";

interface AppShellProps {
  title: string;
  description: string;
  children: ReactNode;
  showGreeting?: boolean;
}

export default function AppShell({ title, description, children, showGreeting = false }: AppShellProps) {
  const { user } = useAuthSession();

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen w-full min-w-0 overflow-hidden">
        <Sidebar />

        <main className="flex-1 min-w-0 overflow-y-auto scrollbar-thin">
          <header
            className="sticky top-0 z-10 border-b border-border/50 bg-background/80 px-4 py-4 backdrop-blur-lg sm:px-6"
            data-tour-id="app-header"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <SidebarTrigger
                  className="mt-0.5 inline-flex h-10 w-10 shrink-0 rounded-lg border border-border/60 text-foreground hover:bg-secondary md:hidden"
                  aria-label="Abrir menu de navegacao"
                  title="Abrir menu"
                  data-tour-id="sidebar-trigger"
                />

                <div className="min-w-0">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary md:hidden">Navegacao</p>
                  <h1 className="text-xl font-bold text-foreground">
                    {showGreeting ? `${title}, ${user?.name ?? "Usuario"} ` : title}
                    {showGreeting ? "\u{1F44B}" : null}
                  </h1>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>

              <div data-tour-id="header-notifications">
                <NotificationBell />
              </div>
            </div>
          </header>

          <div className="space-y-6 p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
