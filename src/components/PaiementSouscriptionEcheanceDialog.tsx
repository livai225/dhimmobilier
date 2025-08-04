import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, CreditCard, FileText, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ReceiptGenerator } from "@/utils/receiptGenerator";

const paiementSchema = z.object({
  echeance_id: z.string().min(1, "Vous devez sélectionner une échéance"),
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
      echeance_id: "",
      montant: "",
      date_paiement: new Date().toISOString().split("T")[0],
      mode_paiement: "",
      reference: "",
    },
  });

  // Fetch subscription installments
  const { data: echeances, isLoading } = useQuery({
    queryKey: ["echeances_souscriptions", souscription?.id],
    queryFn: async () => {
      if (!souscription?.id) return [];
      
      const { data, error } = await supabase
        .from("echeances_souscriptions")
        .select("*")
        .eq("souscription_id", souscription.id)
        .order("numero_echeance");

      if (error) throw error;
      return data || [];
    },
    enabled: !!souscription?.id && open,
  });

  // Generate installments if they don't exist
  const generateEcheancesMutation = useMutation({
    mutationFn: async () => {
      if (!souscription?.id) throw new Error("Souscription ID manquant");
      
      const { error } = await supabase.rpc("generate_echeances_souscription", {
        souscription_uuid: souscription.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["echeances_souscriptions"] });
      toast({
        title: "Échéances générées",
        description: "Les échéances ont été générées avec succès.",
      });
    },
    onError: (error) => {
      console.error("Erreur lors de la génération des échéances:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer les échéances.",
        variant: "destructive",
      });
    },
  });

  const paiementMutation = useMutation({
    mutationFn: async (data: PaiementFormData) => {
      if (!souscription?.id) throw new Error("Souscription ID manquant");

      // Find the selected installment
      const selectedEcheance = echeances?.find(e => e.id === data.echeance_id);
      
      if (!selectedEcheance) {
        throw new Error("Échéance sélectionnée introuvable");
      }

      const montantPaiement = parseFloat(data.montant);
      const montantDejaPayé = selectedEcheance.montant_paye || 0;
      const nouveauMontantPayé = montantDejaPayé + montantPaiement;

      // Verify payment amount doesn't exceed remaining balance
      if (montantPaiement > souscription.solde_restant) {
        throw new Error("Le montant ne peut pas dépasser le solde restant de la souscription");
      }

      // Create payment in paiements_souscriptions
      const { data: paiement, error: paiementError } = await supabase
        .from("paiements_souscriptions")
        .insert({
          souscription_id: souscription.id,
          montant: montantPaiement,
          date_paiement: data.date_paiement,
          mode_paiement: data.mode_paiement,
          reference: data.reference,
        })
        .select()
        .single();

      if (paiementError) throw paiementError;

      // Update the installment with partial or full payment
      const newStatus = nouveauMontantPayé >= selectedEcheance.montant ? "paye" : "en_attente";
      
      const { error: updateError } = await supabase
        .from("echeances_souscriptions")
        .update({
          statut: newStatus,
          montant_paye: nouveauMontantPayé,
          date_paiement: newStatus === "paye" ? data.date_paiement : selectedEcheance.date_paiement,
        })
        .eq("id", selectedEcheance.id);

      if (updateError) throw updateError;

      // Update subscription remaining balance
      const { error: souscriptionError } = await supabase
        .from("souscriptions")
        .update({
          solde_restant: Math.max(0, souscription.solde_restant - montantPaiement),
        })
        .eq("id", souscription.id);

      if (souscriptionError) throw souscriptionError;

      // Generate receipt
      const receiptData = {
        numero: `PAY-${Date.now()}`,
        client_id: souscription.client_id,
        type_operation: "paiement_souscription",
        montant_total: montantPaiement,
        reference_id: paiement.id,
        periode_debut: selectedEcheance.date_echeance,
        periode_fin: selectedEcheance.date_echeance,
      };

      const { error: receiptError } = await supabase
        .from("recus")
        .insert(receiptData);

      if (receiptError) throw receiptError;

      return { paiement, receipt: receiptData, echeance: selectedEcheance };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["souscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["echeances_souscriptions"] });
      
      toast({
        title: "Paiement enregistré",
        description: "Le paiement a été enregistré avec succès.",
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();

      // Generate and download receipt
      ReceiptGenerator.generateSouscriptionPaymentReceipt(data.receipt, souscription);
    },
    onError: (error) => {
      console.error("Erreur lors du paiement:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le paiement.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PaiementFormData) => {
    paiementMutation.mutate(data);
  };

  const echeancesDisponibles = echeances?.filter(e => e.statut === "en_attente" || (e.montant_paye || 0) < e.montant) || [];
  const echeancesPayees = echeances?.filter(e => e.statut === "paye").length || 0;
  const totalEcheances = echeances?.length || 0;
  
  const selectedEcheanceId = form.watch("echeance_id");
  const selectedEcheance = echeances?.find(e => e.id === selectedEcheanceId);
  const montantRestantEcheance = selectedEcheance ? selectedEcheance.montant - (selectedEcheance.montant_paye || 0) : 0;

  // Helper function to get status badge
  const getStatusBadge = (echeance: any) => {
    const montantPayé = echeance.montant_paye || 0;
    if (montantPayé >= echeance.montant) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Payé</Badge>;
    } else if (montantPayé > 0) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Partiel</Badge>;
    } else {
      return <Badge variant="outline">En attente</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paiement d'échéance - Souscription</DialogTitle>
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
                <span className="font-medium">Progression:</span>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${totalEcheances > 0 ? (echeancesPayees / totalEcheances) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {echeancesPayees}/{totalEcheances}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Paiement d'échéance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>Chargement des échéances...</p>
              ) : !echeances || echeances.length === 0 ? (
                <div className="text-center space-y-4">
                  <p className="text-muted-foreground">
                    Aucune échéance trouvée pour cette souscription.
                  </p>
                  <Button 
                    onClick={() => generateEcheancesMutation.mutate()}
                    disabled={generateEcheancesMutation.isPending}
                  >
                    {generateEcheancesMutation.isPending ? "Génération..." : "Générer les échéances"}
                  </Button>
                </div>
              ) : echeancesDisponibles.length === 0 ? (
                <div className="text-center">
                  <Badge variant="default" className="mb-2 bg-green-100 text-green-800">
                    Toutes les échéances sont payées
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Cette souscription est entièrement payée.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="echeance_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sélectionner l'échéance à payer</FormLabel>
                            <Select onValueChange={(value) => {
                              field.onChange(value);
                              const echeance = echeances?.find(e => e.id === value);
                              if (echeance) {
                                const montantRestant = echeance.montant - (echeance.montant_paye || 0);
                                form.setValue("montant", montantRestant.toString());
                              }
                            }} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choisir une échéance" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {echeancesDisponibles.map((echeance) => {
                                  const montantPayé = echeance.montant_paye || 0;
                                  const montantRestant = echeance.montant - montantPayé;
                                  return (
                                    <SelectItem key={echeance.id} value={echeance.id}>
                                      <div className="flex items-center justify-between w-full">
                                        <span>
                                          Échéance {echeance.numero_echeance} - {format(new Date(echeance.date_echeance), "dd/MM/yyyy")}
                                        </span>
                                        <span className="ml-2 text-xs">
                                          {montantRestant.toLocaleString()} FCFA restant
                                        </span>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {selectedEcheance && (
                        <div className="p-3 bg-muted rounded-lg">
                          <h4 className="font-medium mb-2">Détails de l'échéance sélectionnée</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Date:</span>
                              <p>{format(new Date(selectedEcheance.date_echeance), "dd MMMM yyyy", { locale: fr })}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Montant total:</span>
                              <p>{selectedEcheance.montant?.toLocaleString()} FCFA</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Déjà payé:</span>
                              <p>{(selectedEcheance.montant_paye || 0).toLocaleString()} FCFA</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Restant à payer:</span>
                              <p className="font-medium">{montantRestantEcheance.toLocaleString()} FCFA</p>
                            </div>
                          </div>
                        </div>
                      )}

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
                            {selectedEcheance && (
                              <div className="text-xs text-muted-foreground">
                                Maximum: {montantRestantEcheance.toLocaleString()} FCFA (restant de cette échéance)
                              </div>
                            )}
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionner un mode" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="especes">Espèces</SelectItem>
                                <SelectItem value="virement">Virement</SelectItem>
                                <SelectItem value="cheque">Chèque</SelectItem>
                                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="reference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Référence</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Référence du paiement"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex gap-2 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onOpenChange(false)}
                          className="flex-1"
                        >
                          Annuler
                        </Button>
                        <Button
                          type="submit"
                          disabled={paiementMutation.isPending || !selectedEcheance}
                          className="flex-1"
                        >
                          {paiementMutation.isPending ? "Traitement..." : "Enregistrer le paiement"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Installments List */}
        {echeances && echeances.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Liste des échéances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {echeances.map((echeance) => {
                  const montantPayé = echeance.montant_paye || 0;
                  const montantRestant = echeance.montant - montantPayé;
                  
                  return (
                    <div
                      key={echeance.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            Échéance {echeance.numero_echeance}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(echeance.date_echeance), "dd MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p className="font-medium text-sm">
                            {echeance.montant?.toLocaleString()} FCFA
                          </p>
                          {montantPayé > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Payé: {montantPayé.toLocaleString()} FCFA
                            </p>
                          )}
                          {montantRestant > 0 && echeance.statut !== "paye" && (
                            <p className="text-xs text-orange-600">
                              Restant: {montantRestant.toLocaleString()} FCFA
                            </p>
                          )}
                        </div>
                        {getStatusBadge(echeance)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}