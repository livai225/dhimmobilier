import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Eye, Printer } from "lucide-react";
import { ReceiptWithDetails } from "@/hooks/useReceipts";
import { downloadReceiptPDF, printReceiptPDF } from "@/utils/pdfGenerator";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ReceiptDetailsDialogProps {
  receipt: ReceiptWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptDetailsDialog({ 
  receipt, 
  open, 
  onOpenChange 
}: ReceiptDetailsDialogProps) {
  // Fetch agent details for versement_agent receipts
  const { data: agentDetails } = useQuery({
    queryKey: ["agent-for-receipt", receipt?.reference_id],
    queryFn: async () => {
      if (!receipt || receipt.type_operation !== "versement_agent") return null;
      
      const { data: transaction, error } = await supabase
        .from("cash_transactions")
        .select(`
          agent_id,
          description,
          piece_justificative,
          date_transaction,
          heure_transaction,
          agents_recouvrement (
            nom,
            prenom,
            code_agent,
            telephone,
            email
          )
        `)
        .eq("id", receipt.reference_id)
        .single();
      
      if (error) throw error;
      return transaction;
    },
    enabled: !!receipt && receipt.type_operation === "versement_agent"
  });

  if (!receipt) return null;

  const operationTypes = {
    location: { label: "Paiement de loyer", color: "bg-blue-500" },
    caution_location: { label: "Caution de location", color: "bg-green-500" },
    apport_souscription: { label: "Apport de souscription", color: "bg-purple-500" },
    droit_terre: { label: "Droit de terre", color: "bg-orange-500" },
    paiement_facture: { label: "Paiement de facture", color: "bg-red-500" },
    versement_agent: { label: "Versement agent", color: "bg-indigo-500" }
  };

  const operation = operationTypes[receipt.type_operation] || { 
    label: receipt.type_operation, 
    color: "bg-gray-500" 
  };

  const clientName = `${receipt.client?.nom || ""} ${receipt.client?.prenom || ""}`.trim();

  const handleDownload = () => {
    downloadReceiptPDF(receipt);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Détails du reçu</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => printReceiptPDF(receipt)}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header */}
          <div className="text-center border-b pb-4">
            <h2 className="text-2xl font-bold">REÇU DE PAIEMENT</h2>
            <p className="text-lg font-semibold text-primary">N° {receipt.numero}</p>
            <p className="text-sm text-muted-foreground">
              Date: {new Date(receipt.date_generation).toLocaleDateString("fr-FR")}
            </p>
          </div>

          {/* Client Info or Agent Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                {receipt.type_operation === "versement_agent" ? "Informations Agent" : "Informations Client"}
              </h3>
              <div className="space-y-1">
                {receipt.type_operation === "versement_agent" && agentDetails?.agents_recouvrement ? (
                  <>
                    <p className="font-medium">
                      {agentDetails.agents_recouvrement.prenom} {agentDetails.agents_recouvrement.nom}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Code: {agentDetails.agents_recouvrement.code_agent}
                    </p>
                    {agentDetails.agents_recouvrement.email && (
                      <p className="text-sm text-muted-foreground">{agentDetails.agents_recouvrement.email}</p>
                    )}
                    {agentDetails.agents_recouvrement.telephone && (
                      <p className="text-sm text-muted-foreground">{agentDetails.agents_recouvrement.telephone}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-medium">{clientName}</p>
                    {receipt.client?.email && (
                      <p className="text-sm text-muted-foreground">{receipt.client.email}</p>
                    )}
                    {receipt.client?.telephone_principal && (
                      <p className="text-sm text-muted-foreground">{receipt.client.telephone_principal}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                Détails de l'opération
              </h3>
              <div className="space-y-2">
                <Badge className={`${operation.color} text-white`}>
                  {operation.label}
                </Badge>
                {receipt.mode_paiement && (
                  <div>
                    <p className="text-sm font-medium">Mode de paiement:</p>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                      {receipt.mode_paiement === 'especes' || receipt.mode_paiement === 'espece' ? 'Espèces' :
                       receipt.mode_paiement === 'cheque' ? 'Chèque' :
                       receipt.mode_paiement === 'virement' ? 'Virement' :
                       receipt.mode_paiement === 'mobile_money' ? 'Mobile Money' :
                       receipt.mode_paiement === 'carte' ? 'Carte bancaire' :
                       receipt.mode_paiement}
                    </span>
                  </div>
                )}
                 {receipt.periode_debut && (
                   <div>
                     <p className="text-sm font-medium">Période:</p>
                     <p className="text-sm text-muted-foreground">
                       {new Date(receipt.periode_debut).toLocaleDateString("fr-FR")}
                       {receipt.periode_fin && 
                         ` au ${new Date(receipt.periode_fin).toLocaleDateString("fr-FR")}`
                       }
                     </p>
                   </div>
                 )}
                 {receipt.type_operation === "versement_agent" && agentDetails && (
                   <>
                     <div>
                       <p className="text-sm font-medium">Date et heure:</p>
                       <p className="text-sm text-muted-foreground">
                         {new Date(agentDetails.date_transaction).toLocaleDateString("fr-FR")} à {agentDetails.heure_transaction?.slice(0, 5)}
                       </p>
                     </div>
                     {agentDetails.description && (
                       <div>
                         <p className="text-sm font-medium">Description:</p>
                         <p className="text-sm text-muted-foreground">{agentDetails.description}</p>
                       </div>
                     )}
                     {agentDetails.piece_justificative && (
                       <div>
                         <p className="text-sm font-medium">Pièce justificative:</p>
                         <p className="text-sm text-primary cursor-pointer hover:underline">
                           Document disponible
                         </p>
                       </div>
                     )}
                   </>
                 )}
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="bg-muted p-4 rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-1">MONTANT TOTAL</p>
            <p className="text-3xl font-bold text-primary">
              {receipt.montant_total.toLocaleString("fr-FR")} FCFA
            </p>
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground border-t pt-4">
            <p>Ce reçu fait foi de paiement.</p>
            <p>Merci pour votre confiance.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}