import { apiClient } from "@/integrations/api/client";
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
      const locationPayments = await apiClient.select<any[]>({
        table: "paiements_locations"
      });

      if (locationPayments) {
        for (const payment of locationPayments) {
          // Récupérer la location séparément
          const location = await apiClient.select<any>({
            table: "locations",
            filters: [{ op: "eq", column: "id", value: payment.location_id }],
            single: true
          });

          const existingReceipts = await apiClient.select<any[]>({
            table: "recus",
            filters: [
              { op: "eq", column: "reference_id", value: payment.location_id },
              { op: "eq", column: "type_operation", value: "location" },
              { op: "eq", column: "montant_total", value: payment.montant },
              { op: "eq", column: "date_generation", value: payment.date_paiement }
            ]
          });

          if ((!existingReceipts || existingReceipts.length === 0) && location) {
            missingReceipts.push({
              id: payment.id,
              type: 'location',
              amount: payment.montant,
              date: payment.date_paiement,
              clientId: location.client_id,
              referenceId: payment.location_id,
              details: payment
            });
          }
        }
      }

      // 2. Vérifier les paiements de souscription
      const subscriptionPayments = await apiClient.select<any[]>({
        table: "paiements_souscriptions"
      });

      if (subscriptionPayments) {
        for (const payment of subscriptionPayments) {
          // Récupérer la souscription séparément
          const souscription = await apiClient.select<any>({
            table: "souscriptions",
            filters: [{ op: "eq", column: "id", value: payment.souscription_id }],
            single: true
          });

          const existingReceipts = await apiClient.select<any[]>({
            table: "recus",
            filters: [
              { op: "eq", column: "reference_id", value: payment.souscription_id },
              { op: "eq", column: "type_operation", value: "apport_souscription" },
              { op: "eq", column: "montant_total", value: payment.montant },
              { op: "eq", column: "date_generation", value: payment.date_paiement }
            ]
          });

          if ((!existingReceipts || existingReceipts.length === 0) && souscription) {
            missingReceipts.push({
              id: payment.id,
              type: 'souscription',
              amount: payment.montant,
              date: payment.date_paiement,
              clientId: souscription.client_id,
              referenceId: payment.souscription_id,
              details: payment
            });
          }
        }
      }

      // 3. Vérifier les paiements de factures
      const invoicePayments = await apiClient.select<any[]>({
        table: "paiements_factures"
      });

      if (invoicePayments) {
        for (const payment of invoicePayments) {
          const existingReceipts = await apiClient.select<any[]>({
            table: "recus",
            filters: [
              { op: "eq", column: "reference_id", value: payment.id },
              { op: "eq", column: "type_operation", value: "paiement_facture" },
              { op: "eq", column: "montant_total", value: payment.montant },
              { op: "eq", column: "date_generation", value: payment.date_paiement }
            ]
          });

          if (!existingReceipts || existingReceipts.length === 0) {
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
      const landRightsPayments = await apiClient.select<any[]>({
        table: "echeances_droit_terre",
        filters: [{ op: "eq", column: "statut", value: "paye" }]
      });

      if (landRightsPayments) {
        for (const payment of landRightsPayments) {
          if (payment.date_paiement && payment.montant_paye) {
            // Récupérer les informations de souscription séparément
            const souscription = await apiClient.select<any>({
              table: "souscriptions",
              filters: [{ op: "eq", column: "id", value: payment.souscription_id }],
              single: true
            });

            const existingReceipts = await apiClient.select<any[]>({
              table: "recus",
              filters: [
                { op: "eq", column: "reference_id", value: payment.souscription_id },
                { op: "eq", column: "type_operation", value: "droit_terre" },
                { op: "eq", column: "montant_total", value: payment.montant_paye },
                { op: "eq", column: "date_generation", value: payment.date_paiement }
              ]
            });

            if ((!existingReceipts || existingReceipts.length === 0) && souscription) {
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
            const factureData = await apiClient.select<any>({
              table: "factures_fournisseurs",
              filters: [{ op: "eq", column: "id", value: missing.details.facture_id }],
              single: true
            });

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
      const payment = await apiClient.select<any>({
        table: "paiements_factures",
        filters: [{ op: "eq", column: "id", value: paymentId }],
        single: true
      });

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