import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { initRealtime } from "@/integrations/api/realtime";
import { Layout } from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ThemeProvider";

// Route-level code splitting to reduce initial JS payload.
const Index = lazy(() => import("./pages/Index"));
const Clients = lazy(() => import("./pages/Clients"));
const Proprietes = lazy(() => import("./pages/Proprietes"));
const Fournisseurs = lazy(() => import("./pages/Fournisseurs"));
const Factures = lazy(() => import("./pages/Factures"));
const Souscriptions = lazy(() => import("./pages/Souscriptions"));
const Locations = lazy(() => import("./pages/Locations"));
const Recus = lazy(() => import("./pages/Recus"));
const ReceiptIntegrity = lazy(() => import("./pages/ReceiptIntegrity"));
const ImportSouscriptionsHistoriques = lazy(() => import("./pages/ImportSouscriptionsHistoriques"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Caisse = lazy(() => import("./pages/Caisse"));
const Agents = lazy(() => import("./pages/Agents"));
const Users = lazy(() => import("./pages/Users"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Recouvrement = lazy(() => import("./pages/Recouvrement"));
const Settings = lazy(() => import("./pages/Settings"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds - prevent excessive refetching
      refetchOnWindowFocus: false, // Disable automatic refetch on focus
    },
  },
});

// Configure the queryClient for Realtime invalidations
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
          <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement...</div>}>
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
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
