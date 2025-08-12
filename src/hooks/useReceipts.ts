import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReceiptWithDetails {
  id: string;
  numero: string;
  date_generation: string;
  client_id: string;
  reference_id: string;
  type_operation: string;
  montant_total: number;
  periode_debut: string | null;
  periode_fin: string | null;
  mode_paiement?: string | null;
  client: {
    nom: string;
    prenom: string | null;
    email: string | null;
    telephone_principal: string | null;
  } | null;
}

export const useReceipts = (filters?: {
  type_operation?: string;
  client_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}) => {
  return useQuery({
    queryKey: ["recus", filters],
    queryFn: async () => {
      let query = supabase
        .from("recus")
        .select(`
          *,
          client:clients(nom, prenom, email, telephone_principal)
        `)
        .order("date_generation", { ascending: false });

      if (filters?.type_operation && filters.type_operation !== "all") {
        query = query.eq("type_operation", filters.type_operation);
      }

      if (filters?.client_id && filters.client_id !== "all") {
        query = query.eq("client_id", filters.client_id);
      }

      if (filters?.date_from) {
        query = query.gte("date_generation", filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte("date_generation", filters.date_to);
      }

      if (filters?.search) {
        query = query.ilike("numero", `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Enrichir les reçus avec le mode de paiement
      const enrichedReceipts = await Promise.all(
        data.map(async (receipt) => {
          let mode_paiement = null;

          try {
            // Récupérer le mode de paiement selon le type d'opération
            switch (receipt.type_operation) {
              case 'location':
                // Pour les locations, chercher le paiement le plus proche de la date de génération du reçu
                const receiptDate = new Date(receipt.date_generation);
                const { data: locationPayments } = await supabase
                  .from('paiements_locations')
                  .select('mode_paiement, montant, date_paiement, created_at')
                  .eq('location_id', receipt.reference_id)
                  .eq('montant', receipt.montant_total);
                
                if (locationPayments && locationPayments.length > 0) {
                  // Trouver le paiement avec la date la plus proche de la génération du reçu
                  const closestPayment = locationPayments.reduce((closest, current) => {
                    const currentDiff = Math.abs(new Date(current.date_paiement).getTime() - receiptDate.getTime());
                    const closestDiff = Math.abs(new Date(closest.date_paiement).getTime() - receiptDate.getTime());
                    return currentDiff < closestDiff ? current : closest;
                  });
                  mode_paiement = closestPayment.mode_paiement;
                }
                break;

              case 'paiement_facture':
                const { data: facturePayment } = await supabase
                  .from('paiements_factures')
                  .select('mode_paiement')
                  .eq('id', receipt.reference_id)
                  .single();
                mode_paiement = facturePayment?.mode_paiement;
                break;

              case 'apport_souscription':
                const { data: souscriptionPayment } = await supabase
                  .from('paiements_souscriptions')
                  .select('mode_paiement')
                  .eq('id', receipt.reference_id)
                  .single();
                mode_paiement = souscriptionPayment?.mode_paiement;
                break;

              case 'droit_terre':
                const { data: droitTerrePayment } = await supabase
                  .from('paiements_droit_terre')
                  .select('mode_paiement')
                  .eq('id', receipt.reference_id)
                  .single();
                mode_paiement = droitTerrePayment?.mode_paiement;
                break;
            }
          } catch (error) {
            console.log('Mode de paiement non trouvé pour le reçu:', receipt.numero, error);
          }

          return {
            ...receipt,
            mode_paiement
          } as ReceiptWithDetails;
        })
      );

      let results = enrichedReceipts;

      // Filtrage supplémentaire côté client pour la recherche par nom de client
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        results = results.filter((r) =>
          r.numero.toLowerCase().includes(s) ||
          `${r.client?.nom || ''} ${r.client?.prenom || ''}`.toLowerCase().includes(s)
        );
      }

      return results;
    },
  });
};

export const useReceiptStats = () => {
  return useQuery({
    queryKey: ["receipt-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recus")
        .select("type_operation, montant_total, date_generation");

      if (error) throw error;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const thisMonth = data.filter(r => {
        const date = new Date(r.date_generation);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });

      const stats = {
        totalReceipts: data.length,
        totalThisMonth: thisMonth.reduce((sum, r) => sum + Number(r.montant_total), 0),
        receiptsByType: data.reduce((acc, r) => {
          acc[r.type_operation] = (acc[r.type_operation] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        lastReceipt: data.sort((a, b) => 
          new Date(b.date_generation).getTime() - new Date(a.date_generation).getTime()
        )[0]
      };

      return stats;
    },
  });
};