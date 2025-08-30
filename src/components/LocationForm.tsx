import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { ReceiptGenerator } from "@/utils/receiptGenerator";

interface LocationFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function LocationForm({ onClose, onSuccess }: LocationFormProps) {
  const [clientId, setClientId] = useState("");
  const [proprieteId, setProprieteId] = useState("");
  const [dateDebut, setDateDebut] = useState<Date>();
  const [dateFin, setDateFin] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLoyer, setSelectedLoyer] = useState(0);
  const { toast } = useToast();

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, nom, prenom, telephone_principal")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  // Fetch available properties (status = 'Libre')
  const { data: proprietes } = useQuery({
    queryKey: ["proprietes", "libre"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proprietes")
        .select("id, nom, adresse, loyer_mensuel")
        .eq("statut", "Libre")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  // Solde de caisse actuel
  const { data: cashBalance } = useQuery({
    queryKey: ["cash-balance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_current_cash_balance");
      if (error) throw error;
      return Number(data || 0);
    },
    refetchOnWindowFocus: false,
  });

  // Calculate deposit breakdown
  const calculateCautionBreakdown = (loyerMensuel: number) => {
    const garantie2Mois = loyerMensuel * 2;
    const loyerAvance2Mois = loyerMensuel * 2;
    const fraisAgence1Mois = loyerMensuel * 1;
    const cautionTotale = garantie2Mois + loyerAvance2Mois + fraisAgence1Mois;

    return {
      garantie2Mois,
      loyerAvance2Mois,
      fraisAgence1Mois,
      cautionTotale,
    };
  };

  const createLocationMutation = useMutation({
    mutationFn: async (locationData: any) => {
      // Create the location
      const { data: location, error: locationError } = await supabase
        .from("locations")
        .insert([locationData])
        .select()
        .single();

      if (locationError) throw locationError;

      // Update property status to 'Occupé'
      const { error: propertyError } = await supabase
        .from("proprietes")
        .update({ statut: "Occupé" })
        .eq("id", locationData.propriete_id);

      if (propertyError) throw propertyError;

      // Record caution payment in cash system (deduct from cash, record as revenue)
      const { data: cashTransaction, error: cashError } = await supabase
        .rpc('pay_caution_with_cash', {
          p_location_id: location.id,
          p_montant: locationData.caution_totale,
          p_date_paiement: locationData.date_debut,
          p_mode_paiement: 'Caution initiale',
          p_reference: `LOC-${location.id}`,
          p_description: 'Versement caution location'
        });

      if (cashError) throw cashError;

      // Generate caution receipt automatically
      const receipt = await ReceiptGenerator.createReceipt({
        clientId: locationData.client_id,
        referenceId: location.id,
        typeOperation: "caution_location",
        montantTotal: locationData.caution_totale,
        periodeDebut: locationData.date_debut,
        datePaiement: locationData.date_debut
      });

      return { location, receipt, cashTransaction };
    },
    onSuccess: ({ receipt }) => {
      toast({
        title: "Location créée",
        description: `Location créée avec succès. Reçu de caution généré: ${receipt.numero}`,
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la location.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !proprieteId || !dateDebut || !selectedLoyer) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const cautionBreakdown = calculateCautionBreakdown(selectedLoyer);

    const cautionAmount = cautionBreakdown.cautionTotale;
    if ((cashBalance ?? 0) < cautionAmount) {
      toast({
        title: "Solde insuffisant",
        description: `Solde caisse actuel: ${(cashBalance ?? 0).toLocaleString()} FCFA. Caution requise: ${cautionAmount.toLocaleString()} FCFA.`,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const locationData = {
      client_id: clientId,
      propriete_id: proprieteId,
      loyer_mensuel: selectedLoyer,
      date_debut: dateDebut.toISOString().split('T')[0],
      date_fin: dateFin ? dateFin.toISOString().split('T')[0] : null,
      caution: cautionBreakdown.cautionTotale,
      garantie_2_mois: cautionBreakdown.garantie2Mois,
      loyer_avance_2_mois: cautionBreakdown.loyerAvance2Mois,
      frais_agence_1_mois: cautionBreakdown.fraisAgence1Mois,
      caution_totale: cautionBreakdown.cautionTotale,
      statut: 'active',
    };

    createLocationMutation.mutate(locationData);
    setIsLoading(false);
  };

  const cautionBreakdown = selectedLoyer > 0 ? calculateCautionBreakdown(selectedLoyer) : null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle Location</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              <Combobox
                options={clients?.map(client => ({
                  value: client.id,
                  label: `${client.prenom} ${client.nom} - ${client.telephone_principal}`
                })) || []}
                value={clientId}
                onChange={setClientId}
                placeholder="Sélectionner un client"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="propriete">Propriété *</Label>
              <Combobox
                options={proprietes?.map(propriete => ({
                  value: propriete.id,
                  label: `${propriete.nom} - ${propriete.loyer_mensuel?.toLocaleString()} FCFA/mois`
                })) || []}
                value={proprieteId}
                onChange={(value) => {
                  setProprieteId(value);
                  const selectedProp = proprietes?.find(p => p.id === value);
                  if (selectedProp) {
                    setSelectedLoyer(selectedProp.loyer_mensuel || 0);
                  }
                }}
                placeholder="Sélectionner une propriété"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date de début *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateDebut && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateDebut ? format(dateDebut, "PPP", { locale: fr }) : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateDebut}
                    onSelect={setDateDebut}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Date de fin (optionnel)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFin && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFin ? format(dateFin, "PPP", { locale: fr }) : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFin}
                    onSelect={setDateFin}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Caution Breakdown */}
          {cautionBreakdown && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Détail de la Caution (5 mois)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>2 mois de garantie:</span>
                  <span className="font-medium">{cautionBreakdown.garantie2Mois.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span>2 mois de loyer d'avance:</span>
                  <span className="font-medium">{cautionBreakdown.loyerAvance2Mois.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span>1 mois d'agence:</span>
                  <span className="font-medium">{cautionBreakdown.fraisAgence1Mois.toLocaleString()} FCFA</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total à verser:</span>
                    <span className="text-primary">{cautionBreakdown.cautionTotale.toLocaleString()} FCFA</span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Solde caisse actuel:</span>
                      <span className="font-medium">{(cashBalance ?? 0).toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Solde après déduction:</span>
                      <span className={cn('font-medium', (cashBalance ?? 0) - cautionBreakdown.cautionTotale < 0 ? 'text-destructive' : '')}>
                        {((cashBalance ?? 0) - cautionBreakdown.cautionTotale).toLocaleString()} FCFA
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Création..." : "Créer la Location"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}