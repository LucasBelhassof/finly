import { Navigate, Outlet } from "react-router-dom";

import { appRoutes } from "@/lib/routes";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";

export function PublicOnlyRoute() {
  const { isAuthenticated, isBootstrapping } = useAuthContext();

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.16),_transparent_48%),linear-gradient(180deg,_hsl(var(--background)),_hsl(210_22%_96%))] px-6">
        <div className="rounded-2xl border border-border/60 bg-card/90 px-6 py-5 text-sm text-muted-foreground shadow-xl backdrop-blur">
          Validando sessao...
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={appRoutes.loading} replace />;
  }

  return <Outlet />;
}
