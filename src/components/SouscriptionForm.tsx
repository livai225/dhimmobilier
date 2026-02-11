import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

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

  // État pour la recherche de clients
  const [clientSearchTerm, setClientSearchTerm] = React.useState("");
  
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Array<Client & { label: string; value: string }>>({
    queryKey: ["clients", clientSearchTerm],
    queryFn: async () => {
      const filters: any[] = [];
      if (clientSearchTerm.trim()) {
        filters.push({ op: 'or', filters: [
          { op: 'ilike', column: 'nom', value: `%${clientSearchTerm}%` },
          { op: 'ilike', column: 'prenom', value: `%${clientSearchTerm}%` }
        ]});
      }
      const data: Client[] = await apiClient.select({
        table: 'clients',
        columns: 'id, nom, prenom',
        filters,
        orderBy: { column: 'nom', ascending: true }
      });

      console.log(`Clients chargés: ${data?.length || 0} (recherche: "${clientSearchTerm}")`);

      return data.map(client => ({
        ...client,
        label: `${client.prenom} ${client.nom}`,
        value: client.id
      }));
    },
    enabled: true,
  });

  interface Propriete {
    id: string;
    nom: string;
    adresse: string;
    montant_bail: number;
    droit_terre: number;
  }

  const { data: proprietes = [] } = useQuery<Array<Propriete & { label: string; value: string }>>({
    queryKey: ["proprietes", "bail", "libre", souscription?.id],
    queryFn: async () => {
      const filters: any[] = [{ op: 'eq', column: 'usage', value: 'Bail' }];
      if (souscription?.propriete_id) {
        filters.push({ op: 'or', filters: [
          { op: 'eq', column: 'statut', value: 'Libre' },
          { op: 'eq', column: 'id', value: souscription.propriete_id }
        ]});
      } else {
        filters.push({ op: 'eq', column: 'statut', value: 'Libre' });
      }
      const data: Propriete[] = await apiClient.select({
        table: 'proprietes',
        columns: 'id, nom, adresse, montant_bail, droit_terre',
        filters,
        orderBy: { column: 'nom', ascending: true }
      });

      return data.map(propriete => ({
        ...propriete,
        label: propriete.nom,
        value: propriete.id
      }));
    },
  });

  // Synchroniser les valeurs des comboboxes en mode édition
  React.useEffect(() => {
    if (souscription && clients.length > 0 && proprietes.length > 0) {
      // S'assurer que les valeurs sont bien définies dans le formulaire
      if (souscription.client_id && !form.getValues("client_id")) {
        form.setValue("client_id", souscription.client_id);
      }
      if (souscription.propriete_id && !form.getValues("propriete_id")) {
        form.setValue("propriete_id", souscription.propriete_id);
      }
    }
  }, [souscription, form, clients, proprietes]);

  const mutation = useMutation({
    mutationFn: async (data: SouscriptionFormData) => {
      // Handle immediate payment logic
      const apportAmount = data.paiement_immediat 
        ? parseFloat(data.montant_souscris) 
        : parseFloat(data.apport_initial || "0");


      const processedData = {
        client_id: data.client_id,
        propriete_id: data.propriete_id,
        montant_souscris: parseFloat(data.montant_souscris),
        prix_total: parseFloat(data.montant_souscris), // Keep for backward compatibility
        montant_droit_terre_mensuel: parseFloat(data.montant_droit_terre_mensuel || "0"),
        apport_initial: 0, // Don't store in subscription record to avoid double counting
        periode_finition_mois: parseInt(data.periode_finition_mois || "9"),
        solde_restant: data.paiement_immediat ? 0 : parseFloat(data.montant_souscris) - apportAmount,
        date_debut: new Date(data.date_debut).toISOString(),
        type_souscription: data.type_souscription,
        type_bien: data.type_bien || null,
        statut: data.statut,
        // Add these for compatibility
        montant_mensuel: 0,
        nombre_mois: 0
      };

      // Update property status to "Occupé" when creating a new subscription
      if (!souscription && data.propriete_id) {
        await apiClient.update({
          table: 'proprietes',
          values: { statut: 'Occupé' },
          filters: [{ op: 'eq', column: 'id', value: data.propriete_id }]
        });
      }

      let resultData: any = null;
      let receipt = null;

      if (souscription) {
        await apiClient.update({
          table: 'souscriptions',
          values: processedData,
          filters: [{ op: 'eq', column: 'id', value: souscription.id }]
        });
        resultData = { id: souscription.id };
      } else {
        await apiClient.insert({
          table: 'souscriptions',
          values: processedData
        });
        const latest = await apiClient.select({
          table: 'souscriptions',
          filters: [
            { op: 'eq', column: 'client_id', value: processedData.client_id },
            { op: 'eq', column: 'propriete_id', value: processedData.propriete_id },
            { op: 'eq', column: 'date_debut', value: processedData.date_debut }
          ],
          orderBy: { column: 'created_at', ascending: false },
          limit: 1
        });
        const created = latest?.[0];
        if (!created?.id) {
          throw new Error("Impossible de récupérer la souscription créée.");
        }
        resultData = { id: created.id };

        // Enregistrer le paiement via la fonction RPC pour déduire la caisse
        if (apportAmount > 0 && resultData?.id) {
          const description = data.paiement_immediat
            ? 'Paiement intégral de souscription'
            : 'Apport initial pour souscription';

          await apiClient.rpc('pay_souscription_with_cash', {
            souscription_id: resultData.id,
            montant: apportAmount,
            date_paiement: processedData.date_debut,
            mode_paiement: data.mode_paiement || 'especes',
            reference: `${description} - ${resultData.id}`,
            description: description,
          });

          // Le reçu sera généré automatiquement par trigger
        }
      }

      return { result: { data: resultData }, receipt };
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["souscriptions"] });
        queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
        queryClient.invalidateQueries({ queryKey: ["cash_balance"] });
      queryClient.invalidateQueries({ queryKey: ["recus"] });
      const message = souscription 
        ? "Souscription modifiée avec succès" 
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
    
    // En mode édition, ne pas écraser les valeurs existantes avec l'auto-remplissage
    if (souscription) {
      form.setValue("propriete_id", proprieteId);
      return;
    }
    
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
                        onSearchChange={setClientSearchTerm}
                        isLoading={clientsLoading}
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
                        placeholder={watchedValues.propriete_id && !souscription ? "Auto-rempli" : "Montant souscris"}
                        readOnly={!!watchedValues.propriete_id && !souscription}
                        className={watchedValues.propriete_id && !souscription ? "bg-muted cursor-not-allowed" : ""}
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
                        placeholder={watchedValues.propriete_id && !souscription ? "Auto-rempli" : "Montant droit de terre"}
                        readOnly={false}
                        className=""
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
