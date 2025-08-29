import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, Download, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referenceId: string | null;
  typeOperation: string;
}

export function ReceiptDialog({ open, onOpenChange, referenceId, typeOperation }: ReceiptDialogProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const { data: receipt, isLoading } = useQuery({
    queryKey: ["receipt", referenceId, typeOperation],
    queryFn: async () => {
      if (!referenceId) return null;
      
      const { data, error } = await supabase
        .from("recus")
        .select(`
          *,
          clients(nom, prenom, telephone_principal, adresse)
        `)
        .eq("reference_id", referenceId)
        .eq("type_operation", typeOperation)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!referenceId && open,
  });

  const handlePrint = () => {
    setIsPrinting(true);
    const printContent = document.getElementById('receipt-content');
    if (printContent) {
      const originalContent = document.body.innerHTML;
      document.body.innerHTML = printContent.innerHTML;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload();
    }
    setIsPrinting(false);
  };

  const handleDownload = () => {
    // Utiliser html2canvas pour créer une image du reçu
    import('html2canvas').then((html2canvas) => {
      const element = document.getElementById('receipt-content');
      if (element) {
        html2canvas.default(element).then((canvas) => {
          const link = document.createElement('a');
          link.download = `recu_${receipt?.numero}.png`;
          link.href = canvas.toDataURL();
          link.click();
        });
      }
    });
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex justify-center items-center h-64">
            Chargement du reçu...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!receipt) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reçu introuvable</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Aucun reçu trouvé pour cette opération.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Reçu N° {receipt.numero}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div id="receipt-content" className="bg-white text-black p-8 space-y-6">
          {/* En-tête */}
          <div className="text-center border-b pb-6">
            <h1 className="text-2xl font-bold text-blue-600 mb-2">REÇU DE PAIEMENT</h1>
            <div className="text-lg font-semibold">N° {receipt.numero}</div>
            <div className="text-sm text-gray-600">
              Date d'émission: {format(new Date(receipt.date_generation), "dd MMMM yyyy", { locale: fr })}
            </div>
          </div>

          {/* Informations client */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informations Client</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">Nom:</span> {receipt.clients?.prenom} {receipt.clients?.nom}
                  </div>
                  <div>
                    <span className="font-medium">Téléphone:</span> {receipt.clients?.telephone_principal}
                  </div>
                  {receipt.clients?.adresse && (
                    <div>
                      <span className="font-medium">Adresse:</span> {receipt.clients?.adresse}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Détails du Paiement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium">Type d'opération:</span> 
                    <span className="ml-2 capitalize">
                      {typeOperation.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Montant:</span> 
                    <span className="ml-2 text-xl font-bold text-green-600">
                      {receipt.montant_total?.toLocaleString()} FCFA
                    </span>
                  </div>
                  {receipt.periode_debut && (
                    <div>
                      <span className="font-medium">Période:</span> 
                      <span className="ml-2">
                        {format(new Date(receipt.periode_debut), "dd MMMM yyyy", { locale: fr })}
                        {receipt.periode_fin && (
                          <> au {format(new Date(receipt.periode_fin), "dd MMMM yyyy", { locale: fr })}</>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Montant en toutes lettres */}
          <div className="border-t pt-6">
            <div className="text-center">
              <p className="text-lg">
                <span className="font-medium">Arrêté le présent reçu à la somme de:</span>
              </p>
              <div className="text-xl font-bold text-blue-600 mt-2 p-3 border-2 border-blue-200 rounded-lg">
                {receipt.montant_total?.toLocaleString()} FRANCS CFA
              </div>
            </div>
          </div>

          {/* Signature */}
          <div className="flex justify-between items-end pt-8 border-t">
            <div className="text-center">
              <div className="mb-16"></div>
              <div className="border-t border-gray-400 pt-2">
                <p className="font-medium">Signature du Client</p>
              </div>
            </div>
            <div className="text-center">
              <div className="mb-16"></div>
              <div className="border-t border-gray-400 pt-2">
                <p className="font-medium">Cachet et Signature</p>
                <p className="text-sm text-gray-600">de l'Établissement</p>
              </div>
            </div>
          </div>

          {/* Pied de page */}
          <div className="text-center text-xs text-gray-500 pt-6 border-t">
            <p>Ce reçu fait foi de paiement - Document généré automatiquement</p>
            <p>Date de génération: {format(new Date(), "dd/MM/yyyy 'à' HH:mm")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}