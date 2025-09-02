import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { setQueryClient } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
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
import NotFound from "./pages/NotFound";
import Caisse from "./pages/Caisse";
import Agents from "./pages/Agents";

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
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/clients" element={<Layout><Clients /></Layout>} />
          <Route path="/proprietes" element={<Layout><Proprietes /></Layout>} />
          <Route path="/fournisseurs" element={<Layout><Fournisseurs /></Layout>} />
          <Route path="/factures" element={<Layout><Factures /></Layout>} />
          <Route path="/souscriptions" element={<Layout><Souscriptions /></Layout>} />
          <Route path="/locations" element={<Layout><Locations /></Layout>} />
          
          <Route path="/caisse" element={<Layout><Caisse /></Layout>} />
          <Route path="/agents" element={<Layout><Agents /></Layout>} />
          <Route path="/recus" element={<Layout><Recus /></Layout>} />
          <Route path="/settings" element={<Layout><Settings /></Layout>} />
          <Route path="/receipt-integrity" element={<Layout><ReceiptIntegrity /></Layout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
