import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appRoutes } from "@/lib/routes";
import { AuthProvider } from "@/modules/auth/components/AuthProvider";
import { ProtectedRoute } from "@/modules/auth/components/ProtectedRoute";
import { PublicOnlyRoute } from "@/modules/auth/components/PublicOnlyRoute";
import ForgotPasswordPage from "@/modules/auth/pages/ForgotPasswordPage";
import LoginPage from "@/modules/auth/pages/LoginPage";
import ResetPasswordPage from "@/modules/auth/pages/ResetPasswordPage";
import SignupPage from "@/modules/auth/pages/SignupPage";
import AccountsPage from "./pages/Accounts.tsx";
import ChatPage from "./pages/Chat.tsx";
import ExpenseMetricsPage from "./pages/ExpenseMetrics.tsx";
import HousingPage from "./pages/Housing.tsx";
import InstallmentsPage from "./pages/Installments.tsx";
import Index from "./pages/Index.tsx";
import InsightsPage from "./pages/Insights.tsx";
import NotFound from "./pages/NotFound.tsx";
import ProfilePage from "./pages/Profile.tsx";
import SettingsPage from "./pages/Settings.tsx";
import TransactionsPage from "./pages/Transactions.tsx";

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
              <Route path={appRoutes.dashboard} element={<Index />} />
              <Route path={appRoutes.transactions} element={<TransactionsPage />} />
              <Route path={appRoutes.installments} element={<Navigate to={appRoutes.expenseManagementInstallments} replace />} />
              <Route path={appRoutes.expenseManagementInstallments} element={<InstallmentsPage />} />
              <Route path={appRoutes.expenseManagementFinancing} element={<Navigate to={appRoutes.expenseManagementHousing} replace />} />
              <Route path={appRoutes.expenseManagementHousing} element={<HousingPage />} />
              <Route path={appRoutes.expenseManagementMetrics} element={<ExpenseMetricsPage />} />
              <Route path={appRoutes.chat} element={<ChatPage />} />
              <Route path={appRoutes.insights} element={<InsightsPage />} />
              <Route path={appRoutes.accounts} element={<AccountsPage />} />
              <Route path={appRoutes.profile} element={<ProfilePage />} />
              <Route path={appRoutes.settings} element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
