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

            {/* Propriété concernée */}
            {receipt.property_name && receipt.type_operation !== "versement_agent" && (
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                  Propriété concernée
                </h3>
                <div className="space-y-1">
                  <p className="font-medium text-primary">{receipt.property_name}</p>
                  {receipt.property_address && (
                    <p className="text-sm text-muted-foreground">{receipt.property_address}</p>
                  )}
                  {receipt.type_bien && (
                    <p className="text-sm text-muted-foreground">Type: {receipt.type_bien}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Context and Financial Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                Contexte de l'opération
              </h3>
              <div className="space-y-2">
                <Badge className={`${operation.color} text-white`}>
                  {operation.label}
                  {receipt.property_name && ` - ${receipt.property_name}`}
                </Badge>
                {receipt.type_bien && (
                  <div>
                    <p className="text-sm font-medium">Type de bien:</p>
                    <p className="text-sm text-muted-foreground">{receipt.type_bien}</p>
                  </div>
                )}
                {receipt.phase_souscription && receipt.phase_souscription !== 'souscription' && (
                  <div>
                    <p className="text-sm font-medium">Phase:</p>
                    <p className="text-sm text-muted-foreground capitalize">{receipt.phase_souscription}</p>
                  </div>
                )}
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
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                Récapitulatif financier
              </h3>
              <div className="space-y-2">
                {/* Statut du paiement */}
                {receipt.type_operation !== 'versement_agent' && (
                  <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50 border-l-4 border-l-primary">
                    <span className="text-sm font-medium">Statut du paiement:</span>
                    <Badge 
                      variant={receipt.is_payment_complete ? "default" : "secondary"}
                      className={receipt.is_payment_complete ? "bg-green-500 text-white" : "bg-orange-500 text-white"}
                    >
                      {receipt.is_payment_complete ? "COMPLET" : "PARTIEL"}
                    </Badge>
                  </div>
                )}

                {receipt.type_operation === 'apport_souscription' && (
                  <>
                    {receipt.souscription_prix_total && (
                      <div className="flex justify-between text-sm">
                        <span>Prix total:</span>
                        <span className="font-medium">{receipt.souscription_prix_total.toLocaleString("fr-FR")} FCFA</span>
                      </div>
                    )}
                    {receipt.souscription_total_paye && (
                      <div className="flex justify-between text-sm">
                        <span>Déjà payé:</span>
                        <span className="font-medium">{receipt.souscription_total_paye.toLocaleString("fr-FR")} FCFA</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>Ce paiement:</span>
                      <span className="font-medium text-primary">{receipt.montant_total.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                    {(receipt.remaining_balance !== undefined && receipt.remaining_balance !== null) && (
                      <div className={`flex justify-between text-sm border-t pt-2 ${receipt.is_payment_complete ? 'text-green-600' : 'text-orange-600'}`}>
                        <span className="font-medium">Solde restant:</span>
                        <span className="font-bold">{receipt.remaining_balance.toLocaleString("fr-FR")} FCFA</span>
                      </div>
                    )}
                  </>
                )}
                {receipt.type_operation === 'location' && (
                  <>
                    {receipt.loyer_mensuel && (
                      <div className="flex justify-between text-sm">
                        <span>Loyer mensuel:</span>
                        <span className="font-medium">{receipt.loyer_mensuel.toLocaleString("fr-FR")} FCFA</span>
                      </div>
                    )}
                    {receipt.location_total_paye && (
                      <div className="flex justify-between text-sm">
                        <span>Déjà payé:</span>
                        <span className="font-medium">{receipt.location_total_paye.toLocaleString("fr-FR")} FCFA</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>Ce paiement:</span>
                      <span className="font-medium text-primary">{receipt.montant_total.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                    {(receipt.remaining_balance !== undefined && receipt.remaining_balance !== null) && (
                      <div className={`flex justify-between text-sm border-t pt-2 ${receipt.is_payment_complete ? 'text-green-600' : 'text-orange-600'}`}>
                        <span className="font-medium">Dette restante:</span>
                        <span className="font-bold">{receipt.remaining_balance.toLocaleString("fr-FR")} FCFA</span>
                      </div>
                    )}
                  </>
                )}
                {receipt.type_operation === 'droit_terre' && (
                  <>
                    {receipt.droit_terre_mensuel && (
                      <div className="flex justify-between text-sm">
                        <span>Montant prévu/mois:</span>
                        <span className="font-medium">{receipt.droit_terre_mensuel.toLocaleString("fr-FR")} FCFA</span>
                      </div>
                    )}
                    {receipt.droit_terre_total_paye && (
                      <div className="flex justify-between text-sm">
                        <span>Total déjà payé:</span>
                        <span className="font-medium">{receipt.droit_terre_total_paye.toLocaleString("fr-FR")} FCFA</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>Montant de ce versement:</span>
                      <span className="font-medium text-primary">{receipt.montant_total.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                    {(receipt.remaining_balance !== undefined && receipt.remaining_balance !== null) && (
                      <div className={`flex justify-between text-sm border-t pt-2 ${receipt.is_payment_complete ? 'text-green-600' : 'text-orange-600'}`}>
                        <span className="font-medium">Solde droit de terre restant:</span>
                        <span className="font-bold">{receipt.remaining_balance.toLocaleString("fr-FR")} FCFA</span>
                      </div>
                    )}
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                      <div className="font-medium mb-1">ℹ️ Information:</div>
                      <div>Les droits de terre peuvent être payés librement, pas forcément chaque mois. Le montant affiché correspond au montant de référence mensuel.</div>
                    </div>
                  </>
                )}
                {receipt.type_operation === 'caution_location' && (
                  <>
                    {(receipt as any).caution_totale && (
                      <div className="flex justify-between text-sm">
                        <span>Caution totale requise:</span>
                        <span className="font-medium">{(receipt as any).caution_totale.toLocaleString("fr-FR")} FCFA</span>
                      </div>
                    )}
                    {(receipt as any).caution_total_paye && (
                      <div className="flex justify-between text-sm">
                        <span>Déjà payé:</span>
                        <span className="font-medium">{(receipt as any).caution_total_paye.toLocaleString("fr-FR")} FCFA</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>Ce paiement:</span>
                      <span className="font-medium text-primary">{receipt.montant_total.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                    {(receipt.remaining_balance !== undefined && receipt.remaining_balance !== null) && (
                      <div className={`flex justify-between text-sm border-t pt-2 ${receipt.is_payment_complete ? 'text-green-600' : 'text-orange-600'}`}>
                        <span className="font-medium">Solde caution restant:</span>
                        <span className="font-bold">{receipt.remaining_balance.toLocaleString("fr-FR")} FCFA</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Payment History */}
          {receipt.payment_history && receipt.payment_history.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                Historique des paiements
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {receipt.payment_history.slice(0, 10).map((payment, index) => (
                  <div key={payment.id} className={`flex items-center justify-between text-sm p-2 rounded ${
                    payment.is_current ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {new Date(payment.date).toLocaleDateString("fr-FR")}
                      </span>
                      {payment.mode && (
                        <span className="text-xs text-muted-foreground">({payment.mode})</span>
                      )}
                      {payment.is_current && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                          ce paiement
                        </span>
                      )}
                    </div>
                    <span className="font-medium">
                      {payment.montant.toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>
                ))}
                {receipt.payment_history.length > 10 && (
                  <div className="text-center text-sm text-muted-foreground">
                    + {receipt.payment_history.length - 10} autres paiements
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Échéances for droit de terre */}
          {receipt.type_operation === 'droit_terre' && receipt.echeances && receipt.echeances.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                Échéances enregistrées
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {receipt.echeances.slice(0, 8).map((echeance) => (
                  <div key={echeance.numero} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Éch. {echeance.numero}</span>
                      <span className="text-muted-foreground">
                        {new Date(echeance.date).toLocaleDateString("fr-FR")}
                      </span>
                      {echeance.statut === 'paye' && (
                        <span className="text-green-600 text-xs">✓ Payée</span>
                      )}
                    </div>
                    <span className="font-medium">
                      {echeance.montant.toLocaleString("fr-FR")} FCFA
                    </span>
                  </div>
                ))}
                {receipt.echeances.length > 8 && (
                  <div className="text-center text-sm text-muted-foreground">
                    + {receipt.echeances.length - 8} autres échéances
                  </div>
                )}
              </div>
            </div>
          )}

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