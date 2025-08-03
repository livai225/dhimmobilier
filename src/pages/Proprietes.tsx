import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PropertyDetailsDialog } from "@/components/PropertyDetailsDialog";

interface Propriete {
  id: string;
  nom: string;
  adresse?: string;
  type_id?: string;
  surface?: number;
  prix_achat?: number;
  statut?: string;
  zone?: string;
  usage?: string;
  loyer_mensuel?: number;
  montant_bail?: number;
  droit_terre?: number;
}

interface TypePropriete {
  id: string;
  nom: string;
  description?: string;
}

export default function Proprietes() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPropriete, setEditingPropriete] = useState<Propriete | null>(null);
  const [formData, setFormData] = useState({
    nom: "",
    adresse: "",
    type_id: "",
    surface: "",
    prix_achat: "", // Gardé pour l'édition uniquement
    statut: "Libre",
    zone: "",
    usage: "Location",
    loyer_mensuel: "",
    montant_bail: "",
    droit_terre: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: proprietes, isLoading } = useQuery({
    queryKey: ['proprietes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proprietes')
        .select(`
          *,
          types_proprietes (
            id,
            nom,
            description
          )
        `)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: typesProprietes = [] } = useQuery({
    queryKey: ['types-proprietes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('types_proprietes').select('*').order('nom');
      if (error) {
        console.error('Erreur lors du chargement des types:', error);
        throw error;
      }
      console.log('Types propriétés chargés:', data);
      return data || [];
    },
  });

  const createPropriete = useMutation({
    mutationFn: async (proprieteData: typeof formData) => {
      const processedData = {
        nom: proprieteData.nom,
        adresse: proprieteData.adresse || null,
        surface: proprieteData.surface ? parseFloat(proprieteData.surface) : null,
        // prix_achat retiré pour la création
        type_id: proprieteData.type_id || null,
        statut: proprieteData.statut,
        zone: proprieteData.zone || null,
        usage: proprieteData.usage,
        loyer_mensuel: proprieteData.loyer_mensuel ? parseFloat(proprieteData.loyer_mensuel) : 0,
        montant_bail: proprieteData.montant_bail ? parseFloat(proprieteData.montant_bail) : 0,
        droit_terre: proprieteData.droit_terre ? parseFloat(proprieteData.droit_terre) : 0,
      };
      const { data, error } = await supabase.from('proprietes').insert([processedData]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proprietes'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Propriété créée",
        description: "La propriété a été créée avec succès.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la propriété.",
        variant: "destructive",
      });
    },
  });

  const updatePropriete = useMutation({
    mutationFn: async ({ id, ...proprieteData }: { id: string } & typeof formData) => {
      const processedData = {
        nom: proprieteData.nom,
        adresse: proprieteData.adresse || null,
        surface: proprieteData.surface ? parseFloat(proprieteData.surface) : null,
        prix_achat: proprieteData.prix_achat ? parseFloat(proprieteData.prix_achat) : null,
        type_id: proprieteData.type_id || null,
        statut: proprieteData.statut,
        zone: proprieteData.zone || null,
        usage: proprieteData.usage,
        loyer_mensuel: proprieteData.loyer_mensuel ? parseFloat(proprieteData.loyer_mensuel) : 0,
        montant_bail: proprieteData.montant_bail ? parseFloat(proprieteData.montant_bail) : 0,
        droit_terre: proprieteData.droit_terre ? parseFloat(proprieteData.droit_terre) : 0,
      };
      const { data, error } = await supabase.from('proprietes').update(processedData).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proprietes'] });
      setIsDialogOpen(false);
      resetForm();
      setEditingPropriete(null);
      toast({
        title: "Propriété modifiée",
        description: "La propriété a été modifiée avec succès.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier la propriété.",
        variant: "destructive",
      });
    },
  });

  const deletePropriete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('proprietes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proprietes'] });
      toast({
        title: "Propriété supprimée",
        description: "La propriété a été supprimée avec succès.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la propriété.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      nom: "",
      adresse: "",
      type_id: "",
      surface: "",
      prix_achat: "",
      statut: "Libre",
      zone: "",
      usage: "Location",
      loyer_mensuel: "",
      montant_bail: "",
      droit_terre: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPropriete) {
      updatePropriete.mutate({ id: editingPropriete.id, ...formData });
    } else {
      createPropriete.mutate(formData);
    }
  };

  const handleEdit = (propriete: any) => {
    setEditingPropriete(propriete);
    setFormData({
      nom: propriete.nom,
      adresse: propriete.adresse || "",
      type_id: propriete.type_id || "",
      surface: propriete.surface?.toString() || "",
      prix_achat: propriete.prix_achat?.toString() || "",
      statut: propriete.statut || "Libre",
      zone: propriete.zone || "",
      usage: propriete.usage || "Location",
      loyer_mensuel: propriete.loyer_mensuel?.toString() || "",
      montant_bail: propriete.montant_bail?.toString() || "",
      droit_terre: propriete.droit_terre?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette propriété ?")) {
      deletePropriete.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Propriétés</h2>
          <p className="text-muted-foreground">
            Gérez votre portefeuille immobilier
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingPropriete(null); }}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle propriété
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingPropriete ? "Modifier la propriété" : "Nouvelle propriété"}
              </DialogTitle>
              <DialogDescription>
                {editingPropriete 
                  ? "Modifiez les informations de la propriété ci-dessous."
                  : "Ajoutez une nouvelle propriété en remplissant les informations ci-dessous."
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="nom" className="text-right">
                    Nom *
                  </Label>
                  <Input
                    id="nom"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type_id" className="text-right">
                    Type
                  </Label>
                  <Select
                    value={formData.type_id}
                    onValueChange={(value) => setFormData({ ...formData, type_id: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {typesProprietes?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="surface" className="text-right">
                    Surface (m²)
                  </Label>
                  <Input
                    id="surface"
                    type="number"
                    step="0.01"
                    value={formData.surface}
                    onChange={(e) => setFormData({ ...formData, surface: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                {/* Prix d'achat - affiché uniquement en mode édition */}
                {editingPropriete && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="prix_achat" className="text-right">
                      Prix d'achat (FCFA)
                    </Label>
                    <div className="col-span-3 relative">
                      <Input
                        id="prix_achat"
                        type="number"
                        step="0.01"
                        value={formData.prix_achat}
                        onChange={(e) => setFormData({ ...formData, prix_achat: e.target.value })}
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                        FCFA
                      </span>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="statut" className="text-right">
                    Statut *
                  </Label>
                  <Select
                    value={formData.statut}
                    onValueChange={(value) => setFormData({ ...formData, statut: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Libre">Libre</SelectItem>
                      <SelectItem value="Occupé">Occupé</SelectItem>
                      <SelectItem value="En travaux">En travaux</SelectItem>
                      <SelectItem value="En vente">En vente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="zone" className="text-right">
                    Zone
                  </Label>
                  <Input
                    id="zone"
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    className="col-span-3"
                    placeholder="Ex: Centre-ville, Banlieue..."
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="usage" className="text-right">
                    Usage *
                  </Label>
                  <Select
                    value={formData.usage}
                    onValueChange={(value) => setFormData({ ...formData, usage: value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Sélectionner un usage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Location">Location</SelectItem>
                      <SelectItem value="Bail">Bail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.usage === "Location" && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="loyer_mensuel" className="text-right">
                      Loyer mensuel (FCFA)
                    </Label>
                    <div className="col-span-3 relative">
                      <Input
                        id="loyer_mensuel"
                        type="number"
                        step="0.01"
                        value={formData.loyer_mensuel}
                        onChange={(e) => setFormData({ ...formData, loyer_mensuel: e.target.value })}
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                        FCFA
                      </span>
                    </div>
                  </div>
                )}
                {formData.usage === "Bail" && (
                  <>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="montant_bail" className="text-right">
                        Montant du bail (FCFA)
                      </Label>
                      <div className="col-span-3 relative">
                        <Input
                          id="montant_bail"
                          type="number"
                          step="0.01"
                          value={formData.montant_bail}
                          onChange={(e) => setFormData({ ...formData, montant_bail: e.target.value })}
                          className="pr-12"
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                          FCFA
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="droit_terre" className="text-right">
                        Droit de terre (FCFA)
                      </Label>
                      <div className="col-span-3 relative">
                        <Input
                          id="droit_terre"
                          type="number"
                          step="0.01"
                          value={formData.droit_terre}
                          onChange={(e) => setFormData({ ...formData, droit_terre: e.target.value })}
                          className="pr-12"
                        />
                        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                          FCFA
                        </span>
                      </div>
                    </div>
                  </>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="adresse" className="text-right">
                    Adresse
                  </Label>
                  <Textarea
                    id="adresse"
                    value={formData.adresse}
                    onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createPropriete.isPending || updatePropriete.isPending}>
                  {editingPropriete ? "Modifier" : "Créer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Liste des propriétés
          </CardTitle>
          <CardDescription>
            {proprietes?.length || 0} propriété{(proprietes?.length || 0) !== 1 ? 's' : ''} enregistrée{(proprietes?.length || 0) !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Chargement...</p>
          ) : proprietes?.length === 0 ? (
            <div className="text-center py-10">
              <Building className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">Aucune propriété</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Commencez par créer votre première propriété.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Tarif</TableHead>
                  <TableHead>Surface</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proprietes?.map((propriete) => (
                  <TableRow key={propriete.id}>
                    <TableCell className="font-medium">{propriete.nom}</TableCell>
                    <TableCell>{propriete.types_proprietes?.nom || "-"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        propriete.statut === 'Libre' ? 'bg-green-100 text-green-800' :
                        propriete.statut === 'Occupé' ? 'bg-blue-100 text-blue-800' :
                        propriete.statut === 'En travaux' ? 'bg-orange-100 text-orange-800' :
                        propriete.statut === 'En vente' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {propriete.statut || 'Libre'}
                      </span>
                    </TableCell>
                    <TableCell>{propriete.zone || "-"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        propriete.usage === 'Location' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {propriete.usage || 'Location'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {propriete.usage === 'Location' && propriete.loyer_mensuel 
                        ? `${propriete.loyer_mensuel} FCFA/mois`
                        : propriete.usage === 'Bail' && (propriete.montant_bail || propriete.droit_terre)
                        ? `${propriete.montant_bail || 0} FCFA + ${propriete.droit_terre || 0} FCFA (terre)`
                        : "-"
                      }
                    </TableCell>
                    <TableCell>{propriete.surface ? `${propriete.surface} m²` : "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{propriete.adresse || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <PropertyDetailsDialog propriete={propriete} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(propriete)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(propriete.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}