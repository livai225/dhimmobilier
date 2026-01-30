import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";

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
      const properties = await apiClient.select({
        table: "proprietes",
        filters: [{ op: "eq", column: "agent_id", value: agentId }]
      });

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
        const allLocations = await apiClient.select({
          table: "locations",
          filters: [{ op: "eq", column: "statut", value: "active" }]
        });
        locations = allLocations.filter((l: any) => propertyIds.includes(l.propriete_id));

        // Count distinct clients from locations
        const uniqueLocationClients = new Set(locations.map(l => l.client_id));
        clientsFromLocations = uniqueLocationClients.size;
      }

      // Get active subscriptions for this agent's properties (if needed)
      if (mode === 'souscriptions' || mode === 'all') {
        const allSouscriptions = await apiClient.select({
          table: "souscriptions",
          filters: [{ op: "eq", column: "statut", value: "active" }]
        });
        souscriptions = allSouscriptions.filter((s: any) => propertyIds.includes(s.propriete_id));

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
        if (selectedMonth && selectedMonth !== 'all') {
          // For a specific month, calculate what should be due for that month only
          for (const location of locations) {
            const locationStartDate = new Date(location.date_debut);
            const [year, month] = selectedMonth.split('-');
            const targetDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            
            // Check if the contract was active during the target month
            if (locationStartDate <= targetDate) {
              const monthsElapsed = Math.floor(
                (targetDate.getTime() - locationStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
              );
              
              if (location.type_contrat === 'historique') {
                // Historical contracts: monthly rent due each month
                totalDue += location.loyer_mensuel;
              } else {
                // New contracts: first 10 months are prepaid, then monthly
                if (monthsElapsed >= 10) {
                  totalDue += location.loyer_mensuel;
                }
                // For months 0-9, no additional payment due (prepaid)
              }
            }
          }
        } else {
          // For "all months", calculate cumulative total due since contract start
          for (const location of locations) {
            const monthsElapsed = Math.floor(
              (new Date().getTime() - new Date(location.date_debut).getTime()) / (1000 * 60 * 60 * 24 * 30)
            );
            
            if (location.type_contrat === 'historique') {
              totalDue += monthsElapsed * location.loyer_mensuel;
            } else {
              // New contracts: 10 months prepaid + additional months if any
              if (monthsElapsed > 10) {
                totalDue += (location.loyer_mensuel * 10) + ((monthsElapsed - 10) * location.loyer_mensuel);
              } else {
                totalDue += location.loyer_mensuel * 10; // Initial 10 months
              }
            }
          }
        }

        // Get actual payments for locations
        const locationIds = locations.map((l: any) => l.id);
        let allLocationPayments = await apiClient.select({ table: "paiements_locations" });
        let locationPayments = allLocationPayments.filter((p: any) => locationIds.includes(p.location_id));

        if (startDate && endDate) {
          locationPayments = locationPayments.filter((p: any) => {
            const payDate = p.date_paiement;
            return payDate >= startDate && payDate <= endDate;
          });
        }

        totalPaid += locationPayments?.reduce((sum: number, p: any) => sum + (p.montant || 0), 0) || 0;
      }

      if (mode === 'souscriptions' || mode === 'all') {
        if (selectedMonth && selectedMonth !== 'all') {
          // For a specific month, calculate what should be due for that month only
          for (const souscription of souscriptions) {
            if (souscription.phase_actuelle === "droit_terre" && souscription.date_debut_droit_terre) {
              const droitTerreStartDate = new Date(souscription.date_debut_droit_terre);
              const [year, month] = selectedMonth.split('-');
              const targetDate = new Date(parseInt(year), parseInt(month) - 1, 1);
              
              // Check if land rights were active during the target month
              if (droitTerreStartDate <= targetDate) {
                totalDue += souscription.montant_droit_terre_mensuel || 0;
              }
            }
          }
        } else {
          // For "all months", calculate cumulative total due since land rights start
          for (const souscription of souscriptions) {
            if (souscription.phase_actuelle === "droit_terre" && souscription.date_debut_droit_terre) {
              const monthsElapsed = Math.floor(
                (new Date().getTime() - new Date(souscription.date_debut_droit_terre).getTime()) / (1000 * 60 * 60 * 24 * 30)
              );
              totalDue += monthsElapsed * (souscription.montant_droit_terre_mensuel || 0);
            }
          }
        }

        // Get actual payments for land rights
        const souscriptionIds = souscriptions.map((s: any) => s.id);
        let allLandPayments = await apiClient.select({ table: "paiements_droit_terre" });
        let landPayments = allLandPayments.filter((p: any) => souscriptionIds.includes(p.souscription_id));

        if (startDate && endDate) {
          landPayments = landPayments.filter((p: any) => {
            const payDate = p.date_paiement;
            return payDate >= startDate && payDate <= endDate;
          });
        }

        totalPaid += landPayments?.reduce((sum: number, p: any) => sum + (p.montant || 0), 0) || 0;
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