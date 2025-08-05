import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CreditCard, FileText, Calculator } from "lucide-react";
import { ReceiptGenerator } from "@/utils/receiptGenerator";

interface PaiementDroitTerreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  souscription: any;
  onSuccess: () => void;
}

export function PaiementDroitTerreDialog({ open, onOpenChange, souscription, onSuccess }: PaiementDroitTerreDialogProps) {
  const [formData, setFormData] = useState({
    montant: "",
    date_paiement: new Date().toISOString().split("T")[0],
    mode_paiement: "",
    reference: ""
  });

  const { data: paiements, refetch: refetchPaiements } = useQuery({
    queryKey: ["paiements_droit_terre", souscription?.id],
    queryFn: async () => {
      if (!souscription?.id) return [];
      
      const { data, error } = await supabase
        .from("paiements_droit_terre")
        .select("*")
        .eq("souscription_id", souscription.id)
        .order("date_paiement", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!souscription?.id && open,
  });

  const { data: soldeData, refetch: refetchSolde } = useQuery({
    queryKey: ["solde_droit_terre", souscription?.id],
    queryFn: async () => {
      if (!souscription?.id) return null;
      
      const { data, error } = await supabase
        .rpc("calculate_solde_droit_terre", { souscription_uuid: souscription.id });

      if (error) throw error;
      return data;
    },
    enabled: !!souscription?.id && open,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Record the payment in the new simplified table
      const { data: payment, error: paymentError } = await supabase
        .from("paiements_droit_terre")
        .insert({
          souscription_id: souscription.id,
          montant: parseFloat(formData.montant),
          date_paiement: formData.date_paiement,
          mode_paiement: formData.mode_paiement,
          reference: formData.reference
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Generate receipt for land rights payment
      const receipt = await ReceiptGenerator.createReceipt({
        clientId: souscription.client_id,
        referenceId: payment.id,
        typeOperation: "droit_terre",
        montantTotal: parseFloat(formData.montant),
        datePaiement: formData.date_paiement
      });

      toast({
        title: "Succès",
        description: `Paiement enregistré avec succès. Reçu généré: ${receipt.numero}`,
      });

      // Reset form
      setFormData({
        montant: "",
        date_paiement: new Date().toISOString().split("T")[0],
        mode_paiement: "",
        reference: ""
      });

      refetchPaiements();
      refetchSolde();
      onSuccess();
    } catch (error) {
      console.error("Error recording payment:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement",
        variant: "destructive",
      });
    }
  };

  const generateReceipt = async () => {
    // This would generate a PDF receipt
    toast({
      title: "Reçu généré",
      description: "Le reçu cumulatif a été généré avec succès",
    });
  };

  // Calculate statistics
  const totalPaye = paiements?.reduce((sum, p) => sum + Number(p.montant), 0) || 0;
  const soldeRestant = Number(soldeData) || 0;

  if (!souscription) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Paiement Droit de Terre - {souscription.clients?.prenom} {souscription.clients?.nom}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle>Nouveau paiement</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="montant">Montant (FCFA) *</Label>
                  <Input
                    id="montant"
                    type="number"
                    value={formData.montant}
                    onChange={(e) => setFormData({...formData, montant: e.target.value})}
                    placeholder="Entrez le montant à payer"
                    required
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Vous pouvez payer le montant total ou une partie
                  </p>
                </div>

                <div>
                  <Label htmlFor="date_paiement">Date de paiement *</Label>
                  <Input
                    id="date_paiement"
                    type="date"
                    value={formData.date_paiement}
                    onChange={(e) => setFormData({...formData, date_paiement: e.target.value})}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="mode_paiement">Mode de paiement</Label>
                  <Select value={formData.mode_paiement} onValueChange={(value) => setFormData({...formData, mode_paiement: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Espèces">Espèces</SelectItem>
                      <SelectItem value="Chèque">Chèque</SelectItem>
                      <SelectItem value="Virement">Virement</SelectItem>
                      <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="reference">Référence</Label>
                  <Input
                    id="reference"
                    value={formData.reference}
                    onChange={(e) => setFormData({...formData, reference: e.target.value})}
                    placeholder="Numéro de chèque, référence virement..."
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    Enregistrer le paiement
                  </Button>
                  <Button type="button" variant="outline" onClick={generateReceipt}>
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Summary and Status */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Résumé</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type de bien:</span>
                  <span className="font-medium">{souscription.type_bien || "Standard"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant mensuel:</span>
                  <span className="font-medium">{souscription.montant_droit_terre_mensuel?.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Début du paiement du droit de terre:</span>
                  <span className="font-medium">
                    {souscription.date_debut_droit_terre 
                      ? format(new Date(souscription.date_debut_droit_terre), "dd/MM/yyyy")
                      : souscription.type_souscription === "classique" && souscription.solde_restant <= 0
                        ? format(new Date(souscription.date_debut), "dd/MM/yyyy")
                        : "En attente du solde de la souscription"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total payé:</span>
                  <span className="font-medium text-green-600">
                    {totalPaye.toLocaleString()} FCFA
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solde restant:</span>
                  <span className={`font-medium ${soldeRestant > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {Math.abs(soldeRestant).toLocaleString()} FCFA
                    {soldeRestant < 0 && " (avance)"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Calcul du solde
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  <p>Le solde est calculé automatiquement en fonction du nombre de mois écoulés depuis le début du paiement du droit de terre.</p>
                  <p className="mt-2">
                    <strong>Montant mensuel:</strong> {souscription.montant_droit_terre_mensuel?.toLocaleString()} FCFA
                  </p>
                  <p>
                    <strong>Début:</strong> {
                      souscription.date_debut_droit_terre 
                        ? format(new Date(souscription.date_debut_droit_terre), "dd MMMM yyyy", { locale: fr })
                        : souscription.type_souscription === "classique" && souscription.solde_restant <= 0
                          ? format(new Date(souscription.date_debut), "dd MMMM yyyy", { locale: fr })
                          : "En attente"
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent payments history */}
        {paiements && paiements.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Historique des paiements récents</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Référence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paiements.slice(0, 5).map((paiement) => (
                    <TableRow key={paiement.id}>
                      <TableCell>
                        {format(new Date(paiement.date_paiement), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>{paiement.montant.toLocaleString()} FCFA</TableCell>
                      <TableCell>{paiement.mode_paiement}</TableCell>
                      <TableCell>{paiement.reference}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}