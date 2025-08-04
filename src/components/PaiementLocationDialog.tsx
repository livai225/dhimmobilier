import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
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
  const queryClient = useQueryClient();

  // Generate months for payment
  const generateMonths = () => {
    const months = [];
    const currentDate = new Date();
    
    // Generate 12 months starting from current month
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      months.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy", { locale: fr })
      });
    }
    
    return months;
  };

  const generateReceiptNumber = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `REC-LOC-${year}${month}${day}-${random}`;
  };

  const createPaiementMutation = useMutation({
    mutationFn: async (paiementData: any) => {
      // Create payment
      const { data: paiement, error: paiementError } = await supabase
        .from("paiements_locations")
        .insert([paiementData])
        .select()
        .single();

      if (paiementError) throw paiementError;

      // Generate receipt
      const receiptNumber = generateReceiptNumber();
      const { data: recu, error: recuError } = await supabase
        .from("recus")
        .insert({
          numero: receiptNumber,
          client_id: location.client_id,
          reference_id: location.id,
          type_operation: "location",
          montant_total: Number(montant),
          periode_debut: selectedMonth ? (selectedMonth + "-01") : null,
          periode_fin: selectedMonth ? (selectedMonth + "-01") : null,
          date_generation: datePaiement.toISOString().split('T')[0],
        })
        .select()
        .single();

      if (recuError) throw recuError;

      return { paiement, recu };
    },
    onSuccess: ({ recu }) => {
      toast({
        title: "Paiement enregistré",
        description: `Paiement enregistré avec succès. Reçu généré: ${recu.numero}`,
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le paiement.",
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

    const paiementData = {
      location_id: location.id,
      montant: Number(montant),
      date_paiement: datePaiement.toISOString().split('T')[0],
      mode_paiement: modePaiement,
      reference: reference || null,
    };

    createPaiementMutation.mutate(paiementData);
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
                <span>Dette actuelle:</span>
                <span className={`font-medium ${location.dette_totale > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {location.dette_totale?.toLocaleString()} FCFA
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="selectedMonth">Mois de paiement *</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le mois" />
                </SelectTrigger>
                <SelectContent>
                  {generateMonths().map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select value={modePaiement} onValueChange={setModePaiement}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="especes">Espèces</SelectItem>
                  <SelectItem value="cheque">Chèque</SelectItem>
                  <SelectItem value="virement">Virement</SelectItem>
                  <SelectItem value="carte">Carte bancaire</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Référence (optionnel)</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Numéro de chèque, référence virement, etc."
            />
          </div>

          {/* Payment Impact */}
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