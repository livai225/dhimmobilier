import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Combobox } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { generateCurrentYearMonthOptions } from "@/utils/monthOptions";


const paiementSchema = z.object({
  montant: z.number().min(0.01, "Le montant doit être supérieur à 0"),
  date_paiement: z.string().min(1, "La date est requise"),
  mode_paiement: z.string().optional(),
  reference: z.string().optional(),
  periode_paiement: z.string().optional(),
});

type PaiementFormData = z.infer<typeof paiementSchema>;

interface PaiementSouscriptionDialogProps {
  souscription: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PaiementSouscriptionDialog({ 
  souscription, 
  open, 
  onOpenChange, 
  onSuccess 
}: PaiementSouscriptionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logCreate } = useAuditLog();
  
  const form = useForm<PaiementFormData>({
    resolver: zodResolver(paiementSchema),
    defaultValues: {
      montant: 0,
      date_paiement: new Date().toISOString().split('T')[0],
      mode_paiement: "",
      reference: "",
      periode_paiement: "",
    },
  });

  // Generate available months for payment - Show all months of the year
  const generateAvailableMonths = () => {
    return generateCurrentYearMonthOptions();
  };

  const mutation = useMutation({
    mutationFn: async (data: PaiementFormData) => {
      if (!souscription?.id) throw new Error("Souscription introuvable");


      // 1) Paiement via caisse (entree + journal)
      const { data: paiementId, error } = await supabase.rpc("pay_souscription_with_cash" as any, {
        p_souscription_id: souscription.id,
        p_montant: data.montant,
        p_date_paiement: data.date_paiement,
        p_mode_paiement: data.mode_paiement || null,
        p_reference: data.reference || null,
        p_description: data.periode_paiement 
          ? `Paiement souscription - ${format(new Date(data.periode_paiement + "-01"), "MMMM yyyy", { locale: fr })}`
          : "Paiement souscription",
        p_periode_paiement: data.periode_paiement ? data.periode_paiement + "-01" : null,
      });
      if (error) throw error;

      return { paiementId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["souscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["paiements"] });
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cash_balance"] });

      // Log audit event
      const clientName = `${souscription?.clients?.prenom || ''} ${souscription?.clients?.nom || ''}`.trim();
      const propertyName = souscription?.proprietes?.nom || 'Propriété inconnue';
      logCreate('paiements_souscriptions', result.paiementId, { montant: form.getValues('montant'), souscription_id: souscription.id }, `Paiement souscription - Client: ${clientName}, Propriété: ${propertyName}, Montant: ${form.getValues('montant').toLocaleString()} FCFA`);

      form.reset();
      toast({
        title: "Succès",
        description: "Paiement enregistré et reçu généré.",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message || "Une erreur est survenue lors de l'enregistrement du paiement",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PaiementFormData) => {
    mutation.mutate(data);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (!souscription) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paiement de souscription</DialogTitle>
        </DialogHeader>

        {/* Subscription info */}
        <div className="bg-muted p-4 rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Client</p>
              <p className="font-medium">{souscription.clients?.prenom} {souscription.clients?.nom}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Propriété</p>
              <p className="font-medium">{souscription.proprietes?.nom}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Montant total</p>
              <p className="font-medium">{formatCurrency(souscription.montant_souscris)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Solde restant</p>
              <p className="font-bold text-destructive">{formatCurrency(souscription.solde_restant)}</p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="periode_paiement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Période de paiement</FormLabel>
                    <FormControl>
                      <Combobox
                        options={generateAvailableMonths()}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Sélectionner la période"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="montant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant à payer (FCFA) *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        max={souscription.solde_restant}
                        step="1"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date_paiement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de paiement *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mode_paiement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mode de paiement</FormLabel>
                    <FormControl>
                      <Combobox
                        options={[
                          { value: "espece", label: "Espèces" },
                          { value: "cheque", label: "Chèque" },
                          { value: "virement", label: "Virement" },
                          { value: "mobile_money", label: "Mobile Money" },
                          { value: "carte", label: "Carte bancaire" }
                        ]}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Sélectionnez un mode"
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
                    <FormLabel>Référence</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="N° chèque, réf. virement..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto">
                {mutation.isPending ? "Enregistrement..." : "Enregistrer le paiement"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
