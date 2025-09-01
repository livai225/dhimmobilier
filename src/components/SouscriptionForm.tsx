import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ReceiptGenerator } from "@/utils/receiptGenerator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

const souscriptionSchema = z.object({
  client_id: z.string().min(1, "Le client est obligatoire"),
  propriete_id: z.string().min(1, "La propriété est obligatoire"),
  montant_souscris: z.string().min(1, "Le montant souscris est obligatoire"),
  montant_droit_terre_mensuel: z.string().optional(),
  apport_initial: z.string().optional(),
  date_debut: z.string().min(1, "La date de début est obligatoire"),
  type_souscription: z.enum(["classique"]).default("classique"),
  periode_finition_mois: z.string().optional(),
  type_bien: z.string().optional(),
  statut: z.string().default("active"),
  paiement_immediat: z.boolean().default(false),
  mode_paiement: z.string().optional(),
});

type SouscriptionFormData = z.infer<typeof souscriptionSchema>;

interface SouscriptionFormProps {
  souscription?: any;
  onSuccess: () => void;
  baremes: any[];
}

export function SouscriptionForm({ souscription, onSuccess, baremes }: SouscriptionFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<SouscriptionFormData>({
    resolver: zodResolver(souscriptionSchema),
    defaultValues: {
      client_id: souscription?.client_id || "",
      propriete_id: souscription?.propriete_id || "",
      montant_souscris: souscription?.montant_souscris?.toString() || souscription?.prix_total?.toString() || "",
      montant_droit_terre_mensuel: souscription?.montant_droit_terre_mensuel?.toString() || "",
      apport_initial: souscription?.apport_initial?.toString() || "",
      date_debut: souscription?.date_debut || "",
      type_souscription: "classique",
      periode_finition_mois: souscription?.periode_finition_mois?.toString() || "9",
      type_bien: souscription?.type_bien || "",
      statut: souscription?.statut || "active",
      paiement_immediat: false,
      mode_paiement: "especes",
    },
  });

  interface Client {
    id: string;
    nom: string;
    prenom: string;
  }

  const { data: clients = [] } = useQuery<Array<Client & { label: string; value: string }>>({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, nom, prenom")
        .order("nom");
      if (error) throw error;
      return (data as Client[]).map(client => ({
        ...client,
        label: `${client.prenom} ${client.nom}`,
        value: client.id
      }));
    },
  });

  interface Propriete {
    id: string;
    nom: string;
    adresse: string;
    montant_bail: number;
    droit_terre: number;
  }

  const { data: proprietes = [] } = useQuery<Array<Propriete & { label: string; value: string }>>({
    queryKey: ["proprietes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proprietes")
        .select("id, nom, adresse, montant_bail, droit_terre")
        .eq("usage", "Bail")
        .eq("statut", "Libre")
        .order("nom");
      if (error) throw error;
      return (data as Propriete[]).map(propriete => ({
        ...propriete,
        label: propriete.nom,
        value: propriete.id
      }));
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: SouscriptionFormData) => {
      // Handle immediate payment logic
      const apportAmount = data.paiement_immediat 
        ? parseFloat(data.montant_souscris) 
        : parseFloat(data.apport_initial || "0");

      // Pré-contrôle du solde de caisse pour éviter une erreur côté RPC
      if (apportAmount > 0) {
        const { data: canPay, error: canPayError } = await supabase.rpc('can_make_payment' as any, { amount: apportAmount });
        if (canPayError) throw canPayError;
        if (!canPay) {
          throw new Error("Solde de caisse insuffisant pour effectuer ce paiement");
        }
      }

      const processedData = {
        client_id: data.client_id,
        propriete_id: data.propriete_id,
        montant_souscris: parseFloat(data.montant_souscris),
        prix_total: parseFloat(data.montant_souscris), // Keep for backward compatibility
        montant_droit_terre_mensuel: parseFloat(data.montant_droit_terre_mensuel || "0"),
        apport_initial: 0, // Don't store in subscription record to avoid double counting
        periode_finition_mois: parseInt(data.periode_finition_mois || "9"),
        solde_restant: data.paiement_immediat ? 0 : parseFloat(data.montant_souscris) - apportAmount,
        date_debut: data.date_debut,
        type_souscription: data.type_souscription,
        type_bien: data.type_bien || null,
        statut: data.statut,
        // Add these for compatibility
        montant_mensuel: 0,
        nombre_mois: 0
      };

      // Update property status to "Occupé" when creating a new subscription
      if (!souscription && data.propriete_id) {
        await supabase
          .from("proprietes")
          .update({ statut: "Occupé" })
          .eq("id", data.propriete_id);
      }

      let result;
      let receipt = null;
      
      if (souscription) {
        result = await supabase
          .from("souscriptions")
          .update(processedData)
          .eq("id", souscription.id);
      } else {
        result = await supabase
          .from("souscriptions")
          .insert(processedData)
          .select()
          .single();
        
        // Generate receipt and record cash transaction for payment
        if (processedData.apport_initial > 0 && result.data) {
          // Déterminer les libellés (type_operation unifié)
          const operationType = 'paiement_souscription';
          const description = data.paiement_immediat 
            ? 'Paiement intégral de souscription' 
            : 'Apport initial pour souscription';

          // Record cash transaction
          const { error: cashError } = await supabase.rpc('record_cash_transaction', {
            p_montant: processedData.apport_initial,
            p_type_transaction: 'sortie',
            p_type_operation: operationType,
            p_beneficiaire: `Souscription - ${result.data.id}`,
            p_description: description,
            p_reference_operation: result.data.id,
            p_agent_id: null,
            p_piece_justificative: null
          });

          if (cashError) {
            console.error('Error recording cash transaction:', cashError);
            throw new Error('Erreur lors de l\'enregistrement de la transaction caisse');
          }

          // Enregistrer le paiement dans paiements_souscriptions (apport initial ou paiement intégral)
          const { error: paiementError } = await supabase
            .from('paiements_souscriptions')
            .insert({
              souscription_id: result.data.id,
              montant: processedData.apport_initial,
              date_paiement: processedData.date_debut,
              mode_paiement: data.mode_paiement || 'especes',
              reference: `${description} - ${result.data.id}`
            });

          if (paiementError) {
            console.error('Error recording subscription payment:', paiementError);
            throw new Error("Erreur lors de l'enregistrement du paiement de souscription");
          }

          receipt = await ReceiptGenerator.createReceipt({
            clientId: processedData.client_id,
            referenceId: result.data.id,
            typeOperation: operationType,
            montantTotal: processedData.apport_initial,
            periodeDebut: processedData.date_debut,
            datePaiement: processedData.date_debut
          });
        }
      }

      if (result.error) throw result.error;
      return { result, receipt };
    },
    onSuccess: ({ receipt }) => {
      queryClient.invalidateQueries({ queryKey: ["souscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cash_balance"] });
      queryClient.invalidateQueries({ queryKey: ["recus"] });
      const message = souscription 
        ? "Souscription modifiée avec succès" 
        : receipt 
          ? `Souscription créée avec succès. Reçu généré: ${receipt.numero}`
          : "Souscription créée avec succès";

      toast({
        title: "Succès",
        description: message,
      });

      onSuccess();
    },
    onError: (error) => {
      console.error("Error saving souscription:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement",
        variant: "destructive",
      });
    },
  });

  // Function to handle property selection and auto-fill
  const handlePropertyChange = (proprieteId: string) => {
    if (!proprieteId) return;
    
    const selectedPropriete = proprietes.find(p => p.id === proprieteId);
    if (selectedPropriete) {
      form.setValue("propriete_id", proprieteId);
      form.setValue("montant_souscris", selectedPropriete.montant_bail?.toString() || "");
      form.setValue("montant_droit_terre_mensuel", selectedPropriete.droit_terre?.toString() || "");
    } else {
      form.setValue("propriete_id", proprieteId);
    }
  };

  // Handle combobox changes
  const handleClientChange = (value: string) => {
    if (!value) return;
    form.setValue("client_id", value);
  };

  const handleProprieteChange = (value: string) => {
    if (!value) return;
    form.setValue("propriete_id", value);
    handlePropertyChange(value);
  };

  const onSubmit = (data: SouscriptionFormData) => {
    mutation.mutate(data);
  };

  const watchedValues = form.watch();
  const selectedBareme = baremes?.find(b => b.type_bien === watchedValues.type_bien);

  // Handle immediate payment checkbox change
  const handlePaiementImmediatChange = (checked: boolean) => {
    form.setValue("paiement_immediat", checked);
    if (checked && watchedValues.montant_souscris) {
      form.setValue("apport_initial", watchedValues.montant_souscris);
    } else if (!checked) {
      form.setValue("apport_initial", "");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Client <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Combobox
                        options={clients || []}
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          handleClientChange(value);
                        }}
                        placeholder="Sélectionner un client"
                        searchPlaceholder="Rechercher un client..."
                        emptyText="Aucun client trouvé"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="propriete_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Propriété <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Combobox
                        options={proprietes || []}
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          handleProprieteChange(value);
                        }}
                        placeholder="Sélectionner une propriété"
                        searchPlaceholder="Rechercher une propriété..."
                        emptyText="Aucune propriété trouvée"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Détails financiers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="montant_souscris"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Montant souscris (FCFA) <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={watchedValues.propriete_id ? "Auto-rempli" : "Sélectionnez une propriété"}
                        readOnly={!!watchedValues.propriete_id}
                        className={watchedValues.propriete_id ? "bg-muted cursor-not-allowed" : ""}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="montant_droit_terre_mensuel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Droit de terre mensuel (FCFA)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={watchedValues.propriete_id ? "Auto-rempli" : "Sélectionnez une propriété"}
                        readOnly={!!watchedValues.propriete_id}
                        className={watchedValues.propriete_id ? "bg-muted cursor-not-allowed" : ""}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!souscription && (
              <FormField
                control={form.control}
                name="paiement_immediat"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          handlePaiementImmediatChange(checked as boolean);
                        }}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Paiement immédiat du montant total
                      </FormLabel>
                      <FormDescription>
                        Cocher cette case pour payer le montant total de la souscription immédiatement et déduire le montant de la caisse.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}

            {(watchedValues.apport_initial && parseFloat(watchedValues.apport_initial) > 0) || watchedValues.paiement_immediat ? (
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
                          { value: "virement", label: "Virement bancaire" },
                          { value: "mobile_money", label: "Mobile Money" },
                          { value: "carte_bancaire", label: "Carte bancaire" }
                        ]}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Sélectionner un mode de paiement"
                        buttonClassName="w-full justify-start"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="apport_initial"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apport initial (FCFA)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Montant de l'apport initial" 
                      readOnly={watchedValues.paiement_immediat}
                      className={watchedValues.paiement_immediat ? "bg-muted cursor-not-allowed" : ""}
                      {...field} 
                    />
                  </FormControl>
                  {watchedValues.paiement_immediat && (
                    <FormDescription>
                      Le montant est automatiquement défini au montant total de la souscription.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date_debut"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Date de début <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>


        <div className="flex justify-end gap-3 pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement..." : souscription ? "Modifier" : "Créer"} la souscription
          </Button>
        </div>
      </form>
    </Form>
  );
}