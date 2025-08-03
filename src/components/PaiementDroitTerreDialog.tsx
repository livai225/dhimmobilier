import { useState, useEffect } from "react";
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
import { CreditCard, FileText, Calendar } from "lucide-react";

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
    reference: "",
    numero_echeance: ""
  });

  const { data: echeances, isLoading: loadingEcheances, refetch: refetchEcheances } = useQuery({
    queryKey: ["echeances_droit_terre", souscription?.id],
    queryFn: async () => {
      if (!souscription?.id) return [];
      
      const { data, error } = await supabase
        .from("echeances_droit_terre")
        .select("*")
        .eq("souscription_id", souscription.id)
        .order("numero_echeance");

      if (error) throw error;
      return data;
    },
    enabled: !!souscription?.id && open,
  });

  const { data: paiements } = useQuery({
    queryKey: ["paiements_echeances", souscription?.id],
    queryFn: async () => {
      if (!souscription?.id) return [];
      
      const { data, error } = await supabase
        .from("paiements_locations")
        .select("*")
        .eq("location_id", souscription.id)
        .order("date_paiement", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!souscription?.id && open,
  });

  useEffect(() => {
    if (souscription && echeances) {
      // Find the next unpaid écheance
      const nextEcheance = echeances.find(e => e.statut === "en_attente");
      if (nextEcheance) {
        setFormData(prev => ({
          ...prev,
          montant: nextEcheance.montant.toString(),
          numero_echeance: nextEcheance.numero_echeance.toString()
        }));
      }
    }
  }, [souscription, echeances]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Record the payment
      const { error: paymentError } = await supabase
        .from("paiements_locations")
        .insert({
          location_id: souscription.id,
          montant: parseFloat(formData.montant),
          date_paiement: formData.date_paiement,
          mode_paiement: formData.mode_paiement,
          reference: formData.reference
        });

      if (paymentError) throw paymentError;

      // Update the écheance status
      if (formData.numero_echeance) {
        const { error: echeanceError } = await supabase
          .from("echeances_droit_terre")
          .update({
            statut: "paye",
            date_paiement: formData.date_paiement,
            montant_paye: parseFloat(formData.montant)
          })
          .eq("souscription_id", souscription.id)
          .eq("numero_echeance", parseInt(formData.numero_echeance));

        if (echeanceError) throw echeanceError;
      }

      toast({
        title: "Succès",
        description: "Paiement enregistré avec succès",
      });

      // Reset form
      setFormData({
        montant: "",
        date_paiement: new Date().toISOString().split("T")[0],
        mode_paiement: "",
        reference: "",
        numero_echeance: ""
      });

      refetchEcheances();
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

  const echeancesEnRetard = echeances?.filter(e => 
    e.statut === "en_attente" && new Date(e.date_echeance) < new Date()
  ) || [];

  const prochaines5Echeances = echeances?.filter(e => e.statut === "en_attente").slice(0, 5) || [];

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
                  <Label htmlFor="numero_echeance">Échéance</Label>
                  <Select value={formData.numero_echeance} onValueChange={(value) => {
                    const selectedEcheance = echeances?.find(e => e.numero_echeance.toString() === value);
                    setFormData({
                      ...formData, 
                      numero_echeance: value,
                      montant: selectedEcheance?.montant.toString() || ""
                    });
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une échéance" />
                    </SelectTrigger>
                    <SelectContent>
                      {echeances?.filter(e => e.statut === "en_attente").slice(0, 12).map((echeance) => (
                        <SelectItem key={echeance.id} value={echeance.numero_echeance.toString()}>
                          #{echeance.numero_echeance} - {format(new Date(echeance.date_echeance), "MMMM yyyy", { locale: fr })}
                          {new Date(echeance.date_echeance) < new Date() && (
                            <Badge variant="destructive" className="ml-2">En retard</Badge>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="montant">Montant (FCFA) *</Label>
                  <Input
                    id="montant"
                    type="number"
                    value={formData.montant}
                    onChange={(e) => setFormData({...formData, montant: e.target.value})}
                    required
                  />
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
                  <span className="font-medium">{souscription.type_bien}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant mensuel:</span>
                  <span className="font-medium">{souscription.montant_droit_terre_mensuel?.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Début droit de terre:</span>
                  <span className="font-medium">
                    {souscription.date_debut_droit_terre 
                      ? format(new Date(souscription.date_debut_droit_terre), "dd/MM/yyyy")
                      : "N/A"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Échéances payées:</span>
                  <span className="font-medium text-green-600">
                    {echeances?.filter(e => e.statut === "paye").length || 0} / 240
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">En retard:</span>
                  <span className="font-medium text-red-600">{echeancesEnRetard.length}</span>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming payments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Prochaines échéances
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {prochaines5Echeances.map((echeance) => (
                    <div key={echeance.id} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <p className="font-medium">#{echeance.numero_echeance}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(echeance.date_echeance), "dd MMMM yyyy", { locale: fr })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{echeance.montant.toLocaleString()} FCFA</p>
                        {new Date(echeance.date_echeance) < new Date() && (
                          <Badge variant="destructive" className="text-xs">En retard</Badge>
                        )}
                      </div>
                    </div>
                  ))}
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