import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AgentStats {
  totalProperties: number;
  activeLocations: number;
  monthlyRentTotal: number;
  activeSubscriptions: number;
  monthlyLandRightsTotal: number;
  totalMonthlyIncome: number;
  totalClients: number;
  clientsFromLocations: number;
  clientsFromSubscriptions: number;
}

export function useAgentStats(agentId: string | null, mode: 'locations' | 'souscriptions' | 'all' = 'all') {
  return useQuery({
    queryKey: ["agent-stats", agentId, mode],
    queryFn: async (): Promise<AgentStats> => {
      if (!agentId || agentId === "all") {
        return {
          totalProperties: 0,
          activeLocations: 0,
          monthlyRentTotal: 0,
          activeSubscriptions: 0,
          monthlyLandRightsTotal: 0,
          totalMonthlyIncome: 0,
          totalClients: 0,
          clientsFromLocations: 0,
          clientsFromSubscriptions: 0,
        };
      }

      // Get properties managed by this agent
      const { data: properties, error: propertiesError } = await supabase
        .from("proprietes")
        .select("id, loyer_mensuel")
        .eq("agent_id", agentId);

      if (propertiesError) throw propertiesError;

      const propertyIds = properties?.map(p => p.id) || [];

      let locations = [];
      let souscriptions = [];
      let clientsFromLocations = 0;
      let clientsFromSubscriptions = 0;
      let totalClients = 0;

      // Get active locations for this agent's properties (if needed)
      if (mode === 'locations' || mode === 'all') {
        const { data: locationsData, error: locationsError } = await supabase
          .from("locations")
          .select("id, loyer_mensuel, client_id")
          .in("propriete_id", propertyIds)
          .eq("statut", "active");

        if (locationsError) throw locationsError;
        locations = locationsData || [];

        // Count distinct clients from locations
        const uniqueLocationClients = new Set(locations.map(l => l.client_id));
        clientsFromLocations = uniqueLocationClients.size;
      }

      // Get active subscriptions for this agent's properties (if needed)
      if (mode === 'souscriptions' || mode === 'all') {
        const { data: souscriptionsData, error: souscriptionsError } = await supabase
          .from("souscriptions")
          .select("id, montant_droit_terre_mensuel, phase_actuelle, client_id")
          .in("propriete_id", propertyIds)
          .eq("statut", "active");

        if (souscriptionsError) throw souscriptionsError;
        souscriptions = souscriptionsData || [];

        // Count distinct clients from subscriptions
        const uniqueSubscriptionClients = new Set(souscriptions.map(s => s.client_id));
        clientsFromSubscriptions = uniqueSubscriptionClients.size;
      }

      // Calculate total unique clients (avoiding duplicates)
      if (mode === 'all') {
        const allClientIds = new Set([
          ...locations.map(l => l.client_id),
          ...souscriptions.map(s => s.client_id)
        ]);
        totalClients = allClientIds.size;
      } else if (mode === 'locations') {
        totalClients = clientsFromLocations;
      } else if (mode === 'souscriptions') {
        totalClients = clientsFromSubscriptions;
      }

      // Calculate totals
      const monthlyRentTotal = locations?.reduce((sum, loc) => sum + (loc.loyer_mensuel || 0), 0) || 0;
      
      const activeSubscriptionsWithLandRights = souscriptions?.filter(s => 
        s.phase_actuelle === "droit_terre" && s.montant_droit_terre_mensuel > 0
      ) || [];
      
      const monthlyLandRightsTotal = activeSubscriptionsWithLandRights.reduce(
        (sum, sub) => sum + (sub.montant_droit_terre_mensuel || 0), 0
      );

      return {
        totalProperties: properties?.length || 0,
        activeLocations: locations?.length || 0,
        monthlyRentTotal,
        activeSubscriptions: souscriptions?.length || 0,
        monthlyLandRightsTotal,
        totalMonthlyIncome: monthlyRentTotal + monthlyLandRightsTotal,
        totalClients,
        clientsFromLocations,
        clientsFromSubscriptions,
      };
    },
    enabled: !!agentId && agentId !== "all",
  });
}