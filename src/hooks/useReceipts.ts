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
  // Détails enrichis pour l'affichage sur le reçu
  details_type?: 'location' | 'souscription' | 'droit_terre';

  // Nouvelles données contextuelles pour la traçabilité
  property_name?: string | null;
  property_address?: string | null;
  type_bien?: string | null;
  phase_souscription?: string | null;
  is_payment_complete?: boolean;
  remaining_balance?: number | null;
  payment_history?: Array<{
    id: string;
    date: string;
    montant: number;
    mode?: string | null;
    label?: string | null;
    is_current?: boolean;
  }>;
  echeances?: Array<{
    numero: number;
    date: string;
    montant: number;
    statut: string;
    date_paiement?: string | null;
  }>;

  // Location
  loyer_mensuel?: number | null;
  location_total_paye?: number | null;
  location_dette_restante?: number | null;
  location_avances?: {
    garantie_2_mois?: number | null;
    loyer_avance_2_mois?: number | null;
    frais_agence_1_mois?: number | null;
    caution_totale?: number | null;
  } | null;

  // Souscription
  souscription_prix_total?: number | null;
  souscription_apport_initial?: number | null;
  souscription_total_paye?: number | null;
  souscription_solde_restant?: number | null;
  montant_mensuel?: number | null;

  // Droit de terre
  droit_terre_mensuel?: number | null;
  droit_terre_total_paye?: number | null;
  droit_terre_solde_restant?: number | null;
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

// Enrichir les reçus avec le mode de paiement et les détails de contexte
const enrichedReceipts = await Promise.all(
  data.map(async (receipt) => {
    let mode_paiement: string | null = null;
    const extras: any = {};

    try {
      // Récupérer informations selon le type d'opération
      switch (receipt.type_operation) {
        case 'location': {
          // Récupérer d'abord le paiement de location spécifique
          const { data: paymentData } = await supabase
            .from('paiements_locations')
            .select('*')
            .eq('id', receipt.reference_id)
            .single();
          
          if (paymentData) {
            mode_paiement = paymentData.mode_paiement;
            
            // Maintenant récupérer les détails de la location
            const { data: location } = await supabase
              .from('locations')
              .select(`
                loyer_mensuel, 
                dette_totale, 
                garantie_2_mois, 
                loyer_avance_2_mois, 
                frais_agence_1_mois, 
                caution_totale,
                proprietes!inner(nom, zone, adresse, types_proprietes(nom))
              `)
              .eq('id', paymentData.location_id)
              .single();

            // Historique complet des paiements pour cette location
            const { data: allLocPays } = await supabase
              .from('paiements_locations')
              .select('id, montant, date_paiement, mode_paiement, created_at')
              .eq('location_id', paymentData.location_id)
              .order('date_paiement', { ascending: true });
            
            const total_paye = (allLocPays || []).reduce((s: number, p: any) => s + Number(p.montant || 0), 0);

            // Créer l'historique des paiements
            const payment_history = (allLocPays || []).map((pay, index) => ({
              id: pay.id,
              date: pay.date_paiement,
              montant: Number(pay.montant),
              mode: pay.mode_paiement,
              label: `Paiement loyer ${index + 1}`,
              is_current: pay.id === receipt.reference_id
            }));

            const remaining_balance = location?.dette_totale ?? 0;
            Object.assign(extras, {
              details_type: 'location',
              property_name: location?.proprietes?.nom ?? null,
              property_address: location?.proprietes?.adresse ?? null,
              is_payment_complete: remaining_balance <= 0,
              remaining_balance,
              payment_history,
              loyer_mensuel: location?.loyer_mensuel ?? null,
              location_total_paye: total_paye,
              location_dette_restante: remaining_balance,
              location_avances: {
                garantie_2_mois: location?.garantie_2_mois ?? null,
                loyer_avance_2_mois: location?.loyer_avance_2_mois ?? null,
                frais_agence_1_mois: location?.frais_agence_1_mois ?? null,
                caution_totale: location?.caution_totale ?? null,
              },
            });
          }
          break;
        }

        case 'apport_souscription': {
          // Trouver la souscription liée et ses totaux
          const { data: pay } = await supabase
            .from('paiements_souscriptions')
            .select('souscription_id, mode_paiement')
            .eq('id', receipt.reference_id)
            .single();
          mode_paiement = pay?.mode_paiement ?? mode_paiement;

          const souscriptionId = pay?.souscription_id;
          if (souscriptionId) {
            const { data: sous } = await supabase
              .from('souscriptions')
              .select(`
                prix_total, 
                apport_initial, 
                solde_restant, 
                montant_mensuel,
                type_bien,
                phase_actuelle,
                proprietes!inner(nom, zone, adresse)
              `)
              .eq('id', souscriptionId)
              .single();

            // Historique complet des paiements souscription
            const { data: allPays } = await supabase
              .from('paiements_souscriptions')
              .select('id, montant, date_paiement, mode_paiement, created_at')
              .eq('souscription_id', souscriptionId)
              .order('date_paiement', { ascending: true });
            
            const total_paye = (allPays || []).reduce((s: number, p: any) => s + Number(p.montant || 0), 0);

            // Créer l'historique des paiements
            const payment_history = (allPays || []).map((pay, index) => ({
              id: pay.id,
              date: pay.date_paiement,
              montant: Number(pay.montant),
              mode: pay.mode_paiement,
              label: index === 0 ? 'Apport initial' : `Échéance ${index}`,
              is_current: pay.id === receipt.reference_id
            }));

            const remaining_balance = sous?.solde_restant ?? 0;
            Object.assign(extras, {
              details_type: 'souscription',
              property_name: sous?.proprietes?.nom ?? null,
              property_address: sous?.proprietes?.adresse ?? null,
              type_bien: sous?.type_bien ?? null,
              phase_souscription: sous?.phase_actuelle ?? null,
              is_payment_complete: remaining_balance <= 0,
              remaining_balance,
              payment_history,
              souscription_prix_total: sous?.prix_total ?? null,
              souscription_apport_initial: sous?.apport_initial ?? null,
              souscription_total_paye: total_paye,
              souscription_solde_restant: remaining_balance,
              montant_mensuel: sous?.montant_mensuel ?? null,
            });
          }
          break;
        }

        case 'droit_terre': {
          // Paiement et souscription liée
          const { data: pay } = await supabase
            .from('paiements_droit_terre')
            .select('souscription_id, mode_paiement')
            .eq('id', receipt.reference_id)
            .single();
          mode_paiement = pay?.mode_paiement ?? mode_paiement;

          const souscriptionId = pay?.souscription_id;
          if (souscriptionId) {
            const { data: sous } = await supabase
              .from('souscriptions')
              .select(`
                montant_droit_terre_mensuel,
                type_bien,
                proprietes!inner(nom, zone, adresse)
              `)
              .eq('id', souscriptionId)
              .single();

            // Historique complet des paiements droit de terre
            const { data: allPays } = await supabase
              .from('paiements_droit_terre')
              .select('id, montant, date_paiement, mode_paiement, created_at')
              .eq('souscription_id', souscriptionId)
              .order('date_paiement', { ascending: true });
            
            const total_paye = (allPays || []).reduce((s: number, p: any) => s + Number(p.montant || 0), 0);

            // Créer l'historique des paiements
            const payment_history = (allPays || []).map((pay, index) => ({
              id: pay.id,
              date: pay.date_paiement,
              montant: Number(pay.montant),
              mode: pay.mode_paiement,
              label: `Droit de terre mois ${index + 1}`,
              is_current: pay.id === receipt.reference_id
            }));

            // Échéances enregistrées (seulement celles en base)
            const { data: echeances } = await supabase
              .from('echeances_droit_terre')
              .select('numero_echeance, date_echeance, montant, statut, date_paiement')
              .eq('souscription_id', souscriptionId)
              .order('numero_echeance', { ascending: true })
              .limit(20); // Limiter pour éviter un trop grand nombre

            let solde_droit_terre: number | null = null;
            try {
              const { data: solde } = await supabase.rpc('calculate_solde_droit_terre', { souscription_uuid: souscriptionId });
              solde_droit_terre = (solde as unknown as number) ?? null;
            } catch {}

            const remaining_balance = solde_droit_terre ?? 0;
            Object.assign(extras, {
              details_type: 'droit_terre',
              property_name: sous?.proprietes?.nom ?? null,
              property_address: sous?.proprietes?.adresse ?? null,
              type_bien: sous?.type_bien ?? null,
              phase_souscription: 'droit_terre',
              is_payment_complete: remaining_balance <= 0,
              remaining_balance,
              payment_history,
              echeances: echeances?.map(e => ({
                numero: e.numero_echeance,
                date: e.date_echeance,
                montant: Number(e.montant),
                statut: e.statut,
                date_paiement: e.date_paiement
              })) ?? [],
              droit_terre_mensuel: sous?.montant_droit_terre_mensuel ?? null,
              droit_terre_total_paye: total_paye,
              droit_terre_solde_restant: remaining_balance,
            });
          }
          break;
        }

        case 'caution_location': {
          // Récupérer d'abord la transaction de caisse spécifique
          const { data: cashTransaction } = await supabase
            .from('cash_transactions')
            .select('*')
            .eq('id', receipt.reference_id)
            .single();

          if (cashTransaction?.reference_operation) {
            // Maintenant récupérer les détails de la location
            const { data: location } = await supabase
              .from('locations')
              .select(`
                caution_totale,
                garantie_2_mois,
                loyer_avance_2_mois,
                frais_agence_1_mois,
                proprietes!inner(nom, zone, adresse, types_proprietes(nom))
              `)
              .eq('id', cashTransaction.reference_operation)
              .single();

            // Historique des paiements de caution pour cette location
            const { data: cautionTransactions } = await supabase
              .from('cash_transactions')
              .select('id, montant, date_transaction, description, piece_justificative')
              .eq('type_operation', 'paiement_caution')
              .eq('reference_operation', cashTransaction.reference_operation)
              .order('date_transaction', { ascending: true });

            const total_caution_paye = (cautionTransactions || []).reduce((s: number, t: any) => s + Number(t.montant || 0), 0);
            const caution_totale = location?.caution_totale ?? 0;
            const remaining_balance = Math.max(0, caution_totale - total_caution_paye);

            // Créer l'historique des paiements de caution
            const payment_history = (cautionTransactions || []).map((trans, index) => ({
              id: trans.id,
              date: trans.date_transaction,
              montant: Number(trans.montant),
              mode: trans.piece_justificative || 'Caisse',
              label: `Versement caution ${index + 1}`,
              is_current: trans.id === receipt.reference_id
            }));

            // Mode de paiement du paiement actuel
            mode_paiement = cashTransaction.piece_justificative || 'Caisse';

            Object.assign(extras, {
              details_type: 'caution_location',
              property_name: location?.proprietes?.nom ?? null,
              property_address: location?.proprietes?.adresse ?? null,
              type_bien: location?.proprietes?.types_proprietes?.nom ?? null,
              is_payment_complete: remaining_balance <= 0,
              remaining_balance,
              payment_history,
              caution_totale,
              caution_total_paye: total_caution_paye,
              location_avances: {
                garantie_2_mois: location?.garantie_2_mois ?? null,
                loyer_avance_2_mois: location?.loyer_avance_2_mois ?? null,
                frais_agence_1_mois: location?.frais_agence_1_mois ?? null,
                caution_totale: location?.caution_totale ?? null,
              },
            });
          }
          break;
        }

        case 'paiement_facture': {
          // Récupérer d'abord le paiement de facture spécifique
          const { data: facturePayment } = await supabase
            .from('paiements_factures')
            .select('*')
            .eq('id', receipt.reference_id)
            .single();
          
          if (facturePayment) {
            mode_paiement = facturePayment.mode_paiement ?? mode_paiement;
            
            // Récupérer les détails de la facture
            const { data: facture } = await supabase
              .from('factures_fournisseurs')
              .select(`
                numero,
                montant_total,
                solde,
                date_facture,
                fournisseurs!inner(nom),
                proprietes(nom, adresse)
              `)
              .eq('id', facturePayment.facture_id)
              .single();
            
            if (facture) {
              Object.assign(extras, {
                details_type: 'facture',
                property_name: facture.proprietes?.nom ?? null,
                property_address: facture.proprietes?.adresse ?? null,
                fournisseur_name: facture.fournisseurs.nom,
                facture_numero: facture.numero,
                facture_total: facture.montant_total,
                facture_solde: facture.solde,
                facture_date: facture.date_facture,
              });
            }
          }
          break;
        }

        case 'vente': {
          // Les ventes sont toujours des paiements complets
          // Récupérer les détails depuis les métadonnées du reçu
          const meta = receipt.meta as any;
          
          Object.assign(extras, {
            details_type: 'vente',
            is_payment_complete: true, // Les ventes sont toujours complètes
            remaining_balance: 0, // Pas de solde restant pour les ventes
            article_nom: meta?.article_nom || null,
            quantite: meta?.quantite || 1,
            agent_nom: meta?.agent_nom || null,
          });
          break;
        }
      }
    } catch (error) {
      console.log('Enrichissement reçu échoué:', receipt.numero, error);
    }

    return {
      ...receipt,
      mode_paiement,
      ...extras,
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

      // Types d'opérations clients (encaissements réels)
      const clientOperations = ['location', 'caution_location', 'apport_souscription', 'droit_terre'];
      // Versements agents (dépôts en caisse)
      const agentOperations = ['versement_agent'];
      // Factures payées (dépenses)
      const invoiceOperations = ['paiement_facture'];

      const clientPaymentsThisMonth = thisMonth
        .filter(r => clientOperations.includes(r.type_operation))
        .reduce((sum, r) => sum + Number(r.montant_total), 0);

      const agentDepositsThisMonth = thisMonth
        .filter(r => agentOperations.includes(r.type_operation))
        .reduce((sum, r) => sum + Number(r.montant_total), 0);

      const invoicePaymentsThisMonth = thisMonth
        .filter(r => invoiceOperations.includes(r.type_operation))
        .reduce((sum, r) => sum + Number(r.montant_total), 0);

      const stats = {
        totalReceipts: data.length,
        clientPaymentsThisMonth,
        agentDepositsThisMonth,
        invoicePaymentsThisMonth,
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