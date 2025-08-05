import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
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
import { useToast } from "@/hooks/use-toast";

const fournisseurSchema = z.object({
  nom: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  contact: z.string().optional(),
  telephone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  adresse: z.string().optional(),
  secteur_id: z.string().min(1, "Veuillez sélectionner un secteur"),
  secteur_custom: z.string().optional(),
  site_web: z.string().url("URL invalide").optional().or(z.literal("")),
  numero_tva: z.string().optional(),
  note_performance: z.number().min(1).max(5).optional(),
});

type FournisseurFormData = z.infer<typeof fournisseurSchema>;

interface FournisseurFormProps {
  fournisseur?: any;
  onSuccess: () => void;
}

export function FournisseurForm({ fournisseur, onSuccess }: FournisseurFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOtherSector, setIsOtherSector] = useState(false);
  
  const form = useForm<FournisseurFormData>({
    resolver: zodResolver(fournisseurSchema),
    defaultValues: {
      nom: fournisseur?.nom || "",
      contact: fournisseur?.contact || "",
      telephone: fournisseur?.telephone || "",
      email: fournisseur?.email || "",
      adresse: fournisseur?.adresse || "",
      secteur_id: fournisseur?.secteur_id || "",
      secteur_custom: "",
      site_web: fournisseur?.site_web || "",
      numero_tva: fournisseur?.numero_tva || "",
      note_performance: fournisseur?.note_performance || undefined,
    },
  });

  // Fetch sectors
  const { data: secteurs = [] } = useQuery({
    queryKey: ["secteurs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("secteurs_activite")
        .select("*")
        .order("nom");
      
      if (error) throw error;
      return data;
    },
  });

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: FournisseurFormData) => {
      let secteurId = data.secteur_id;
      
      // Si "Autre" est sélectionné et qu'un secteur personnalisé est fourni, créer un nouveau secteur
      if (isOtherSector && data.secteur_custom?.trim()) {
        const { data: newSecteur, error: secteurError } = await supabase
          .from("secteurs_activite")
          .insert({
            nom: data.secteur_custom.trim(),
            description: `Secteur personnalisé: ${data.secteur_custom.trim()}`
          })
          .select()
          .single();
        
        if (secteurError) throw secteurError;
        secteurId = newSecteur.id;
      }

      const cleanData = {
        nom: data.nom,
        secteur_id: secteurId,
        email: data.email || null,
        site_web: data.site_web || null,
        contact: data.contact || null,
        telephone: data.telephone || null,
        adresse: data.adresse || null,
        numero_tva: data.numero_tva || null,
        note_performance: data.note_performance || null,
      };

      if (fournisseur) {
        const { error } = await supabase
          .from("fournisseurs")
          .update(cleanData)
          .eq("id", fournisseur.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fournisseurs")
          .insert(cleanData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fournisseurs"] });
      queryClient.invalidateQueries({ queryKey: ["secteurs"] }); // Invalider aussi les secteurs
      toast({
        title: "Succès",
        description: fournisseur 
          ? "Fournisseur modifié avec succès"
          : "Fournisseur créé avec succès",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FournisseurFormData) => {
    // Validation spéciale pour le secteur "Autre"
    if (isOtherSector && !data.secteur_custom?.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez spécifier le secteur d'activité",
        variant: "destructive",
      });
      return;
    }
    
    mutation.mutate(data);
  };

  // Fonction pour gérer le changement de secteur
  const handleSectorChange = (value: string) => {
    const autreId = "79f144be-26d6-4479-8417-eb1788d06b4c"; // ID du secteur "Autre"
    setIsOtherSector(value === autreId);
    form.setValue("secteur_id", value);
    if (value !== autreId) {
      form.setValue("secteur_custom", "");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="secteur_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Secteur d'activité *</FormLabel>
                <Select onValueChange={handleSectorChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un secteur" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {secteurs.map((secteur) => (
                      <SelectItem key={secteur.id} value={secteur.id}>
                        {secteur.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {isOtherSector && (
            <FormField
              control={form.control}
              name="secteur_custom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Préciser le secteur d'activité *</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Précisez le secteur d'activité"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contact"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Personne de contact</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="telephone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Téléphone</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="site_web"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Site web</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} />
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
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="numero_tva"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro TVA</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="note_performance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note de performance (1-5)</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                  defaultValue={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une note" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">1 - Médiocre</SelectItem>
                    <SelectItem value="2">2 - Insuffisant</SelectItem>
                    <SelectItem value="3">3 - Correct</SelectItem>
                    <SelectItem value="4">4 - Bon</SelectItem>
                    <SelectItem value="5">5 - Excellent</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onSuccess}>
            Annuler
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}