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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const souscriptionSchema = z.object({
  client_id: z.string().min(1, "Le client est obligatoire"),
  propriete_id: z.string().min(1, "La propriété est obligatoire"),
  montant_souscris: z.string().min(1, "Le montant souscris est obligatoire"),
  montant_droit_terre_mensuel: z.string().optional(),
  apport_initial: z.string().optional(),
  date_debut: z.string().min(1, "La date de début est obligatoire"),
  type_souscription: z.enum(["classique", "mise_en_garde"]),
  periode_finition_mois: z.string().optional(),
  type_bien: z.string().optional(),
  statut: z.string().default("active"),
}).refine((data) => {
  if (data.type_souscription === "mise_en_garde") {
    return data.type_bien && data.type_bien.length > 0;
  }
  return true;
}, {
  message: "Le type de bien est obligatoire pour une souscription 'mise en garde'",
  path: ["type_bien"],
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
      type_souscription: souscription?.type_souscription || "classique",
      periode_finition_mois: souscription?.periode_finition_mois?.toString() || "9",
      type_bien: souscription?.type_bien || "",
      statut: souscription?.statut || "active",
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, nom, prenom")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const { data: proprietes } = useQuery({
    queryKey: ["proprietes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proprietes")
        .select("id, nom, adresse, montant_bail, droit_terre")
        .eq("usage", "Bail")
        .eq("statut", "Libre")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: SouscriptionFormData) => {
      const processedData = {
        client_id: data.client_id,
        propriete_id: data.propriete_id,
        montant_souscris: parseFloat(data.montant_souscris),
        prix_total: parseFloat(data.montant_souscris), // Keep for backward compatibility
        montant_droit_terre_mensuel: parseFloat(data.montant_droit_terre_mensuel || "0"),
        apport_initial: parseFloat(data.apport_initial || "0"),
        periode_finition_mois: parseInt(data.periode_finition_mois || "9"),
        solde_restant: parseFloat(data.montant_souscris) - (parseFloat(data.apport_initial || "0")),
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
        
        // Generate receipt for initial payment if apport_initial > 0
        if (processedData.apport_initial > 0 && result.data) {
          receipt = await ReceiptGenerator.createReceipt({
            clientId: processedData.client_id,
            referenceId: result.data.id,
            typeOperation: "apport_souscription",
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
      const message = souscription 
        ? "Souscription modifiée avec succès" 
        : receipt 
          ? `Souscription créée avec succès. Reçu d'apport généré: ${receipt.numero}`
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
    const selectedPropriete = proprietes?.find(p => p.id === proprieteId);
    if (selectedPropriete) {
      form.setValue("propriete_id", proprieteId);
      form.setValue("montant_souscris", selectedPropriete.montant_bail?.toString() || "");
      form.setValue("montant_droit_terre_mensuel", selectedPropriete.droit_terre?.toString() || "");
    } else {
      form.setValue("propriete_id", proprieteId);
    }
  };

  const onSubmit = (data: SouscriptionFormData) => {
    mutation.mutate(data);
  };

  const watchedValues = form.watch();
  const selectedBareme = baremes.find(b => b.type_bien === watchedValues.type_bien);

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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.prenom} {client.nom}
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
                name="propriete_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Propriété <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={handlePropertyChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une propriété" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {proprietes?.map((propriete) => (
                          <SelectItem key={propriete.id} value={propriete.id}>
                            {propriete.nom} - {propriete.adresse}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="type_souscription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Type de souscription <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <RadioGroup 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      className="flex gap-6 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="classique" id="classique" />
                        <label htmlFor="classique">Classique</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mise_en_garde" id="mise_en_garde" />
                        <label htmlFor="mise_en_garde">Mise en garde</label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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

            <FormField
              control={form.control}
              name="apport_initial"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apport initial (FCFA)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Montant de l'apport initial" {...field} />
                  </FormControl>
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

        {watchedValues.type_souscription === "mise_en_garde" && (
          <Card>
            <CardHeader>
              <CardTitle>Configuration "Mise en garde"</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type_bien"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Type de bien <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner le type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {baremes.map((bareme) => (
                            <SelectItem key={bareme.id} value={bareme.type_bien}>
                              {bareme.description}
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
                  name="periode_finition_mois"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Période de finition (mois)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[9, 10, 11, 12].map((mois) => (
                            <SelectItem key={mois} value={mois.toString()}>
                              {mois} mois
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {selectedBareme && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Informations calculées</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Droit de terre mensuel</p>
                      <p className="font-medium">{selectedBareme.montant_mensuel.toLocaleString()} FCFA</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total sur 20 ans</p>
                      <p className="font-medium">{(selectedBareme.montant_mensuel * 240).toLocaleString()} FCFA</p>
                    </div>
                    {watchedValues.date_debut && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Fin de finition prévue</p>
                          <p className="font-medium">
                            {format(
                              new Date(new Date(watchedValues.date_debut).getTime() + parseInt(watchedValues.periode_finition_mois || "9") * 30 * 24 * 60 * 60 * 1000),
                              "dd/MM/yyyy"
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Début droit de terre</p>
                          <p className="font-medium">
                            {format(
                              new Date(new Date(watchedValues.date_debut).getTime() + (parseInt(watchedValues.periode_finition_mois || "9") + 1) * 30 * 24 * 60 * 60 * 1000),
                              "dd/MM/yyyy"
                            )}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement..." : souscription ? "Modifier" : "Créer"} la souscription
          </Button>
        </div>
      </form>
    </Form>
  );
}