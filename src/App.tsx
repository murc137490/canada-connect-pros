import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Services from "./pages/Services";
import CategoryPage from "./pages/CategoryPage";
import JoinPros from "./pages/JoinPros";
import ProPlans from "./pages/ProPlans";
import ProPlansManagement from "./pages/ProPlansManagement";
import Support from "./pages/Support";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProProfilePage from "./pages/ProProfilePage";
import ProListPage from "./pages/ProListPage";
import CreateProAccount from "./pages/CreateProAccount";
import Dashboard from "./pages/Dashboard";
import MakeRequest from "./pages/MakeRequest";
import TermsOfService from "./pages/TermsOfService";

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
            <NotificationProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/:slug" element={<CategoryPage />} />
              <Route path="/services/:categorySlug/:serviceSlug" element={<RedirectToPros />} />
              <Route path="/services/:categorySlug/:serviceSlug/pros" element={<ProListPage />} />
              <Route path="/pros/:proId" element={<ProProfilePage />} />
              <Route path="/join-pros" element={<JoinPros />} />
              <Route path="/join-pros/plans" element={<ProPlans />} />
              <Route path="/pro-plans" element={<ProPlansManagement />} />
              <Route path="/create-pro-account" element={<CreateProAccount />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/make-request" element={<MakeRequest />} />
              <Route path="/admin" element={<Navigate to="/dashboard?tab=admin" replace />} />
              <Route path="/support" element={<Support />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
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
