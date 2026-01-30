import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

const propertySchema = z.object({
  nom: z.string().min(1, "Le nom est obligatoire"),
  adresse: z.string().optional(),
  type_id: z.string().optional(),
  agent_id: z.string().optional(),
  surface: z.string().optional(),
  prix_achat: z.string().optional(),
  statut: z.string().min(1, "Le statut est obligatoire"),
  zone: z.string().optional(),
  usage: z.string().min(1, "L'usage est obligatoire"),
  loyer_mensuel: z.string().optional(),
  montant_bail: z.string().optional(),
  droit_terre: z.string().optional(),
});

type PropertyFormData = z.infer<typeof propertySchema>;

interface PropertyFormProps {
  property?: any;
  onSuccess: () => void;
}

export function PropertyForm({ property, onSuccess }: PropertyFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logCreate, logUpdate } = useAuditLog();

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      nom: property?.nom || "",
      adresse: property?.adresse || "",
      type_id: property?.type_id || "",
      agent_id: property?.agent_id || "",
      surface: property?.surface?.toString() || "",
      prix_achat: property?.prix_achat?.toString() || "",
      statut: property?.statut || "Libre",
      zone: property?.zone || "",
      usage: property?.usage || "Location",
      loyer_mensuel: property?.loyer_mensuel?.toString() || "",
      montant_bail: property?.montant_bail?.toString() || "",
      droit_terre: property?.droit_terre?.toString() || "",
    },
  });

  const { data: typesProprietes = [] } = useQuery({
    queryKey: ['types-proprietes'],
    queryFn: async () => {
      const data = await apiClient.getTypesProprietes();
      return data || [];
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-recouvrement'],
    queryFn: async () => {
      const data = await apiClient.select({
        table: "agents_recouvrement",
        filters: [{ op: "eq", column: "statut", value: "actif" }],
        orderBy: { column: "nom", ascending: true }
      });
      return data || [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PropertyFormData) => {
      const processedData = {
        nom: data.nom,
        adresse: data.adresse || null,
        surface: data.surface ? parseFloat(data.surface) : null,
        prix_achat: data.prix_achat ? parseFloat(data.prix_achat) : null,
        type_id: data.type_id || null,
        agent_id: data.agent_id || null,
        statut: data.statut,
        zone: data.zone || null,
        usage: data.usage,
        loyer_mensuel: data.loyer_mensuel ? parseFloat(data.loyer_mensuel) : 0,
        montant_bail: data.montant_bail ? parseFloat(data.montant_bail) : 0,
        droit_terre: data.droit_terre ? parseFloat(data.droit_terre) : 0,
      };

      if (property) {
        await apiClient.updatePropriete(property.id, processedData);
        return { isUpdate: true, data: processedData, id: property.id };
      } else {
        await apiClient.createPropriete(processedData);
        // Récupérer la propriété créée
        const proprietes = await apiClient.select({
          table: "proprietes",
          filters: [{ op: "eq", column: "nom", value: data.nom }],
          orderBy: { column: "created_at", ascending: false },
          limit: 1
        });
        const newProperty = proprietes?.[0];
        return { isUpdate: false, data: newProperty, id: newProperty?.id };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["proprietes"] });
      
      // Log audit event
      if (result.isUpdate) {
        logUpdate('proprietes', result.id, property, result.data, `Modification de la propriété ${result.data.nom}`);
      } else {
        logCreate('proprietes', result.id, result.data, `Création de la propriété ${result.data.nom}`);
      }
      
      toast({
        title: "Succès",
        description: property ? "Propriété modifiée avec succès" : "Propriété créée avec succès",
      });
      onSuccess();
    },
    onError: (error) => {
      console.error("Error saving property:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PropertyFormData) => {
    mutation.mutate(data);
  };

  const selectedUsage = form.watch("usage");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Nom <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Nom de la propriété" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="zone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zone</FormLabel>
                <FormControl>
                  <Input placeholder="Zone géographique" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="adresse"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Adresse complète de la propriété"
                  className="min-h-[80px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="type_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de propriété</FormLabel>
                <FormControl>
                  <Combobox
                    options={typesProprietes?.map(type => ({
                      value: type.id,
                      label: type.nom
                    })) || []}
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Sélectionner un type"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="agent_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agent de recouvrement</FormLabel>
                <FormControl>
                  <Combobox
                    options={agents?.map(agent => ({
                      value: agent.id,
                      label: `${agent.prenom} ${agent.nom}`.trim()
                    })) || []}
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Sélectionner un agent"
                  />
                </FormControl>
                <FormDescription>
                  Agent responsable du recouvrement des loyers et droits de terre
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="statut"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Statut <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Combobox
                    options={[
                      { value: "Libre", label: "Libre" },
                      { value: "Occupé", label: "Occupé" },
                      { value: "Maintenance", label: "Maintenance" }
                    ]}
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Sélectionner un statut"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="usage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Usage <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Combobox
                    options={[
                      { value: "Location", label: "Location" },
                      { value: "Bail", label: "Bail" }
                    ]}
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Sélectionner un usage"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="surface"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Surface (m²)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Surface en mètres carrés" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {property && (
            <FormField
              control={form.control}
              name="prix_achat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prix d'achat (FCFA)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Prix d'achat de la propriété" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Visible uniquement lors de la modification
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {selectedUsage === "Location" && (
          <FormField
            control={form.control}
            name="loyer_mensuel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Loyer mensuel (FCFA)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Montant du loyer mensuel" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {selectedUsage === "Bail" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="montant_bail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant du bail (FCFA)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Montant total du bail" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="droit_terre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Droit de terre mensuel (FCFA)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Montant mensuel du droit de terre" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement..." : property ? "Modifier" : "Créer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}