import { supabase } from "@/integrations/supabase/client";
import { ReceiptGenerator } from "./receiptGenerator";

export interface MissingReceipt {
  id: string;
  type: 'location' | 'souscription' | 'facture' | 'droit_terre';
  amount: number;
  date: string;
  clientId?: string;
  referenceId: string;
  details: any;
}

export class ReceiptIntegrityChecker {
  
  /**
   * Vérifie l'intégrité du système de reçus et trouve les paiements sans reçus
   */
  static async checkMissingReceipts(): Promise<MissingReceipt[]> {
    const missingReceipts: MissingReceipt[] = [];

    try {
      // 1. Vérifier les paiements de location
      const { data: locationPayments } = await supabase
        .from("paiements_locations")
        .select(`
          *,
          location:locations(id, client_id)
        `);

      if (locationPayments) {
        for (const payment of locationPayments) {
          const { data: existingReceipt } = await supabase
            .from("recus")
            .select("id")
            .eq("reference_id", payment.location_id)
            .eq("type_operation", "location")
            .eq("montant_total", payment.montant)
            .eq("date_generation", payment.date_paiement)
            .maybeSingle();

          if (!existingReceipt && payment.location) {
            missingReceipts.push({
              id: payment.id,
              type: 'location',
              amount: payment.montant,
              date: payment.date_paiement,
              clientId: payment.location.client_id,
              referenceId: payment.location_id,
              details: payment
            });
          }
        }
      }

      // 2. Vérifier les paiements de souscription
      const { data: subscriptionPayments } = await supabase
        .from("paiements_souscriptions")
        .select(`
          *,
          souscription:souscriptions(id, client_id)
        `);

      if (subscriptionPayments) {
        for (const payment of subscriptionPayments) {
          const { data: existingReceipt } = await supabase
            .from("recus")
            .select("id")
            .eq("reference_id", payment.souscription_id)
            .eq("type_operation", "apport_souscription")
            .eq("montant_total", payment.montant)
            .eq("date_generation", payment.date_paiement)
            .maybeSingle();

          if (!existingReceipt && payment.souscription) {
            missingReceipts.push({
              id: payment.id,
              type: 'souscription',
              amount: payment.montant,
              date: payment.date_paiement,
              clientId: payment.souscription.client_id,
              referenceId: payment.souscription_id,
              details: payment
            });
          }
        }
      }

      // 3. Vérifier les paiements de factures
      const { data: invoicePayments } = await supabase
        .from("paiements_factures")
        .select(`
          *,
          facture:factures_fournisseurs(
            id,
            fournisseur:fournisseurs(nom)
          )
        `);

      if (invoicePayments) {
        for (const payment of invoicePayments) {
          const { data: existingReceipt } = await supabase
            .from("recus")
            .select("id")
            .eq("reference_id", payment.id)
            .eq("type_operation", "paiement_facture")
            .eq("montant_total", payment.montant)
            .eq("date_generation", payment.date_paiement)
            .maybeSingle();

          if (!existingReceipt) {
            missingReceipts.push({
              id: payment.id,
              type: 'facture',
              amount: payment.montant,
              date: payment.date_paiement,
              clientId: "supplier", // Les factures sont liées aux fournisseurs, pas aux clients
              referenceId: payment.id,
              details: payment
            });
          }
        }
      }

      // 4. Vérifier les paiements de droit de terre
      const { data: landRightsPayments } = await supabase
        .from("echeances_droit_terre")
        .select("*")
        .eq("statut", "paye");

      if (landRightsPayments) {
        for (const payment of landRightsPayments) {
          if (payment.date_paiement && payment.montant_paye) {
            // Récupérer les informations de souscription séparément
            const { data: souscription } = await supabase
              .from("souscriptions")
              .select("id, client_id")
              .eq("id", payment.souscription_id)
              .single();

            const { data: existingReceipt } = await supabase
              .from("recus")
              .select("id")
              .eq("reference_id", payment.souscription_id)
              .eq("type_operation", "droit_terre")
              .eq("montant_total", payment.montant_paye)
              .eq("date_generation", payment.date_paiement)
              .maybeSingle();

            if (!existingReceipt && souscription) {
              missingReceipts.push({
                id: payment.id,
                type: 'droit_terre',
                amount: payment.montant_paye,
                date: payment.date_paiement,
                clientId: souscription.client_id,
                referenceId: payment.souscription_id,
                details: payment
              });
            }
          }
        }
      }

      return missingReceipts;
    } catch (error) {
      console.error("Error checking missing receipts:", error);
      throw error;
    }
  }

  /**
   * Génère les reçus manquants pour tous les paiements sans reçus
   */
  static async generateMissingReceipts(): Promise<{
    success: number;
    errors: Array<{ payment: MissingReceipt; error: string }>;
  }> {
    const missingReceipts = await this.checkMissingReceipts();
    const results = { success: 0, errors: [] as Array<{ payment: MissingReceipt; error: string }> };

    for (const missing of missingReceipts) {
      try {
        let typeOperation: any;
        let clientId = missing.clientId;

        switch (missing.type) {
          case 'location':
            typeOperation = 'location';
            break;
          case 'souscription':
            typeOperation = 'apport_souscription';
            break;
          case 'facture':
            typeOperation = 'paiement_facture';
            // Pour les factures, nous devons trouver le client via la facture
            const { data: factureData } = await supabase
              .from("factures_fournisseurs")
              .select("id")
              .eq("id", missing.details.facture_id)
              .single();
            
            if (factureData) {
              // Utiliser un client par défaut ou créer une logique pour associer les factures aux clients
              clientId = "00000000-0000-0000-0000-000000000000"; // UUID par défaut
            }
            break;
          case 'droit_terre':
            typeOperation = 'droit_terre';
            break;
        }

        if (clientId && clientId !== "supplier") {
          await ReceiptGenerator.createReceipt({
            clientId,
            referenceId: missing.referenceId,
            typeOperation,
            montantTotal: missing.amount,
            datePaiement: missing.date
          });

          results.success++;
        } else {
          results.errors.push({
            payment: missing,
            error: "Client ID manquant ou invalide"
          });
        }
      } catch (error) {
        results.errors.push({
          payment: missing,
          error: error instanceof Error ? error.message : "Erreur inconnue"
        });
      }
    }

    return results;
  }

  /**
   * Génère un reçu pour un paiement de facture spécifique
   * (Les factures nécessitent une logique spéciale car elles sont liées aux fournisseurs)
   */
  static async generateInvoiceReceipt(paymentId: string, clientId: string): Promise<void> {
    try {
      const { data: payment } = await supabase
        .from("paiements_factures")
        .select(`
          *,
          facture:factures_fournisseurs(
            numero,
            fournisseur:fournisseurs(nom)
          )
        `)
        .eq("id", paymentId)
        .single();

      if (!payment) {
        throw new Error("Paiement de facture non trouvé");
      }

      await ReceiptGenerator.createReceipt({
        clientId,
        referenceId: paymentId, // Pour les factures, reference_id = payment_id
        typeOperation: "paiement_facture",
        montantTotal: payment.montant,
        datePaiement: payment.date_paiement
      });
    } catch (error) {
      console.error("Error generating invoice receipt:", error);
      throw error;
    }
  }
}