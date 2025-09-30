import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, addMonths, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PaiementLocationDialogProps {
  location: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaiementLocationDialog({ location, onClose, onSuccess }: PaiementLocationDialogProps) {
  const [montant, setMontant] = useState(location.loyer_mensuel?.toString() || "");
  const [datePaiement, setDatePaiement] = useState<Date>(new Date());
  const [modePaiement, setModePaiement] = useState("");
  const [reference, setReference] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { logCreate } = useAuditLog();
  const queryClient = useQueryClient();

  const { data: paidMonths = [] } = useQuery({
    queryKey: ["paid_months", location.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recus")
        .select("periode_debut, meta")
        .eq("type_operation", "location")
        .eq("meta->>objet_id", location.id)
        .not("periode_debut", "is", null);
      
      if (error) throw error;
      
      return data.map(recu => format(new Date(recu.periode_debut), "yyyy-MM"));
    },
    enabled: !!location.id,
  });

  const calculateStartingMonth = () => {
    const startMonth = startOfMonth(new Date(location.date_debut));
    return addMonths(startMonth, 3);
  };

  const generateAvailableMonths = () => {
    // Afficher tous les mois à partir de la date de début du contrat,
    // sur une période suffisamment longue (20 ans = 240 mois),
    // et ne pas exclure les mois déjà payés (les marquer seulement dans le label)
    const months: { value: string; label: string }[] = [];
    const startMonth = startOfMonth(new Date(location.date_debut));
    const TOTAL_MONTHS = 240; // 20 ans

    for (let i = 0; i < TOTAL_MONTHS; i++) {
      const date = addMonths(startMonth, i);
      const monthValue = format(date, "yyyy-MM");
      const isPaid = paidMonths.includes(monthValue);
      months.push({
        value: monthValue,
        label: `${format(date, "MMMM yyyy", { locale: fr })}${isPaid ? " • déjà payé" : ""}`
      });
    }

    return months;
  };


  const createPaiementMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(montant);
      if (!amount || !selectedMonth || !modePaiement) {
        throw new Error("Veuillez renseigner le mois, le mode de paiement et un montant valide.");
      }

      // 1) Effectuer le paiement via la caisse (sortie + journal)
      const description = selectedMonth
        ? `Loyer ${format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: fr })}`
        : "Paiement loyer";

      const { data: paiementId, error: rpcError } = await supabase.rpc("pay_location_with_cash" as any, {
        p_location_id: location.id,
        p_montant: amount,
        p_date_paiement: datePaiement.toISOString().split("T")[0],
        p_mode_paiement: modePaiement || null,
        p_reference: reference || null,
        p_description: description,
        p_periode_paiement: selectedMonth ? selectedMonth + "-01" : null,
      });
      if (rpcError) throw rpcError;

      // Le trigger se charge maintenant automatiquement de créer le reçu avec la bonne période

      return { paiementId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["paid_months", location.id] });
      queryClient.invalidateQueries({ queryKey: ["paiements_locations", location.id] });
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cash_balance"] });

      // Log audit event
      const description = selectedMonth
        ? `Loyer ${format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: fr })}`
        : "Paiement loyer";
      logCreate('paiements_locations', result.paiementId, { montant: Number(montant), location_id: location.id }, `Paiement loyer - ${description} - Montant: ${Number(montant).toLocaleString()} FCFA`);

      toast({
        title: "Paiement enregistré",
        description: `Paiement enregistré avec succès.`,
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible d'enregistrer le paiement.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!montant || !datePaiement || !modePaiement || !selectedMonth) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    createPaiementMutation.mutate();
    setIsLoading(false);
  };

  const calculateNewBalance = () => {
    const currentDebt = location.dette_totale || 0;
    const paymentAmount = Number(montant) || 0;
    return Math.max(0, currentDebt - paymentAmount);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enregistrer un Paiement de Loyer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Résumé de la Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Propriété:</span>
                <span className="font-medium">{location.proprietes?.nom}</span>
              </div>
              <div className="flex justify-between">
                <span>Locataire:</span>
                <span className="font-medium">
                  {location.clients?.prenom} {location.clients?.nom}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Loyer mensuel:</span>
                <span className="font-medium">{location.loyer_mensuel?.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span>Date de début:</span>
                <span className="font-medium">{format(new Date(location.date_debut), "dd MMMM yyyy", { locale: fr })}</span>
              </div>
              <div className="flex justify-between">
                <span>Premier mois à payer:</span>
                <span className="font-medium text-blue-600">
                  {format(calculateStartingMonth(), "MMMM yyyy", { locale: fr })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Mois déjà payés:</span>
                <span className="font-medium text-green-600">{paidMonths.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Dette actuelle:</span>
                <span className={`font-medium ${location.dette_totale > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {location.dette_totale?.toLocaleString()} FCFA
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Information sur les 2 mois d'avance */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Les 2 premiers mois ({format(addMonths(startOfMonth(new Date(location.date_debut)), 1), "MMMM yyyy", { locale: fr })} et {format(addMonths(startOfMonth(new Date(location.date_debut)), 2), "MMMM yyyy", { locale: fr })}) 
                sont couverts par l'avance déjà payée lors de la signature du contrat.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="selectedMonth">Mois de paiement *</Label>
              <Combobox
                options={generateAvailableMonths().length > 0 ? 
                  generateAvailableMonths() : 
                  [{ value: "", label: "Tous les mois sont déjà payés", disabled: true }]
                }
                value={selectedMonth}
                onChange={setSelectedMonth}
                placeholder="Sélectionner le mois"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="montant">Montant (FCFA) *</Label>
              <Input
                id="montant"
                type="number"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="Montant du paiement"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date de paiement *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !datePaiement && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {datePaiement ? format(datePaiement, "PPP", { locale: fr }) : "Sélectionner une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={datePaiement}
                    onSelect={(date) => date && setDatePaiement(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modePaiement">Mode de paiement *</Label>
              <Combobox
                options={[
                  { value: "especes", label: "Espèces" },
                  { value: "cheque", label: "Chèque" },
                  { value: "virement", label: "Virement" },
                  { value: "carte", label: "Carte bancaire" },
                  { value: "mobile", label: "Paiement mobile" }
                ]}
                value={modePaiement}
                onChange={setModePaiement}
                placeholder="Sélectionner le mode"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Référence</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Numéro de chèque, référence virement, etc."
            />
          </div>

          {/* Impact du Paiement */}
          {montant && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Impact du Paiement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Dette avant paiement:</span>
                  <span className="text-red-600">{location.dette_totale?.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span>Montant du paiement:</span>
                  <span className="text-blue-600">-{Number(montant).toLocaleString()} FCFA</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between font-bold">
                    <span>Nouvelle dette:</span>
                    <span className={calculateNewBalance() > 0 ? 'text-red-600' : 'text-green-600'}>
                      {calculateNewBalance().toLocaleString()} FCFA
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? "Enregistrement..." : "Enregistrer le Paiement"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
