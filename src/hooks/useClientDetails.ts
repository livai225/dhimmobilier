import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useClientSubscriptions = (clientId: string) => {
  return useQuery({
    queryKey: ["client-subscriptions", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("souscriptions")
        .select(`
          *,
          proprietes (nom, adresse)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });
};

export const useClientLocations = (clientId: string) => {
  return useQuery({
    queryKey: ["client-locations", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select(`
          *,
          proprietes (nom, adresse)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });
};

export const useClientPayments = (clientId: string) => {
  return useQuery({
    queryKey: ["client-payments", clientId],
    queryFn: async () => {
      // First get all subscriptions and locations for this client
      const { data: clientSubscriptions } = await supabase
        .from("souscriptions")
        .select("id")
        .eq("client_id", clientId);

      const { data: clientLocations } = await supabase
        .from("locations")
        .select("id")
        .eq("client_id", clientId);

      const subscriptionIds = clientSubscriptions?.map(s => s.id) || [];
      const locationIds = clientLocations?.map(l => l.id) || [];

      // Fetch subscription payments
      const { data: subscriptionPayments, error: subError } = subscriptionIds.length > 0 
        ? await supabase
            .from("paiements_souscriptions")
            .select(`
              *,
              souscriptions (
                proprietes (nom)
              )
            `)
            .in("souscription_id", subscriptionIds)
        : { data: [], error: null };

      // Fetch location payments
      const { data: locationPayments, error: locError } = locationIds.length > 0
        ? await supabase
            .from("paiements_locations")
            .select(`
              *,
              locations (
                proprietes (nom)
              )
            `)
            .in("location_id", locationIds)
        : { data: [], error: null };

      // Fetch land rights payments
      const { data: landRightsPayments, error: landError } = subscriptionIds.length > 0
        ? await supabase
            .from("paiements_droit_terre")
            .select(`
              *,
              souscriptions (
                proprietes (nom)
              )
            `)
            .in("souscription_id", subscriptionIds)
        : { data: [], error: null };

      if (subError) throw subError;
      if (locError) throw locError;
      if (landError) throw landError;

      // Combine all payments with type information
      const allPayments = [
        ...(subscriptionPayments || []).map(p => ({ ...p, type: "souscription" })),
        ...(locationPayments || []).map(p => ({ ...p, type: "location" })),
        ...(landRightsPayments || []).map(p => ({ ...p, type: "droit_terre" }))
      ].sort((a, b) => new Date(b.date_paiement).getTime() - new Date(a.date_paiement).getTime());

      return allPayments;
    },
    enabled: !!clientId,
  });
};

export const useClientReceipts = (clientId: string) => {
  return useQuery({
    queryKey: ["client-receipts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recus")
        .select("*")
        .eq("client_id", clientId)
        .order("date_generation", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });
};

export const useClientStats = (clientId: string) => {
  return useQuery({
    queryKey: ["client-stats", clientId],
    queryFn: async () => {
      // Get subscriptions count
      const { count: subscriptionsCount } = await supabase
        .from("souscriptions")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId);

      // Get active locations count
      const { count: locationsCount } = await supabase
        .from("locations")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("statut", "active");

      // Get all payments for this client
      const { data: clientSubscriptions } = await supabase
        .from("souscriptions")
        .select("id")
        .eq("client_id", clientId);

      const { data: clientLocations } = await supabase
        .from("locations")
        .select("id")
        .eq("client_id", clientId);

      const subscriptionIds = clientSubscriptions?.map(s => s.id) || [];
      const locationIds = clientLocations?.map(l => l.id) || [];

      let totalPaid = 0;

      // Get subscription payments
      if (subscriptionIds.length > 0) {
        const { data: subPayments } = await supabase
          .from("paiements_souscriptions")
          .select("montant")
          .in("souscription_id", subscriptionIds);
        totalPaid += (subPayments || []).reduce((sum, payment) => sum + (payment.montant || 0), 0);
      }

      // Get location payments
      if (locationIds.length > 0) {
        const { data: locPayments } = await supabase
          .from("paiements_locations")
          .select("montant")
          .in("location_id", locationIds);
        totalPaid += (locPayments || []).reduce((sum, payment) => sum + (payment.montant || 0), 0);
      }

      // Get land rights payments
      if (subscriptionIds.length > 0) {
        const { data: landPayments } = await supabase
          .from("paiements_droit_terre")
          .select("montant")
          .in("souscription_id", subscriptionIds);
        totalPaid += (landPayments || []).reduce((sum, payment) => sum + (payment.montant || 0), 0);
      }

      // Get last activity
      const { data: lastReceipt } = await supabase
        .from("recus")
        .select("date_generation")
        .eq("client_id", clientId)
        .order("date_generation", { ascending: false })
        .limit(1)
        .single();

      return {
        subscriptionsCount: subscriptionsCount || 0,
        locationsCount: locationsCount || 0,
        totalPaid,
        lastActivity: lastReceipt?.date_generation
      };
    },
    enabled: !!clientId,
  });
};