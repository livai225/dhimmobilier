import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
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

import BalanceBadge from "@/components/BalanceBadge";

const paiementSchema = z.object({
  montant: z.number().min(0.01, "Le montant doit être supérieur à 0"),
  date_paiement: z.string().min(1, "La date est requise"),
  mode_paiement: z.string().optional(),
  reference: z.string().optional(),
});

type PaiementFormData = z.infer<typeof paiementSchema>;

interface PaiementCautionDialogProps {
  location: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PaiementCautionDialog({
  location,
  open,
  onOpenChange,
  onSuccess,
}: PaiementCautionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<PaiementFormData>({
    resolver: zodResolver(paiementSchema),
    defaultValues: {
      montant: 0,
      date_paiement: new Date().toISOString().split("T")[0],
      mode_paiement: "",
      reference: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PaiementFormData) => {
      if (!location?.id) throw new Error("Location introuvable");

      // 1) Check cash balance
      const balance = Number(await apiClient.rpc("get_current_cash_balance"));

      if (balance < data.montant) {
        throw new Error(
          `Solde insuffisant. Solde actuel: ${balance.toLocaleString()} FCFA, Montant demandé: ${data.montant.toLocaleString()} FCFA`
        );
      }

      // 2) Record cash transaction
      const transactionId = await apiClient.rpc("record_cash_transaction", {
        type_transaction: "sortie",
        montant: data.montant,
        type_operation: "paiement_caution",
        agent_id: null,
        beneficiaire: `${location.clients?.prenom} ${location.clients?.nom}`,
        reference_operation: location.id,
        description: `Paiement caution - ${location.proprietes?.nom}`,
      });

      // Le reçu sera généré automatiquement par trigger
      return { transactionId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cash_balance"] });

      form.reset();
      toast({
        title: "Succès",
        description: `Paiement de caution enregistré avec succès.`,
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
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (!location) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paiement de Caution</DialogTitle>
        </DialogHeader>

        {/* Cash balance display */}
        <div className="flex items-center justify-between bg-muted p-3 rounded-lg">
          <span className="text-sm font-medium">Solde caisse disponible:</span>
          <BalanceBadge />
        </div>

        {/* Location info */}
        <div className="bg-muted p-4 rounded-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Client</p>
              <p className="font-medium">
                {location.clients?.prenom} {location.clients?.nom}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Propriété</p>
              <p className="font-medium">{location.proprietes?.nom}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Caution totale versée</p>
              <p className="font-medium">
                {formatCurrency(location.caution_totale)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Loyer mensuel</p>
              <p className="font-medium">
                {formatCurrency(location.loyer_mensuel)}
              </p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        step="1"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                          { value: "carte", label: "Carte bancaire" },
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
                      <Input
                        {...field}
                        placeholder="N° chèque, réf. virement..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="w-full sm:w-auto"
              >
                {mutation.isPending ? "Enregistrement..." : "Enregistrer le paiement"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}