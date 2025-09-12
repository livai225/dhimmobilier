import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const phoneSchema = z
  .string()
  .trim()
  .min(8, "Numéro trop court")
  .max(25, "Numéro trop long")
  .regex(/^[+0-9()\-\s]*$/, "Caractères non autorisés")
  .optional()
  .or(z.literal(""));

const clientSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire"),
  prenom: z.string().trim().optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Email invalide")
    .optional()
    .or(z.literal("")),
  telephone_principal: phoneSchema,
  telephone_secondaire_1: phoneSchema,
  telephone_secondaire_2: phoneSchema,
  adresse: z.string().trim().optional().or(z.literal("")),
  contact_urgence_nom: z.string().trim().optional().or(z.literal("")),
  contact_urgence_telephone: phoneSchema,
  contact_urgence_relation: z.string().trim().optional().or(z.literal("")),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormProps {
  client?: any;
  onSuccess: () => void;
}

export function ClientForm({ client, onSuccess }: ClientFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      nom: client?.nom || "",
      prenom: client?.prenom || "",
      email: client?.email || "",
      telephone_principal: client?.telephone_principal || "",
      telephone_secondaire_1: client?.telephone_secondaire_1 || "",
      telephone_secondaire_2: client?.telephone_secondaire_2 || "",
      adresse: client?.adresse || "",
      contact_urgence_nom: client?.contact_urgence_nom || "",
      contact_urgence_telephone: client?.contact_urgence_telephone || "",
      contact_urgence_relation: client?.contact_urgence_relation || "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      // Clean data - trim + convert empty strings to null pour les champs optionnels
      const cleanData = {
        nom: data.nom?.trim(),
        prenom: data.prenom?.trim() || null,
        email: data.email?.trim() || null,
        telephone_principal: data.telephone_principal?.trim() || null,
        telephone_secondaire_1: data.telephone_secondaire_1?.trim() || null,
        telephone_secondaire_2: data.telephone_secondaire_2?.trim() || null,
        adresse: data.adresse?.trim() || null,
        contact_urgence_nom: data.contact_urgence_nom?.trim() || null,
        contact_urgence_telephone: data.contact_urgence_telephone?.trim() || null,
        contact_urgence_relation: data.contact_urgence_relation?.trim() || null,
      };

      if (client) {
        const { error } = await supabase
          .from("clients")
          .update(cleanData)
          .eq("id", client.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("clients")
          .insert([cleanData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({
        title: "Succès",
        description: client ? "Client modifié avec succès" : "Client créé avec succès",
      });
      onSuccess();
    },
    onError: (error) => {
      console.error("Error saving client:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ClientFormData) => {
    mutation.mutate(data);
  };

  // Formatage simple des numéros (trim espaces multiples)
  const normalizePhone = (val?: string) =>
    (val || "")
      .replace(/\s+/g, " ")
      .trim();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Informations de base</TabsTrigger>
            <TabsTrigger value="contact">Contact d'urgence</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
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
                      <Input placeholder="Nom du client" autoFocus={!client} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prenom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom</FormLabel>
                    <FormControl>
                      <Input placeholder="Prénom du client" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      inputMode="email"
                      placeholder="client@exemple.com"
                      {...field}
                      onBlur={(e) => form.setValue("email", e.target.value.trim())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <FormLabel className="text-base font-medium">Numéros de téléphone</FormLabel>
                <FormDescription>
                  Ajoutez les numéros de téléphone du client. Le téléphone principal est recommandé.
                </FormDescription>
              </div>

              <FormField
                control={form.control}
                name="telephone_principal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone principal</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: +225 01 23 45 67 89"
                        inputMode="tel"
                        {...field}
                        onBlur={(e) => form.setValue("telephone_principal", normalizePhone(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="telephone_secondaire_1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone secondaire 1 (optionnel)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: +225 01 23 45 67 89"
                          inputMode="tel"
                          {...field}
                          onBlur={(e) => form.setValue("telephone_secondaire_1", normalizePhone(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telephone_secondaire_2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone secondaire 2 (optionnel)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: +225 01 23 45 67 89" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="adresse"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Adresse complète du client"
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <div className="space-y-2">
              <FormLabel className="text-base font-medium">Contact d'urgence</FormLabel>
              <FormDescription>
                Informations du contact à joindre en cas d'urgence (optionnel)
              </FormDescription>
            </div>

            <FormField
              control={form.control}
              name="contact_urgence_nom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du contact d'urgence</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom et prénom" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact_urgence_telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone du contact d'urgence</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: +225 01 23 45 67 89" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_urgence_relation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relation</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: Époux/se, Parent, Ami(e)" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement..." : client ? "Modifier" : "Créer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}