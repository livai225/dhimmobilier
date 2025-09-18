import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { setQueryClient } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProtectedRoute } from "@/components/AuthProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import Index from "./pages/Index";
import Clients from "./pages/Clients";
import Proprietes from "./pages/Proprietes";
import Fournisseurs from "./pages/Fournisseurs";
import Factures from "./pages/Factures";
import Souscriptions from "./pages/Souscriptions";
import Locations from "./pages/Locations";
import Recus from "./pages/Recus";
import ReceiptIntegrity from "./pages/ReceiptIntegrity";
import ImportSouscriptionsHistoriques from "./pages/ImportSouscriptionsHistoriques";
import Login from "./pages/Login";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Caisse from "./pages/Caisse";
import Agents from "./pages/Agents";
import Users from "./pages/Users";
import AuditLogs from "./pages/AuditLogs";
import Recouvrement from "./pages/Recouvrement";
import Settings from "./pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds - prevent excessive refetching
      refetchOnWindowFocus: false, // Disable automatic refetch on focus
    },
  },
});

// Configure the queryClient for Realtime invalidations
setQueryClient(queryClient);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Auth />} />
              <Route path="/dashboard" element={<AuthProtectedRoute><Index /></AuthProtectedRoute>} />
              <Route path="/clients" element={<AuthProtectedRoute><Layout><Clients /></Layout></AuthProtectedRoute>} />
              <Route path="/proprietes" element={<AuthProtectedRoute><Layout><Proprietes /></Layout></AuthProtectedRoute>} />
              <Route path="/fournisseurs" element={<AuthProtectedRoute><Layout><Fournisseurs /></Layout></AuthProtectedRoute>} />
              <Route path="/factures" element={<AuthProtectedRoute><Layout><Factures /></Layout></AuthProtectedRoute>} />
              <Route path="/souscriptions" element={<AuthProtectedRoute><Layout><Souscriptions /></Layout></AuthProtectedRoute>} />
              <Route path="/locations" element={<AuthProtectedRoute><Layout><Locations /></Layout></AuthProtectedRoute>} />
              
              <Route path="/caisse" element={<AuthProtectedRoute><Layout><Caisse /></Layout></AuthProtectedRoute>} />
              <Route path="/agents" element={<AuthProtectedRoute><Layout><Agents /></Layout></AuthProtectedRoute>} />
              <Route path="/recouvrement" element={<AuthProtectedRoute><Layout><Recouvrement /></Layout></AuthProtectedRoute>} />
              <Route path="/recus" element={<AuthProtectedRoute><Layout><Recus /></Layout></AuthProtectedRoute>} />
              <Route path="/users" element={<AuthProtectedRoute><Layout><Users /></Layout></AuthProtectedRoute>} />
              <Route path="/audit-logs" element={<AuthProtectedRoute><Layout><AuditLogs /></Layout></AuthProtectedRoute>} />
              <Route path="/settings" element={<AuthProtectedRoute><Layout><Settings /></Layout></AuthProtectedRoute>} />
              <Route path="/receipt-integrity" element={<AuthProtectedRoute><Layout><ReceiptIntegrity /></Layout></AuthProtectedRoute>} />
              <Route path="/import-souscriptions-historiques" element={<AuthProtectedRoute><Layout><ImportSouscriptionsHistoriques /></Layout></AuthProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
