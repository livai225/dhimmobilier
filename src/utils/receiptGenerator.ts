import { supabase } from "@/integrations/supabase/client";

export interface ReceiptData {
  clientId: string;
  referenceId: string;
  typeOperation: "caution_location" | "apport_souscription" | "droit_terre" | "paiement_facture" | "location" | "paiement_souscription";
  montantTotal: number;
  periodeDebut?: string;
  periodeFin?: string;
  datePaiement?: string;
}

export class ReceiptGenerator {
  private static generateReceiptNumber(type: string): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    const prefixes = {
      caution_location: "REC-CAUT",
      apport_souscription: "REC-SOUS", 
      droit_terre: "REC-DTER",
      paiement_facture: "REC-FACT",
      location: "REC-LOC",
      paiement_souscription: "REC-PAYS"
    };
    
    return `${prefixes[type] || "REC-GEN"}-${year}${month}${day}-${random}`;
  }

  static async createReceipt(data: ReceiptData) {
    try {
      const receiptNumber = this.generateReceiptNumber(data.typeOperation);
      
      const { data: receipt, error } = await supabase
        .from("recus")
        .insert({
          numero: receiptNumber,
          client_id: data.clientId,
          reference_id: data.referenceId,
          type_operation: data.typeOperation,
          montant_total: data.montantTotal,
          periode_debut: data.periodeDebut || null,
          periode_fin: data.periodeFin || null,
          date_generation: data.datePaiement || new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) throw error;
      
      return receipt;
    } catch (error) {
      console.error("Error creating receipt:", error);
      throw error;
    }
  }

  static generateSouscriptionPaymentReceipt(receiptData: any, souscription: any) {
    // For now, just log the receipt data
    // This method can be extended to generate a PDF or print receipt
    console.log("Reçu de paiement de souscription:", receiptData);
    console.log("Données de souscription:", souscription);
    
    // TODO: Implement PDF generation or print functionality
    return receiptData;
  }
}