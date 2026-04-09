import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { appRoutes } from "@/lib/routes";
import AccountsPage from "./pages/Accounts.tsx";
import ChatPage from "./pages/Chat.tsx";
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
        <Routes>
          <Route path={appRoutes.dashboard} element={<Index />} />
          <Route path={appRoutes.transactions} element={<TransactionsPage />} />
          <Route path={appRoutes.installments} element={<InstallmentsPage />} />
          <Route path={appRoutes.chat} element={<ChatPage />} />
          <Route path={appRoutes.insights} element={<InsightsPage />} />
          <Route path={appRoutes.accounts} element={<AccountsPage />} />
          <Route path={appRoutes.profile} element={<ProfilePage />} />
          <Route path={appRoutes.settings} element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
