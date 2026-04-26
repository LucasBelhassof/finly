import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FinlyMiniLoader } from "@/components/FinlyMiniLoader";
import { appRoutes } from "@/lib/routes";
import { AdminRoute } from "@/modules/auth/components/AdminRoute";
import { AuthProvider } from "@/modules/auth/components/AuthProvider";
import { ProtectedRoute } from "@/modules/auth/components/ProtectedRoute";
import { PublicOnlyRoute } from "@/modules/auth/components/PublicOnlyRoute";
import { ProductTourProvider } from "@/modules/product-tour/ProductTourProvider";
import ForgotPasswordPage from "@/modules/auth/pages/ForgotPasswordPage";
import LoginPage from "@/modules/auth/pages/LoginPage";
import ResetPasswordPage from "@/modules/auth/pages/ResetPasswordPage";
import SignupPage from "@/modules/auth/pages/SignupPage";

const AccountsPage = lazy(() => import("./pages/Accounts.tsx"));
const AdminActivityPage = lazy(() => import("./pages/admin/AdminActivityPage.tsx"));
const AdminFinancialMetricsPage = lazy(() => import("./pages/admin/AdminFinancialMetricsPage.tsx"));
const AdminNotificationsPage = lazy(() => import("./pages/admin/AdminNotificationsPage.tsx"));
const AdminOverviewPage = lazy(() => import("./pages/admin/AdminOverviewPage.tsx"));
const AdminSubscriptionsPage = lazy(() => import("./pages/admin/AdminSubscriptionsPage.tsx"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage.tsx"));
const ChatPage = lazy(() => import("./pages/Chat.tsx"));
const ExpenseMetricsPage = lazy(() => import("./pages/ExpenseMetrics.tsx"));
const RecurringIncomePage = lazy(() => import("./pages/RecurringIncome.tsx"));
const HousingPage = lazy(() => import("./pages/Housing.tsx"));
const InstallmentsPage = lazy(() => import("./pages/Installments.tsx"));
const Index = lazy(() => import("./pages/Index.tsx"));
const InsightsPage = lazy(() => import("./pages/Insights.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const NotificationsPage = lazy(() => import("./pages/Notifications.tsx"));
const OnboardingPage = lazy(() => import("./pages/Onboarding.tsx"));
const PlanDetailPage = lazy(() => import("./pages/PlanDetail.tsx"));
const PlansPage = lazy(() => import("./pages/Plans.tsx"));
const ProfilePage = lazy(() => import("./pages/Profile.tsx"));
const SettingsPage = lazy(() => import("./pages/Settings.tsx"));
const TransactionsPage = lazy(() => import("./pages/Transactions.tsx"));

function PageLoader() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
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
          <ProductTourProvider>
            <Routes>
              <Route element={<PublicOnlyRoute />}>
                <Route path={appRoutes.login} element={<LoginPage />} />
                <Route path={appRoutes.signup} element={<SignupPage />} />
                <Route path={appRoutes.forgotPassword} element={<ForgotPasswordPage />} />
                <Route path={appRoutes.resetPassword} element={<ResetPasswordPage />} />
              </Route>

              <Route element={<ProtectedRoute />}>
                <Route path={appRoutes.onboarding} element={<Suspense fallback={<PageLoader />}><OnboardingPage /></Suspense>} />
                <Route path={appRoutes.dashboard} element={<Suspense fallback={<PageLoader />}><Index /></Suspense>} />
                <Route path={appRoutes.transactions} element={<Suspense fallback={<PageLoader />}><TransactionsPage /></Suspense>} />
                <Route path={appRoutes.expenseManagementRecurringIncome} element={<Suspense fallback={<PageLoader />}><RecurringIncomePage /></Suspense>} />
                <Route path={appRoutes.installments} element={<Navigate to={appRoutes.expenseManagementInstallments} replace />} />
                <Route path={appRoutes.expenseManagementInstallments} element={<Suspense fallback={<PageLoader />}><InstallmentsPage /></Suspense>} />
                <Route path={appRoutes.expenseManagementFinancing} element={<Navigate to={appRoutes.expenseManagementHousing} replace />} />
                <Route path={appRoutes.expenseManagementHousing} element={<Suspense fallback={<PageLoader />}><HousingPage /></Suspense>} />
                <Route path={appRoutes.expenseManagementMetrics} element={<Suspense fallback={<PageLoader />}><ExpenseMetricsPage /></Suspense>} />
                <Route path={appRoutes.chat} element={<Suspense fallback={<PageLoader />}><ChatPage /></Suspense>} />
                <Route path={appRoutes.chatConversation} element={<Suspense fallback={<PageLoader />}><ChatPage /></Suspense>} />
                <Route path={appRoutes.plans} element={<Suspense fallback={<PageLoader />}><PlansPage /></Suspense>} />
                <Route path={appRoutes.planDetail} element={<Suspense fallback={<PageLoader />}><PlanDetailPage /></Suspense>} />
                <Route path={appRoutes.insights} element={<Suspense fallback={<PageLoader />}><InsightsPage /></Suspense>} />
                <Route path={appRoutes.notifications} element={<Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense>} />
                <Route path={`${appRoutes.notifications}/:recipientId`} element={<Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense>} />
                <Route path={appRoutes.accounts} element={<Suspense fallback={<PageLoader />}><AccountsPage /></Suspense>} />
                <Route path={appRoutes.profile} element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
                <Route path={appRoutes.settings} element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
              </Route>

              <Route element={<AdminRoute />}>
                <Route path={appRoutes.admin} element={<Navigate to={appRoutes.adminOverview} replace />} />
                <Route path={appRoutes.adminOverview} element={<Suspense fallback={<PageLoader />}><AdminOverviewPage /></Suspense>} />
                <Route path={appRoutes.adminUsers} element={<Suspense fallback={<PageLoader />}><AdminUsersPage /></Suspense>} />
                <Route path={appRoutes.adminFinancialMetrics} element={<Suspense fallback={<PageLoader />}><AdminFinancialMetricsPage /></Suspense>} />
                <Route path={appRoutes.adminSubscriptions} element={<Suspense fallback={<PageLoader />}><AdminSubscriptionsPage /></Suspense>} />
                <Route path={appRoutes.adminActivity} element={<Suspense fallback={<PageLoader />}><AdminActivityPage /></Suspense>} />
                <Route path={appRoutes.adminNotifications} element={<Suspense fallback={<PageLoader />}><AdminNotificationsPage /></Suspense>} />
              </Route>

              <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
            </Routes>
          </ProductTourProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
