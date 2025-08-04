import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const propertySchema = z.object({
  nom: z.string().min(1, "Le nom est obligatoire"),
  adresse: z.string().optional(),
  type_id: z.string().optional(),
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

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      nom: property?.nom || "",
      adresse: property?.adresse || "",
      type_id: property?.type_id || "",
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
      const { data, error } = await supabase
        .from('types_proprietes')
        .select('*')
        .order('nom');
      if (error) throw error;
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
        statut: data.statut,
        zone: data.zone || null,
        usage: data.usage,
        loyer_mensuel: data.loyer_mensuel ? parseFloat(data.loyer_mensuel) : 0,
        montant_bail: data.montant_bail ? parseFloat(data.montant_bail) : 0,
        droit_terre: data.droit_terre ? parseFloat(data.droit_terre) : 0,
      };

      if (property) {
        const { error } = await supabase
          .from("proprietes")
          .update(processedData)
          .eq("id", property.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("proprietes")
          .insert([processedData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proprietes"] });
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="type_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de propriété</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {typesProprietes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Libre">Libre</SelectItem>
                    <SelectItem value="Occupé">Occupé</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un usage" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Location">Location</SelectItem>
                    <SelectItem value="Bail">Bail</SelectItem>
                  </SelectContent>
                </Select>
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