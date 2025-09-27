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
  totalDue: number;
  totalPaid: number;
  recoveryRate: number;
  outstanding: number;
}

export function useAgentStats(agentId: string | null, mode: 'locations' | 'souscriptions' | 'all' = 'all', selectedMonth?: string) {
  return useQuery({
    queryKey: ["agent-stats", agentId, mode, selectedMonth],
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
          totalDue: 0,
          totalPaid: 0,
          recoveryRate: 0,
          outstanding: 0,
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

      // Payment metrics variables
      let totalDue = 0;
      let totalPaid = 0;
      let recoveryRate = 0;
      let outstanding = 0;

      // Parse selected month for filtering
      let startDate: string | undefined;
      let endDate: string | undefined;
      
      if (selectedMonth && selectedMonth !== 'all') {
        const [year, month] = selectedMonth.split('-');
        startDate = `${year}-${month.padStart(2, '0')}-01`;
        endDate = `${year}-${month.padStart(2, '0')}-31`;
      }

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

      // Calculate payment metrics
      if (mode === 'locations' || mode === 'all') {
        // Calculate total due for locations based on time elapsed
        for (const location of locations) {
          const monthsElapsed = Math.floor(
            (new Date().getTime() - new Date(location.date_debut).getTime()) / (1000 * 60 * 60 * 24 * 30)
          );
          const dueAmount = location.type_contrat === 'historique' 
            ? monthsElapsed * location.loyer_mensuel
            : monthsElapsed === 0 
              ? location.loyer_mensuel * 10 
              : (location.loyer_mensuel * 10) + ((monthsElapsed - 1) * location.loyer_mensuel);
          totalDue += dueAmount;
        }

        // Get actual payments for locations
        let paymentsQuery = supabase
          .from("paiements_locations")
          .select("montant, location_id")
          .in("location_id", locations.map(l => l.id));
        
        if (startDate && endDate) {
          paymentsQuery = paymentsQuery
            .gte("date_paiement", startDate)
            .lte("date_paiement", endDate);
        }

        const { data: locationPayments } = await paymentsQuery;
        totalPaid += locationPayments?.reduce((sum, p) => sum + (p.montant || 0), 0) || 0;
      }

      if (mode === 'souscriptions' || mode === 'all') {
        // Calculate due for land rights based on months elapsed since start
        for (const souscription of souscriptions) {
          if (souscription.phase_actuelle === "droit_terre" && souscription.date_debut_droit_terre) {
            const monthsElapsed = Math.floor(
              (new Date().getTime() - new Date(souscription.date_debut_droit_terre).getTime()) / (1000 * 60 * 60 * 24 * 30)
            );
            totalDue += monthsElapsed * (souscription.montant_droit_terre_mensuel || 0);
          }
        }

        // Get actual payments for land rights
        let landPaymentsQuery = supabase
          .from("paiements_droit_terre")
          .select("montant, souscription_id")
          .in("souscription_id", souscriptions.map(s => s.id));
        
        if (startDate && endDate) {
          landPaymentsQuery = landPaymentsQuery
            .gte("date_paiement", startDate)
            .lte("date_paiement", endDate);
        }

        const { data: landPayments } = await landPaymentsQuery;
        totalPaid += landPayments?.reduce((sum, p) => sum + (p.montant || 0), 0) || 0;
      }

      // Calculate recovery rate and outstanding
      recoveryRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;
      outstanding = Math.max(0, totalDue - totalPaid);

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
        totalDue,
        totalPaid,
        recoveryRate,
        outstanding,
      };
    },
    enabled: !!agentId && agentId !== "all",
  });
}