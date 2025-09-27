import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AgentStats {
  totalProperties: number;
  activeLocations: number;
  monthlyRentTotal: number;
  activeSubscriptions: number;
  monthlyLandRightsTotal: number;
  totalMonthlyIncome: number;
}

export function useAgentStats(agentId: string | null) {
  return useQuery({
    queryKey: ["agent-stats", agentId],
    queryFn: async (): Promise<AgentStats> => {
      if (!agentId || agentId === "all") {
        return {
          totalProperties: 0,
          activeLocations: 0,
          monthlyRentTotal: 0,
          activeSubscriptions: 0,
          monthlyLandRightsTotal: 0,
          totalMonthlyIncome: 0,
        };
      }

      // Get properties managed by this agent
      const { data: properties, error: propertiesError } = await supabase
        .from("proprietes")
        .select("id, loyer_mensuel")
        .eq("agent_id", agentId);

      if (propertiesError) throw propertiesError;

      const propertyIds = properties?.map(p => p.id) || [];

      // Get active locations for this agent's properties
      const { data: locations, error: locationsError } = await supabase
        .from("locations")
        .select("id, loyer_mensuel")
        .in("propriete_id", propertyIds)
        .eq("statut", "active");

      if (locationsError) throw locationsError;

      // Get active subscriptions for this agent's properties
      const { data: souscriptions, error: souscriptionsError } = await supabase
        .from("souscriptions")
        .select("id, montant_droit_terre_mensuel, phase_actuelle")
        .in("propriete_id", propertyIds)
        .eq("statut", "active");

      if (souscriptionsError) throw souscriptionsError;

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
      };
    },
    enabled: !!agentId && agentId !== "all",
  });
}