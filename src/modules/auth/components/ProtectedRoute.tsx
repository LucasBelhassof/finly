import { Navigate, Outlet, useLocation } from "react-router-dom";

import { AppBootLoader } from "@/components/AppBootLoader";
import { useBanks } from "@/hooks/use-banks";
import { useTransactions } from "@/hooks/use-transactions";
import { appRoutes } from "@/lib/routes";
import { useAuthContext } from "@/modules/auth/components/AuthProvider";
import { isInitialSetupIncomplete } from "@/modules/auth/lib/setup-completion";

export function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isBootstrapping, user } = useAuthContext();
  const shouldCheckInitialSetup =
    isAuthenticated && user?.role !== "admin" && location.pathname === appRoutes.dashboard;
  const { data: banks = [], isLoading: isBanksLoading } = useBanks(shouldCheckInitialSetup);
  const { data: transactions = [], isLoading: isTransactionsLoading } = useTransactions(
    undefined,
    shouldCheckInitialSetup,
  );

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

  if (shouldCheckInitialSetup) {
    if (isBanksLoading || isTransactionsLoading) {
      return <AppBootLoader />;
    }

    if (
      isInitialSetupIncomplete({
        accounts: banks,
        transactionCount: transactions.length,
      })
    ) {
      return <Navigate to={appRoutes.onboarding} replace />;
    }
  }

  return <Outlet />;
}
