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

interface SouscriptionFormProps {
  souscription?: any;
  onSuccess: () => void;
  baremes: any[];
}

export function SouscriptionForm({ souscription, onSuccess, baremes }: SouscriptionFormProps) {
  const [formData, setFormData] = useState({
    client_id: "",
    propriete_id: "",
    prix_total: "",
    apport_initial: "",
    montant_mensuel: "",
    nombre_mois: "",
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
        .select("id, nom, adresse")
        .eq("statut", "Libre")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (souscription) {
      setFormData({
        client_id: souscription.client_id || "",
        propriete_id: souscription.propriete_id || "",
        prix_total: souscription.prix_total?.toString() || "",
        apport_initial: souscription.apport_initial?.toString() || "",
        montant_mensuel: souscription.montant_mensuel?.toString() || "",
        nombre_mois: souscription.nombre_mois?.toString() || "",
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
        prix_total: parseFloat(formData.prix_total),
        apport_initial: parseFloat(formData.apport_initial) || 0,
        montant_mensuel: parseFloat(formData.montant_mensuel) || 0,
        nombre_mois: parseInt(formData.nombre_mois) || 0,
        periode_finition_mois: parseInt(formData.periode_finition_mois),
        solde_restant: parseFloat(formData.prix_total) - (parseFloat(formData.apport_initial) || 0)
      };

      let result;
      if (souscription) {
        result = await supabase
          .from("souscriptions")
          .update(data)
          .eq("id", souscription.id);
      } else {
        result = await supabase
          .from("souscriptions")
          .insert(data);
      }

      if (result.error) throw result.error;

      toast({
        title: "Succès",
        description: souscription ? "Souscription modifiée avec succès" : "Souscription créée avec succès",
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
              <Select value={formData.propriete_id} onValueChange={(value) => setFormData({...formData, propriete_id: value})}>
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
              <Label htmlFor="prix_total">Prix total (FCFA) *</Label>
              <Input
                id="prix_total"
                type="number"
                value={formData.prix_total}
                onChange={(e) => setFormData({...formData, prix_total: e.target.value})}
                required
              />
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
          </div>

          {formData.type_souscription === "classique" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="montant_mensuel">Montant mensuel (FCFA)</Label>
                <Input
                  id="montant_mensuel"
                  type="number"
                  value={formData.montant_mensuel}
                  onChange={(e) => setFormData({...formData, montant_mensuel: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="nombre_mois">Nombre de mois</Label>
                <Input
                  id="nombre_mois"
                  type="number"
                  value={formData.nombre_mois}
                  onChange={(e) => setFormData({...formData, nombre_mois: e.target.value})}
                />
              </div>
            </div>
          )}

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