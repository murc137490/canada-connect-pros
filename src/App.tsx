import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { WhatsNewProvider } from "@/contexts/WhatsNewContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Services from "./pages/Services";
import CategoryPage from "./pages/CategoryPage";
import JoinPros from "./pages/JoinPros";
import ProPlans from "./pages/ProPlans";
import ProPlansManagement from "./pages/ProPlansManagement";
import ProPlanCancel from "./pages/ProPlanCancel";
import ProPlansFreeTrial from "./pages/ProPlansFreeTrial";
import Support from "./pages/Support";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProProfilePage from "./pages/ProProfilePage";
import ProListPage from "./pages/ProListPage";
import CreateProAccount from "./pages/CreateProAccount";
import Dashboard from "./pages/Dashboard";
import AdminIssueReports from "./pages/AdminIssueReports";
import AdminJobRequests from "./pages/AdminJobRequests";
import AdminTrialTokens from "./pages/AdminTrialTokens";
import MakeRequest from "./pages/MakeRequest";
import TermsOfService from "./pages/TermsOfService";
import PhonePreview from "./pages/PhonePreview";
import ResetPassword from "./pages/ResetPassword";
import ProOnboardingStart from "./pages/ProOnboardingStart";
import ProOnboardingTier from "./pages/ProOnboardingTier";
import AuthHashErrorToast from "@/components/AuthHashErrorToast";
import MonitorAdminGuard from "@/components/MonitorAdminGuard";
import AdminAcceptPros from "./pages/AdminAcceptPros";

const queryClient = new QueryClient();

function RedirectToPros() {
  const { categorySlug, serviceSlug } = useParams<{ categorySlug: string; serviceSlug: string }>();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  return (
    <Navigate
      to={{ pathname: `/services/${categorySlug}/${serviceSlug}/pros`, search: search ? `?${search}` : "" }}
      replace
    />
  );
}

const App = () => (
  <ErrorBoundary>
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="premiere-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <LanguageProvider>
            <AuthProvider>
            <AuthHashErrorToast />
            <NotificationProvider>
            <WhatsNewProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/:slug" element={<CategoryPage />} />
              <Route path="/services/:categorySlug/:serviceSlug" element={<RedirectToPros />} />
              <Route path="/services/:categorySlug/:serviceSlug/pros" element={<ProListPage />} />
              <Route path="/pros/:proId" element={<ProProfilePage />} />
              <Route path="/join-pros" element={<MonitorAdminGuard><JoinPros /></MonitorAdminGuard>} />
              <Route path="/join-pros/plans" element={<MonitorAdminGuard><ProPlans /></MonitorAdminGuard>} />
              <Route path="/pro-plans/trial" element={<MonitorAdminGuard><ProPlansFreeTrial /></MonitorAdminGuard>} />
              <Route path="/pro-plans/freetrial" element={<MonitorAdminGuard><ProPlansFreeTrial /></MonitorAdminGuard>} />
              <Route path="/pro-plans" element={<MonitorAdminGuard><ProPlansManagement /></MonitorAdminGuard>} />
              <Route path="/pro-plans/cancel" element={<MonitorAdminGuard><ProPlanCancel /></MonitorAdminGuard>} />
              <Route path="/pro-plans/checkout" element={<Navigate to="/pro-plans" replace />} />
              <Route path="/create-pro-account" element={<MonitorAdminGuard><CreateProAccount /></MonitorAdminGuard>} />
              <Route path="/pro-onboarding/start" element={<MonitorAdminGuard><ProOnboardingStart /></MonitorAdminGuard>} />
              <Route path="/pro-onboarding/tier" element={<MonitorAdminGuard><ProOnboardingTier /></MonitorAdminGuard>} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin/accept-pros" element={<AdminAcceptPros />} />
              <Route path="/admin/issue-reports" element={<AdminIssueReports />} />
              <Route path="/admin/job-requests" element={<AdminJobRequests />} />
              <Route path="/admin/trial-tokens" element={<AdminTrialTokens />} />
              <Route path="/make-request" element={<MonitorAdminGuard><MakeRequest /></MonitorAdminGuard>} />
              <Route path="/admin" element={<Navigate to="/dashboard?tab=admin" replace />} />
              <Route path="/support" element={<Support />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/phone-preview" element={<PhonePreview />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </WhatsNewProvider>
            </NotificationProvider>
          </AuthProvider>
          </LanguageProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
  </ErrorBoundary>
);

export default App;
