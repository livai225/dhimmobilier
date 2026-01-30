import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { setQueryClient } from "@/integrations/supabase/client";
import { initRealtime } from "@/integrations/api/realtime";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";
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
initRealtime(queryClient);

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
        <BrowserRouter basename="/dhimmobilier">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Layout><Index /></Layout></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Layout><Index /></Layout></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Layout><Clients /></Layout></ProtectedRoute>} />
            <Route path="/proprietes" element={<ProtectedRoute><Layout><Proprietes /></Layout></ProtectedRoute>} />
            <Route path="/fournisseurs" element={<ProtectedRoute><Layout><Fournisseurs /></Layout></ProtectedRoute>} />
            <Route path="/factures" element={<ProtectedRoute><Layout><Factures /></Layout></ProtectedRoute>} />
            <Route path="/souscriptions" element={<ProtectedRoute><Layout><Souscriptions /></Layout></ProtectedRoute>} />
            <Route path="/locations" element={<ProtectedRoute><Layout><Locations /></Layout></ProtectedRoute>} />
            <Route path="/caisse" element={<ProtectedRoute><Layout><Caisse /></Layout></ProtectedRoute>} />
            <Route path="/agents" element={<ProtectedRoute><Layout><Agents /></Layout></ProtectedRoute>} />
            <Route path="/recouvrement" element={<ProtectedRoute><Layout><Recouvrement /></Layout></ProtectedRoute>} />
            <Route path="/recus" element={<ProtectedRoute><Layout><Recus /></Layout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><Layout><Users /></Layout></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute><Layout><AuditLogs /></Layout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
            <Route path="/receipt-integrity" element={<ProtectedRoute><Layout><ReceiptIntegrity /></Layout></ProtectedRoute>} />
            <Route path="/import-souscriptions-historiques" element={<ProtectedRoute><Layout><ImportSouscriptionsHistoriques /></Layout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
