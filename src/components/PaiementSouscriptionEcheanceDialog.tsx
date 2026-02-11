import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { getInsufficientFundsMessage } from "@/utils/errorMessages";


const paiementSchema = z.object({
  montant: z.string().min(1, "Le montant est requis"),
  date_paiement: z.string().min(1, "La date de paiement est requise"),
  mode_paiement: z.string().optional(),
  reference: z.string().optional(),
});

type PaiementFormData = z.infer<typeof paiementSchema>;

interface PaiementSouscriptionEcheanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  souscription: any;
  onSuccess?: () => void;
}

export function PaiementSouscriptionEcheanceDialog({
  open,
  onOpenChange,
  souscription,
  onSuccess,
}: PaiementSouscriptionEcheanceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<PaiementFormData>({
    resolver: zodResolver(paiementSchema),
    defaultValues: {
      montant: "",
      date_paiement: new Date().toISOString().split("T")[0],
      mode_paiement: "",
      reference: "",
    },
  });

  const paiementMutation = useMutation({
    mutationFn: async (data: PaiementFormData) => {
      if (!souscription?.id) throw new Error("Souscription ID manquant");
      const montantPaiement = parseFloat(data.montant);

      if (souscription.solde_restant <= 0) {
        throw new Error("Cette souscription est déjà entièrement payée. Seuls les paiements de droit de terre sont possibles.");
      }
      if (montantPaiement > souscription.solde_restant) {
        throw new Error("Le montant ne peut pas dépasser le solde restant de la souscription");
      }


      // 2) Paiement via caisse (entree + journal)
      const paiementId = await apiClient.rpc("pay_souscription_with_cash", {
        souscription_id: souscription.id,
        montant: montantPaiement,
        date_paiement: data.date_paiement,
        mode_paiement: data.mode_paiement || null,
        reference: data.reference || null,
        description: "Paiement souscription",
      });

      return { paiementId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["souscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["paiements_souscription"] });
      queryClient.invalidateQueries({ queryKey: ["paiements_souscription", souscription?.id] });
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cash_balance"] });
      
      toast({
        title: "Paiement enregistré",
        description: "Le paiement a été enregistré avec succès.",
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error("Erreur lors du paiement:", error);
      const insufficientMessage = getInsufficientFundsMessage(error);
      if (insufficientMessage) {
        toast({
          title: "Montant insuffisant",
          description: insufficientMessage,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Erreur",
        description: error?.message || "Impossible d'enregistrer le paiement.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PaiementFormData) => {
    paiementMutation.mutate(data);
  };

  const montantPaye = souscription?.prix_total - souscription?.solde_restant;
  const progressPercent = souscription?.prix_total > 0 ? (montantPaye / souscription.prix_total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paiement - Souscription</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Subscription Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informations de la souscription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Type:</span>
                  <p className="text-muted-foreground">{souscription?.type_souscription}</p>
                </div>
                <div>
                  <span className="font-medium">Prix total:</span>
                  <p className="text-muted-foreground">
                    {souscription?.prix_total?.toLocaleString()} FCFA
                  </p>
                </div>
                <div>
                  <span className="font-medium">Apport initial:</span>
                  <p className="text-muted-foreground">
                    {souscription?.apport_initial?.toLocaleString()} FCFA
                  </p>
                </div>
                <div>
                  <span className="font-medium">Solde restant:</span>
                  <p className="text-muted-foreground">
                    {souscription?.solde_restant?.toLocaleString()} FCFA
                  </p>
                </div>
                <div>
                  <span className="font-medium">Mensualité:</span>
                  <p className="text-muted-foreground">
                    {souscription?.montant_mensuel?.toLocaleString()} FCFA
                  </p>
                </div>
                <div>
                  <span className="font-medium">Nombre de mois:</span>
                  <p className="text-muted-foreground">{souscription?.nombre_mois} mois</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <span className="font-medium">Progression des paiements:</span>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {progressPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {montantPaye?.toLocaleString()} FCFA sur {souscription?.prix_total?.toLocaleString()} FCFA
                </div>
              </div>

              {/* Affichage date début droit de terre */}
              {souscription?.type_souscription === "mise_en_garde" && souscription?.date_debut_droit_terre && (
                <div className="pt-4 border-t">
                  <span className="font-medium">Début du paiement du droit de terre:</span>
                  <p className="text-muted-foreground mt-1">
                    {format(new Date(souscription.date_debut_droit_terre), "dd MMMM yyyy", { locale: fr })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Paiement de souscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              {souscription?.solde_restant <= 0 ? (
                <div className="text-center space-y-3">
                  <Badge variant="default" className="mb-2 bg-green-100 text-green-800">
                    Souscription entièrement payée
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Cette souscription est entièrement payée. Pour les paiements de droit de terre, utilisez le bouton "Droit de terre".
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="montant"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Montant du paiement</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="Montant en FCFA"
                                {...field}
                              />
                            </FormControl>
                            <div className="text-xs text-muted-foreground">
                              Solde restant: {souscription?.solde_restant?.toLocaleString()} FCFA
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="date_paiement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date de paiement</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="mode_paiement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mode de paiement</FormLabel>
                            <FormControl>
                              <Combobox
                                options={[
                                  { value: "especes", label: "Espèces" },
                                  { value: "cheque", label: "Chèque" },
                                  { value: "virement", label: "Virement" },
                                  { value: "carte", label: "Carte bancaire" },
                                  { value: "mobile", label: "Paiement mobile" }
                                ]}
                                value={field.value}
                                onChange={field.onChange}
                                placeholder="Sélectionner un mode"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="reference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Référence (optionnel)</FormLabel>
                            <FormControl>
                              <Input placeholder="Numéro de chèque, référence..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full" disabled={paiementMutation.isPending}>
                        {paiementMutation.isPending ? "Traitement..." : "Effectuer le paiement"}
                      </Button>
                    </form>
                  </Form>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
