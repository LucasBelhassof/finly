import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FinlyMiniLoader } from "@/components/FinlyMiniLoader";
import { appRoutes } from "@/lib/routes";
import { AuthProvider } from "@/modules/auth/components/AuthProvider";
import { ProtectedRoute } from "@/modules/auth/components/ProtectedRoute";
import { PublicOnlyRoute } from "@/modules/auth/components/PublicOnlyRoute";
import ForgotPasswordPage from "@/modules/auth/pages/ForgotPasswordPage";
import LoginPage from "@/modules/auth/pages/LoginPage";
import ResetPasswordPage from "@/modules/auth/pages/ResetPasswordPage";
import SignupPage from "@/modules/auth/pages/SignupPage";
import LoadingPage from "./pages/Loading.tsx";

const AccountsPage = lazy(() => import("./pages/Accounts.tsx"));
const ChatPage = lazy(() => import("./pages/Chat.tsx"));
const ExpenseMetricsPage = lazy(() => import("./pages/ExpenseMetrics.tsx"));
const HousingPage = lazy(() => import("./pages/Housing.tsx"));
const InstallmentsPage = lazy(() => import("./pages/Installments.tsx"));
const Index = lazy(() => import("./pages/Index.tsx"));
const InsightsPage = lazy(() => import("./pages/Insights.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const ProfilePage = lazy(() => import("./pages/Profile.tsx"));
const SettingsPage = lazy(() => import("./pages/Settings.tsx"));
const TransactionsPage = lazy(() => import("./pages/Transactions.tsx"));

function PageLoader() {
  return (
    <div className="fixed top-4 left-4 z-50">
      <FinlyMiniLoader />
    </div>
  );
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path={appRoutes.login} element={<LoginPage />} />
              <Route path={appRoutes.signup} element={<SignupPage />} />
              <Route path={appRoutes.forgotPassword} element={<ForgotPasswordPage />} />
              <Route path={appRoutes.resetPassword} element={<ResetPasswordPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path={appRoutes.loading} element={<LoadingPage />} />
              <Route path={appRoutes.dashboard} element={<Suspense fallback={<PageLoader />}><Index /></Suspense>} />
              <Route path={appRoutes.transactions} element={<Suspense fallback={<PageLoader />}><TransactionsPage /></Suspense>} />
              <Route path={appRoutes.installments} element={<Navigate to={appRoutes.expenseManagementInstallments} replace />} />
              <Route path={appRoutes.expenseManagementInstallments} element={<Suspense fallback={<PageLoader />}><InstallmentsPage /></Suspense>} />
              <Route path={appRoutes.expenseManagementFinancing} element={<Navigate to={appRoutes.expenseManagementHousing} replace />} />
              <Route path={appRoutes.expenseManagementHousing} element={<Suspense fallback={<PageLoader />}><HousingPage /></Suspense>} />
              <Route path={appRoutes.expenseManagementMetrics} element={<Suspense fallback={<PageLoader />}><ExpenseMetricsPage /></Suspense>} />
              <Route path={appRoutes.chat} element={<Suspense fallback={<PageLoader />}><ChatPage /></Suspense>} />
              <Route path={appRoutes.insights} element={<Suspense fallback={<PageLoader />}><InsightsPage /></Suspense>} />
              <Route path={appRoutes.accounts} element={<Suspense fallback={<PageLoader />}><AccountsPage /></Suspense>} />
              <Route path={appRoutes.profile} element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
              <Route path={appRoutes.settings} element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
            </Route>

            <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
