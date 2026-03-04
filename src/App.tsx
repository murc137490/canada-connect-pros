import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Services from "./pages/Services";
import CategoryPage from "./pages/CategoryPage";
import ServicePage from "./pages/ServicePage";
import JoinPros from "./pages/JoinPros";
import Support from "./pages/Support";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import ProProfilePage from "./pages/ProProfilePage";
import ProListPage from "./pages/ProListPage";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/:slug" element={<CategoryPage />} />
              <Route path="/services/:categorySlug/:serviceSlug" element={<ServicePage />} />
              <Route path="/services/:categorySlug/:serviceSlug/pros" element={<ProListPage />} />
              <Route path="/pros/:proId" element={<ProProfilePage />} />
              <Route path="/join-pros" element={<JoinPros />} />
              <Route path="/support" element={<Support />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
