import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy as reactLazy, Suspense, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KiplyLoader } from "@/components/KiplyLoader";
import { KiplyMiniLoader } from "@/components/KiplyMiniLoader";
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

const PAGE_LOADER_MINIMUM_ORBIT_MS = import.meta.env.MODE === "test" ? 0 : 500;

function waitForMinimumPageLoaderTime() {
  if (PAGE_LOADER_MINIMUM_ORBIT_MS <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.setTimeout(resolve, PAGE_LOADER_MINIMUM_ORBIT_MS);
  });
}

function lazy<TProps>(loadPage: () => Promise<{ default: ComponentType<TProps> }>) {
  return reactLazy(async () => {
    const [module] = await Promise.all([loadPage(), waitForMinimumPageLoaderTime()]);

    return module;
  });
}

const AccountsPage = lazy(() => import("./pages/Accounts.tsx"));
const AccountDeletedPage = lazy(() => import("./pages/AccountDeleted.tsx"));
const AdminActivityPage = lazy(() => import("./pages/admin/AdminActivityPage.tsx"));
const AdminAiUsagePage = lazy(() => import("./pages/admin/AdminAiUsagePage.tsx"));
const AdminFinancialMetricsPage = lazy(() => import("./pages/admin/AdminFinancialMetricsPage.tsx"));
const AdminNotificationsPage = lazy(() => import("./pages/admin/AdminNotificationsPage.tsx"));
const AdminOverviewPage = lazy(() => import("./pages/admin/AdminOverviewPage.tsx"));
const AdminSubscriptionsPage = lazy(() => import("./pages/admin/AdminSubscriptionsPage.tsx"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage.tsx"));
const ChatPage = lazy(() => import("./pages/Chat.tsx"));
const CreditCardInvoicesPage = lazy(() => import("./pages/CreditCardInvoices.tsx"));
const ExpenseMetricsPage = lazy(() => import("./pages/ExpenseMetrics.tsx"));
const RecurringIncomePage = lazy(() => import("./pages/RecurringIncome.tsx"));
const HousingPage = lazy(() => import("./pages/Housing.tsx"));
const InstallmentsPage = lazy(() => import("./pages/Installments.tsx"));
const Index = lazy(() => import("./pages/Index.tsx"));
const InsightsPage = lazy(() => import("./pages/Insights.tsx"));
const InvestmentsPage = lazy(() => import("./pages/Investments.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const NotificationsPage = lazy(() => import("./pages/Notifications.tsx"));
const OnboardingPage = lazy(() => import("./pages/Onboarding.tsx"));
const PlanDetailPage = lazy(() => import("./pages/PlanDetail.tsx"));
const PlansPage = lazy(() => import("./pages/Plans.tsx"));
const ProfilePage = lazy(() => import("./pages/Profile.tsx"));
const SettingsPage = lazy(() => import("./pages/Settings.tsx"));
const TransactionsPage = lazy(() => import("./pages/Transactions.tsx"));
const PricingPage = lazy(() => import("./pages/Pricing.tsx"));
const LegalPage = lazy(() => import("./pages/LegalPage.tsx"));
const BillingSuccessPage = lazy(() => import("./pages/BillingSuccess.tsx"));
const BillingCancelPage = lazy(() => import("./pages/BillingCancel.tsx"));

function PageLoader() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <KiplyMiniLoader />
    </div>
  );
}

function InitialLoadingPreview() {
  return <KiplyLoader />;
}

function PageTransitionLoadingPreview() {
  return (
    <div className="min-h-screen bg-background">
      <PageLoader />
    </div>
  );
}

function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();

  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
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
            <RouteErrorBoundary>
              <Routes>
                <Route path={appRoutes.debugInitialLoading} element={<InitialLoadingPreview />} />
                <Route path={appRoutes.debugPageTransitionLoading} element={<PageTransitionLoadingPreview />} />

                <Route element={<PublicOnlyRoute />}>
                  <Route path={appRoutes.login} element={<LoginPage />} />
                  <Route path={appRoutes.signup} element={<SignupPage />} />
                  <Route path={appRoutes.forgotPassword} element={<ForgotPasswordPage />} />
                  <Route path={appRoutes.resetPassword} element={<ResetPasswordPage />} />
                </Route>

                <Route element={<ProtectedRoute />}>
                  <Route
                    path={appRoutes.onboarding}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <OnboardingPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.dashboard}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <Index />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.transactions}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <TransactionsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.expenseManagementRecurringIncome}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <RecurringIncomePage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.expenseManagementInvoices}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <CreditCardInvoicesPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.installments}
                    element={<Navigate to={appRoutes.expenseManagementInstallments} replace />}
                  />
                  <Route
                    path={appRoutes.expenseManagementInstallments}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <InstallmentsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.expenseManagementFinancing}
                    element={<Navigate to={appRoutes.expenseManagementHousing} replace />}
                  />
                  <Route
                    path={appRoutes.expenseManagementHousing}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <HousingPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.expenseManagementMetrics}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <ExpenseMetricsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.chat}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <ChatPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.chatConversation}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <ChatPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.plans}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <PlansPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.planDetail}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <PlanDetailPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.insights}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <InsightsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.savingsGoal}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <InvestmentsPage />
                      </Suspense>
                    }
                  />
                  <Route path={appRoutes.legacyInvestments} element={<Navigate to={appRoutes.savingsGoal} replace />} />
                  <Route
                    path={appRoutes.notifications}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <NotificationsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={`${appRoutes.notifications}/:recipientId`}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <NotificationsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.accounts}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <AccountsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.profile}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <ProfilePage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.settings}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <SettingsPage />
                      </Suspense>
                    }
                  />
                </Route>

                <Route element={<AdminRoute />}>
                  <Route path={appRoutes.admin} element={<Navigate to={appRoutes.adminOverview} replace />} />
                  <Route
                    path={appRoutes.adminOverview}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <AdminOverviewPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.adminUsers}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <AdminUsersPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.adminFinancialMetrics}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <AdminFinancialMetricsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.adminAiUsage}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <AdminAiUsagePage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.adminSubscriptions}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <AdminSubscriptionsPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.adminActivity}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <AdminActivityPage />
                      </Suspense>
                    }
                  />
                  <Route
                    path={appRoutes.adminNotifications}
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <AdminNotificationsPage />
                      </Suspense>
                    }
                  />
                </Route>

                <Route
                  path={appRoutes.pricing}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <PricingPage />
                    </Suspense>
                  }
                />
                <Route
                  path={appRoutes.legalTerms}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <LegalPage type="terms" />
                    </Suspense>
                  }
                />
                <Route
                  path={appRoutes.legalPrivacy}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <LegalPage type="privacy" />
                    </Suspense>
                  }
                />
                <Route
                  path={appRoutes.legalCancellation}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <LegalPage type="cancellation" />
                    </Suspense>
                  }
                />
                <Route
                  path={appRoutes.accountDeleted}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AccountDeletedPage />
                    </Suspense>
                  }
                />
                <Route
                  path={appRoutes.billingSuccess}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <BillingSuccessPage />
                    </Suspense>
                  }
                />
                <Route
                  path={appRoutes.billingCancel}
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <BillingCancelPage />
                    </Suspense>
                  }
                />

                <Route
                  path="*"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <NotFound />
                    </Suspense>
                  }
                />
              </Routes>
            </RouteErrorBoundary>
          </ProductTourProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
