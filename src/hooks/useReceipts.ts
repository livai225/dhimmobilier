import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";

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
      // Récupérer toutes les données nécessaires en parallèle
      const [
        recusData,
        clientsData,
        paiementsLocationsData,
        locationsData,
        proprietesData,
        paiementsSouscriptionsData,
        souscriptionsData,
        paiementsDroitTerreData,
        cashTransactionsData,
        facturesData,
        paiementsFacturesData,
        fournisseursData
      ] = await Promise.all([
        apiClient.select({ table: "recus", orderBy: { column: "date_generation", ascending: false } }),
        apiClient.select({ table: "clients" }),
        apiClient.select({ table: "paiements_locations" }),
        apiClient.select({ table: "locations" }),
        apiClient.select({ table: "proprietes" }),
        apiClient.select({ table: "paiements_souscriptions" }),
        apiClient.select({ table: "souscriptions" }),
        apiClient.select({ table: "paiements_droit_terre" }),
        apiClient.select({ table: "cash_transactions" }),
        apiClient.select({ table: "factures_fournisseurs" }),
        apiClient.select({ table: "paiements_factures" }),
        apiClient.select({ table: "fournisseurs" })
      ]);

      // Filtrer les reçus selon les filtres
      let data = recusData || [];

      if (filters?.type_operation && filters.type_operation !== "all") {
        data = data.filter((r: any) => r.type_operation === filters.type_operation);
      }

      if (filters?.client_id && filters.client_id !== "all") {
        data = data.filter((r: any) => r.client_id === filters.client_id);
      }

      if (filters?.date_from) {
        data = data.filter((r: any) => r.date_generation >= filters.date_from);
      }

      if (filters?.date_to) {
        data = data.filter((r: any) => r.date_generation <= filters.date_to);
      }

      // Enrichir les reçus avec le mode de paiement et les détails de contexte
      const enrichedReceipts = data.map((receipt: any) => {
        let mode_paiement: string | null = null;
        const extras: any = {};

        // Joindre le client
        const client = clientsData.find((c: any) => c.id === receipt.client_id);

        try {
          // Récupérer informations selon le type d'opération
          switch (receipt.type_operation) {
            case 'location': {
              const paymentData = paiementsLocationsData.find((p: any) => p.id === receipt.reference_id);

              if (paymentData) {
                mode_paiement = paymentData.mode_paiement;

                const location = locationsData.find((l: any) => l.id === paymentData.location_id);
                const propriete = location ? proprietesData.find((p: any) => p.id === location.propriete_id) : null;

                // Historique complet des paiements pour cette location
                const allLocPays = paiementsLocationsData
                  .filter((p: any) => p.location_id === paymentData.location_id)
                  .sort((a: any, b: any) => new Date(a.date_paiement).getTime() - new Date(b.date_paiement).getTime());

                const total_paye = allLocPays.reduce((s: number, p: any) => s + Number(p.montant || 0), 0);

                // Créer l'historique des paiements
                const payment_history = allLocPays.map((pay: any, index: number) => ({
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
                  property_name: propriete?.nom ?? null,
                  property_address: propriete?.adresse ?? null,
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
              const pay = paiementsSouscriptionsData.find((p: any) => p.id === receipt.reference_id);
              mode_paiement = pay?.mode_paiement ?? mode_paiement;

              const souscriptionId = pay?.souscription_id;
              if (souscriptionId) {
                const sous = souscriptionsData.find((s: any) => s.id === souscriptionId);
                const propriete = sous ? proprietesData.find((p: any) => p.id === sous.propriete_id) : null;

                // Historique complet des paiements souscription
                const allPays = paiementsSouscriptionsData
                  .filter((p: any) => p.souscription_id === souscriptionId)
                  .sort((a: any, b: any) => new Date(a.date_paiement).getTime() - new Date(b.date_paiement).getTime());

                const total_paye = allPays.reduce((s: number, p: any) => s + Number(p.montant || 0), 0);

                // Créer l'historique des paiements
                const payment_history = allPays.map((pay: any, index: number) => ({
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
                  property_name: propriete?.nom ?? null,
                  property_address: propriete?.adresse ?? null,
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
              const pay = paiementsDroitTerreData.find((p: any) => p.id === receipt.reference_id);
              mode_paiement = pay?.mode_paiement ?? mode_paiement;

              const souscriptionId = pay?.souscription_id;
              if (souscriptionId) {
                const sous = souscriptionsData.find((s: any) => s.id === souscriptionId);
                const propriete = sous ? proprietesData.find((p: any) => p.id === sous.propriete_id) : null;

                // Historique complet des paiements droit de terre
                const allPays = paiementsDroitTerreData
                  .filter((p: any) => p.souscription_id === souscriptionId)
                  .sort((a: any, b: any) => new Date(a.date_paiement).getTime() - new Date(b.date_paiement).getTime());

                const total_paye = allPays.reduce((s: number, p: any) => s + Number(p.montant || 0), 0);

                // Créer l'historique des paiements
                const payment_history = allPays.map((pay: any, index: number) => ({
                  id: pay.id,
                  date: pay.date_paiement,
                  montant: Number(pay.montant),
                  mode: pay.mode_paiement,
                  label: `Droit de terre mois ${index + 1}`,
                  is_current: pay.id === receipt.reference_id
                }));

                const droitTerreMensuel = sous?.montant_droit_terre_mensuel ?? 0;
                const paiementActuel = Number(receipt.montant_total || 0);
                const isComplete = droitTerreMensuel > 0 ? paiementActuel >= droitTerreMensuel : true;
                const remaining = droitTerreMensuel > 0 ? Math.max(0, droitTerreMensuel - paiementActuel) : 0;

                Object.assign(extras, {
                  details_type: 'droit_terre',
                  property_name: propriete?.nom ?? null,
                  property_address: propriete?.adresse ?? null,
                  type_bien: sous?.type_bien ?? null,
                  phase_souscription: 'droit_terre',
                  is_payment_complete: isComplete,
                  remaining_balance: remaining,
                  payment_history,
                  droit_terre_mensuel: droitTerreMensuel || null,
                  droit_terre_total_paye: total_paye,
                  droit_terre_solde_restant: remaining,
                });
              }
              break;
            }

            case 'caution_location': {
              const cashTransaction = cashTransactionsData.find((t: any) => t.id === receipt.reference_id);

              if (cashTransaction?.reference_operation) {
                const location = locationsData.find((l: any) => l.id === cashTransaction.reference_operation);
                const propriete = location ? proprietesData.find((p: any) => p.id === location.propriete_id) : null;

                // Historique des paiements de caution pour cette location
                const cautionTransactions = cashTransactionsData
                  .filter((t: any) => t.type_operation === 'paiement_caution' && t.reference_operation === cashTransaction.reference_operation)
                  .sort((a: any, b: any) => new Date(a.date_transaction).getTime() - new Date(b.date_transaction).getTime());

                const total_caution_paye = cautionTransactions.reduce((s: number, t: any) => s + Number(t.montant || 0), 0);
                const caution_totale = location?.caution_totale ?? 0;
                const remaining_balance = Math.max(0, caution_totale - total_caution_paye);

                // Créer l'historique des paiements de caution
                const payment_history = cautionTransactions.map((trans: any, index: number) => ({
                  id: trans.id,
                  date: trans.date_transaction,
                  montant: Number(trans.montant),
                  mode: trans.piece_justificative || 'Caisse',
                  label: `Versement caution ${index + 1}`,
                  is_current: trans.id === receipt.reference_id
                }));

                mode_paiement = cashTransaction.piece_justificative || 'Caisse';

                Object.assign(extras, {
                  details_type: 'caution_location',
                  property_name: propriete?.nom ?? null,
                  property_address: propriete?.adresse ?? null,
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
              const facturePayment = paiementsFacturesData.find((p: any) => p.id === receipt.reference_id);

              if (facturePayment) {
                mode_paiement = facturePayment.mode_paiement ?? mode_paiement;

                const facture = facturesData.find((f: any) => f.id === facturePayment.facture_id);
                const fournisseur = facture ? fournisseursData.find((f: any) => f.id === facture.fournisseur_id) : null;
                const propriete = facture?.propriete_id ? proprietesData.find((p: any) => p.id === facture.propriete_id) : null;

                if (facture) {
                  Object.assign(extras, {
                    details_type: 'facture',
                    property_name: propriete?.nom ?? null,
                    property_address: propriete?.adresse ?? null,
                    fournisseur_name: fournisseur?.nom ?? null,
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
              Object.assign(extras, {
                details_type: 'vente',
                is_payment_complete: true,
                remaining_balance: 0,
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
          client: client ? {
            nom: client.nom,
            prenom: client.prenom,
            email: client.email,
            telephone_principal: client.telephone_principal
          } : null,
          ...extras,
        } as ReceiptWithDetails;
      });

      let results = enrichedReceipts;

      // Filtrage supplémentaire côté client pour la recherche par nom de client
      if (filters?.search) {
        const s = filters.search.toLowerCase();
        results = results.filter((r: ReceiptWithDetails) =>
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
      const data = await apiClient.select({ table: "recus" });

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const thisMonth = data.filter((r: any) => {
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
        .filter((r: any) => clientOperations.includes(r.type_operation))
        .reduce((sum: number, r: any) => sum + Number(r.montant_total), 0);

      const agentDepositsThisMonth = thisMonth
        .filter((r: any) => agentOperations.includes(r.type_operation))
        .reduce((sum: number, r: any) => sum + Number(r.montant_total), 0);

      const invoicePaymentsThisMonth = thisMonth
        .filter((r: any) => invoiceOperations.includes(r.type_operation))
        .reduce((sum: number, r: any) => sum + Number(r.montant_total), 0);

      const stats = {
        totalReceipts: data.length,
        clientPaymentsThisMonth,
        agentDepositsThisMonth,
        invoicePaymentsThisMonth,
        receiptsByType: data.reduce((acc: Record<string, number>, r: any) => {
          acc[r.type_operation] = (acc[r.type_operation] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        lastReceipt: data.sort((a: any, b: any) =>
          new Date(b.date_generation).getTime() - new Date(a.date_generation).getTime()
        )[0]
      };

      return stats;
    },
  });
};
