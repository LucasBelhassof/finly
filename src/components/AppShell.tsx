import { Bell } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

import Sidebar from "@/components/Sidebar";
import { toast } from "@/components/ui/sonner";
import { useDashboard } from "@/hooks/use-dashboard";

interface AppShellProps {
  title: string;
  description: string;
  children: ReactNode;
  showGreeting?: boolean;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function AppShell({ title, description, children, showGreeting = false }: AppShellProps) {
  const { data, isError, error } = useDashboard();

  useEffect(() => {
    if (!isError) {
      return;
    }

    toast.error("Nao foi possivel carregar os dados do usuario.", {
      description: getErrorMessage(error, "Tente novamente em instantes."),
    });
  }, [error, isError]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 px-6 py-4 backdrop-blur-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {showGreeting ? `${title}, ${data?.user.name ?? "Joao"} ` : title}
                {showGreeting ? "\u{1F44B}" : null}
              </h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-secondary transition-colors hover:bg-secondary/80"
            >
              <Bell size={16} className="text-muted-foreground" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-expense" />
            </button>
          </div>
        </header>

        <div className="space-y-6 p-6">{children}</div>
      </main>
    </div>
  );
}
