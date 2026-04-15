import { Navigate, Outlet } from "react-router-dom";

import { AppBootLoader } from "@/components/AppBootLoader";
import { appRoutes } from "@/lib/routes";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";

export function PublicOnlyRoute() {
  const { isAuthenticated, isBootstrapping, user } = useAuthContext();

  if (isBootstrapping) {
    return <AppBootLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to={user?.hasCompletedOnboarding === false ? appRoutes.onboarding : appRoutes.dashboard} replace />;
  }

  return <Outlet />;
}
