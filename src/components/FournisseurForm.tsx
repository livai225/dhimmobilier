import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { useAuditLog } from "@/hooks/useAuditLog";
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
  numero_tva: z.string().optional(),
});

type FournisseurFormData = z.infer<typeof fournisseurSchema>;

interface FournisseurFormProps {
  fournisseur?: any;
  onSuccess: () => void;
}

export function FournisseurForm({ fournisseur, onSuccess }: FournisseurFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logCreate, logUpdate } = useAuditLog();
  const [isOtherSector, setIsOtherSector] = useState(false);
  const [isSeedingBtp, setIsSeedingBtp] = useState(false);
  
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
      numero_tva: fournisseur?.numero_tva || "",
    },
  });

  // Fetch sectors
  const { data: secteurs = [] } = useQuery({
    queryKey: ["secteurs"],
    queryFn: async () => {
      const data = await apiClient.select({
        table: "secteurs_activite",
        orderBy: { column: "nom", ascending: true }
      });
      return data;
    },
  });

  const btpSectors = [
    "Maçonnerie",
    "Électricité",
    "Plomberie",
    "Menuiserie",
    "Peinture",
    "Carrelage",
    "Charpente",
    "Couverture",
    "Climatisation",
    "Serrurerie",
    "Topographie",
    "Terrassement",
    "Génie civil",
    "Étanchéité",
    "Plâtrerie",
    "Vitrerie",
  ];

  const normalizeName = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  useEffect(() => {
    const seedBtpSectors = async () => {
      if (isSeedingBtp || !Array.isArray(secteurs)) return;
      const existing = new Set(secteurs.map((s: any) => normalizeName(s.nom || "")));
      const missing = btpSectors.filter((name) => !existing.has(normalizeName(name)));
      if (missing.length === 0) return;

      try {
        setIsSeedingBtp(true);
        await Promise.all(
          missing.map((name) =>
            apiClient.insert({
              table: "secteurs_activite",
              values: {
                nom: name,
                description: "Secteur BTP",
              },
            })
          )
        );
        queryClient.invalidateQueries({ queryKey: ["secteurs"] });
      } finally {
        setIsSeedingBtp(false);
      }
    };

    seedBtpSectors();
  }, [secteurs, isSeedingBtp, queryClient]);

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: FournisseurFormData) => {
      let secteurId = data.secteur_id;

      // Si "Autre" est sélectionné et qu'un secteur personnalisé est fourni, créer un nouveau secteur
      if (isOtherSector && data.secteur_custom?.trim()) {
        await apiClient.insert({
          table: "secteurs_activite",
          values: {
            nom: data.secteur_custom.trim(),
            description: `Secteur personnalisé: ${data.secteur_custom.trim()}`
          }
        });

        // Récupérer le nouveau secteur créé
        const secteurs = await apiClient.select({
          table: "secteurs_activite",
          filters: [{ op: "eq", column: "nom", value: data.secteur_custom.trim() }]
        });
        if (secteurs && secteurs.length > 0) {
          secteurId = secteurs[0].id;
        }
      }

      const cleanData = {
        nom: data.nom,
        secteur_id: secteurId,
        email: data.email || null,
        contact: data.contact || null,
        telephone: data.telephone || null,
        adresse: data.adresse || null,
        numero_tva: data.numero_tva || null,
      };

      if (fournisseur) {
        await apiClient.updateFournisseur(fournisseur.id, cleanData);
        return { isUpdate: true, data: cleanData, id: fournisseur.id };
      } else {
        await apiClient.createFournisseur(cleanData);
        // Récupérer le fournisseur créé
        const fournisseurs = await apiClient.select({
          table: "fournisseurs",
          filters: [{ op: "eq", column: "nom", value: data.nom }],
          orderBy: { column: "created_at", ascending: false },
          limit: 1
        });
        const newFournisseur = fournisseurs?.[0];
        return { isUpdate: false, data: newFournisseur, id: newFournisseur?.id };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["fournisseurs"] });
      queryClient.invalidateQueries({ queryKey: ["secteurs"] });
      
      // Log audit event
      if (result.isUpdate) {
        logUpdate('fournisseurs', result.id, fournisseur, result.data, `Modification du fournisseur ${result.data.nom}`);
      } else {
        logCreate('fournisseurs', result.id, result.data, `Création du fournisseur ${result.data.nom}`);
      }
      
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
