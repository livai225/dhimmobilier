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

const factureSchema = z.object({
  numero: z.string().min(1, "Le numéro de facture est requis"),
  fournisseur_id: z.string().min(1, "Veuillez sélectionner un fournisseur"),
  propriete_id: z.string().optional(),
  date_facture: z.string().min(1, "La date est requise"),
  montant_total: z.number().min(0.01, "Le montant doit être supérieur à 0"),
  description: z.string().optional(),
});

type FactureFormData = z.infer<typeof factureSchema>;

interface FactureFormProps {
  facture?: any;
  onSuccess: () => void;
}

export function FactureForm({ facture, onSuccess }: FactureFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<FactureFormData>({
    resolver: zodResolver(factureSchema),
    defaultValues: {
      numero: facture?.numero || "",
      fournisseur_id: facture?.fournisseur_id || "",
      propriete_id: facture?.propriete_id || "",
      date_facture: facture?.date_facture || new Date().toISOString().split('T')[0],
      montant_total: facture?.montant_total || 0,
      description: facture?.description || "",
    },
  });

  // Fetch suppliers
  const { data: fournisseurs = [] } = useQuery({
    queryKey: ["fournisseurs-form"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fournisseurs")
        .select("id, nom")
        .order("nom");
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch properties
  const { data: proprietes = [] } = useQuery({
    queryKey: ["proprietes-form"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proprietes")
        .select("id, nom")
        .order("nom");
      
      if (error) throw error;
      return data;
    },
  });

  // Generate invoice number if not provided
  const generateNumero = async () => {
    const { data, error } = await supabase.rpc('generate_facture_number');
    if (!error && data) {
      form.setValue('numero', data);
    }
  };

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: FactureFormData) => {
      const cleanData = {
        numero: data.numero,
        fournisseur_id: data.fournisseur_id,
        propriete_id: data.propriete_id || null,
        date_facture: data.date_facture,
        montant_total: data.montant_total,
        description: data.description || null,
        montant_paye: 0,
        solde: data.montant_total,
      };

      if (facture) {
        // For updates, preserve existing payment amounts
        const { error } = await supabase
          .from("factures_fournisseurs")
          .update({
            numero: cleanData.numero,
            fournisseur_id: cleanData.fournisseur_id,
            propriete_id: cleanData.propriete_id,
            date_facture: cleanData.date_facture,
            montant_total: cleanData.montant_total,
            description: cleanData.description,
          })
          .eq("id", facture.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("factures_fournisseurs")
          .insert(cleanData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["factures"] });
      toast({
        title: "Succès",
        description: facture 
          ? "Facture modifiée avec succès"
          : "Facture créée avec succès",
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

  const onSubmit = (data: FactureFormData) => {
    mutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="numero"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro de facture *</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  {!facture && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={generateNumero}
                      size="sm"
                    >
                      Auto
                    </Button>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fournisseur_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fournisseur *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un fournisseur" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {fournisseurs.map((fournisseur) => (
                      <SelectItem key={fournisseur.id} value={fournisseur.id}>
                        {fournisseur.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="propriete_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Propriété (optionnel)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une propriété" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">Aucune propriété</SelectItem>
                    {proprietes.map((propriete) => (
                      <SelectItem key={propriete.id} value={propriete.id}>
                        {propriete.nom}
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
            name="date_facture"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de facture *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="montant_total"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Montant total (FCFA) *</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min="0" 
                  step="1"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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