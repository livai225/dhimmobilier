import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ReceiptGenerator } from "@/utils/receiptGenerator";

interface SouscriptionFormProps {
  souscription?: any;
  onSuccess: () => void;
  baremes: any[];
}

export function SouscriptionForm({ souscription, onSuccess, baremes }: SouscriptionFormProps) {
  const [formData, setFormData] = useState({
    client_id: "",
    propriete_id: "",
    montant_souscris: "",
    montant_droit_terre_mensuel: "",
    apport_initial: "",
    date_debut: "",
    type_souscription: "classique",
    periode_finition_mois: "9",
    type_bien: "",
    statut: "active"
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

  // Function to handle property selection and auto-fill
  const handlePropertyChange = (proprieteId: string) => {
    const selectedPropriete = proprietes?.find(p => p.id === proprieteId);
    if (selectedPropriete) {
      setFormData({
        ...formData,
        propriete_id: proprieteId,
        montant_souscris: selectedPropriete.montant_bail?.toString() || "",
        montant_droit_terre_mensuel: selectedPropriete.droit_terre?.toString() || ""
      });
    } else {
      setFormData({
        ...formData,
        propriete_id: proprieteId
      });
    }
  };

  useEffect(() => {
    if (souscription) {
      setFormData({
        client_id: souscription.client_id || "",
        propriete_id: souscription.propriete_id || "",
        montant_souscris: souscription.montant_souscris?.toString() || souscription.prix_total?.toString() || "",
        montant_droit_terre_mensuel: souscription.montant_droit_terre_mensuel?.toString() || "",
        apport_initial: souscription.apport_initial?.toString() || "",
        date_debut: souscription.date_debut || "",
        type_souscription: souscription.type_souscription || "classique",
        periode_finition_mois: souscription.periode_finition_mois?.toString() || "9",
        type_bien: souscription.type_bien || "",
        statut: souscription.statut || "active"
      });
    }
  }, [souscription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = {
        ...formData,
        montant_souscris: parseFloat(formData.montant_souscris),
        prix_total: parseFloat(formData.montant_souscris), // Keep for backward compatibility
        montant_droit_terre_mensuel: parseFloat(formData.montant_droit_terre_mensuel) || 0,
        apport_initial: parseFloat(formData.apport_initial) || 0,
        periode_finition_mois: parseInt(formData.periode_finition_mois),
        solde_restant: parseFloat(formData.montant_souscris) - (parseFloat(formData.apport_initial) || 0),
        // Add these for compatibility - they will be null/0 for new submissions
        montant_mensuel: 0,
        nombre_mois: 0
      };

      // Update property status to "Occupé" when creating a new subscription
      if (!souscription && formData.propriete_id) {
        await supabase
          .from("proprietes")
          .update({ statut: "Occupé" })
          .eq("id", formData.propriete_id);
      }

      let result;
      let receipt = null;
      
      if (souscription) {
        result = await supabase
          .from("souscriptions")
          .update(data)
          .eq("id", souscription.id);
      } else {
        result = await supabase
          .from("souscriptions")
          .insert(data)
          .select()
          .single();
        
        // Generate receipt for initial payment if apport_initial > 0
        if (data.apport_initial > 0 && result.data) {
          receipt = await ReceiptGenerator.createReceipt({
            clientId: data.client_id,
            referenceId: result.data.id,
            typeOperation: "apport_souscription",
            montantTotal: data.apport_initial,
            periodeDebut: data.date_debut,
            datePaiement: data.date_debut
          });
        }
      }

      if (result.error) throw result.error;

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
    } catch (error) {
      console.error("Error saving souscription:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement",
        variant: "destructive",
      });
    }
  };

  const selectedBareme = baremes.find(b => b.type_bien === formData.type_bien);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client_id">Client *</Label>
              <Select value={formData.client_id} onValueChange={(value) => setFormData({...formData, client_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.prenom} {client.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="propriete_id">Propriété *</Label>
              <Select value={formData.propriete_id} onValueChange={handlePropertyChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une propriété" />
                </SelectTrigger>
                <SelectContent>
                  {proprietes?.map((propriete) => (
                    <SelectItem key={propriete.id} value={propriete.id}>
                      {propriete.nom} - {propriete.adresse}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Type de souscription *</Label>
            <RadioGroup 
              value={formData.type_souscription} 
              onValueChange={(value) => setFormData({...formData, type_souscription: value})}
              className="flex gap-6 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="classique" id="classique" />
                <Label htmlFor="classique">Classique</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mise_en_garde" id="mise_en_garde" />
                <Label htmlFor="mise_en_garde">Mise en garde</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Détails financiers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="montant_souscris">Montant souscris (FCFA) *</Label>
              <Input
                id="montant_souscris"
                type="number"
                value={formData.montant_souscris}
                onChange={(e) => setFormData({...formData, montant_souscris: e.target.value})}
                required
                readOnly={!!formData.propriete_id}
                className={formData.propriete_id ? "bg-muted cursor-not-allowed" : ""}
                placeholder="Sélectionnez une propriété"
              />
            </div>

            <div>
              <Label htmlFor="montant_droit_terre_mensuel">Droit de terre mensuel (FCFA)</Label>
              <Input
                id="montant_droit_terre_mensuel"
                type="number"
                value={formData.montant_droit_terre_mensuel}
                onChange={(e) => setFormData({...formData, montant_droit_terre_mensuel: e.target.value})}
                readOnly={!!formData.propriete_id}
                className={formData.propriete_id ? "bg-muted cursor-not-allowed" : ""}
                placeholder="Sélectionnez une propriété"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="apport_initial">Apport initial (FCFA)</Label>
            <Input
              id="apport_initial"
              type="number"
              value={formData.apport_initial}
              onChange={(e) => setFormData({...formData, apport_initial: e.target.value})}
            />
          </div>


          <div>
            <Label htmlFor="date_debut">Date de début *</Label>
            <Input
              id="date_debut"
              type="date"
              value={formData.date_debut}
              onChange={(e) => setFormData({...formData, date_debut: e.target.value})}
              required
            />
          </div>
        </CardContent>
      </Card>

      {formData.type_souscription === "mise_en_garde" && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration "Mise en garde"</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type_bien">Type de bien *</Label>
                <Select value={formData.type_bien} onValueChange={(value) => setFormData({...formData, type_bien: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le type" />
                  </SelectTrigger>
                  <SelectContent>
                    {baremes.map((bareme) => (
                      <SelectItem key={bareme.id} value={bareme.type_bien}>
                        {bareme.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="periode_finition_mois">Période de finition (mois)</Label>
                <Select value={formData.periode_finition_mois} onValueChange={(value) => setFormData({...formData, periode_finition_mois: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[9, 10, 11, 12].map((mois) => (
                      <SelectItem key={mois} value={mois.toString()}>
                        {mois} mois
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedBareme && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Informations calculées</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Droit de terre mensuel</p>
                    <p className="font-medium">{selectedBareme.montant_mensuel.toLocaleString()} FCFA</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total sur 20 ans</p>
                    <p className="font-medium">{(selectedBareme.montant_mensuel * 240).toLocaleString()} FCFA</p>
                  </div>
                  {formData.date_debut && (
                    <>
                      <div>
                        <p className="text-muted-foreground">Fin de finition prévue</p>
                        <p className="font-medium">
                          {format(
                            new Date(new Date(formData.date_debut).getTime() + parseInt(formData.periode_finition_mois) * 30 * 24 * 60 * 60 * 1000),
                            "dd/MM/yyyy"
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Début droit de terre</p>
                        <p className="font-medium">
                          {format(
                            new Date(new Date(formData.date_debut).getTime() + (parseInt(formData.periode_finition_mois) + 1) * 30 * 24 * 60 * 60 * 1000),
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

      <div className="flex justify-end gap-3">
        <Button type="submit">
          {souscription ? "Modifier" : "Créer"} la souscription
        </Button>
      </div>
    </form>
  );
}