import { Navigate, Outlet, useLocation } from "react-router-dom";

import { AppBootLoader } from "@/components/AppBootLoader";
import { useBanks } from "@/hooks/use-banks";
import { appRoutes } from "@/lib/routes";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";

export function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isBootstrapping, user } = useAuthContext();
  const requiresOnboarding = user?.hasCompletedOnboarding === false;
  const isOnboardingRoute = location.pathname === appRoutes.onboarding;
  const { data: banks = [], isLoading: isLoadingBanks } = useBanks(isAuthenticated && requiresOnboarding && !isOnboardingRoute);

  if (isBootstrapping) {
    return <AppBootLoader />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={appRoutes.login}
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  if (requiresOnboarding && !isOnboardingRoute && isLoadingBanks) {
    return <AppBootLoader />;
  }

  if (requiresOnboarding && !isOnboardingRoute && banks.length === 0) {
    return <Navigate to={appRoutes.onboarding} replace />;
  }

  return <Outlet />;
}
