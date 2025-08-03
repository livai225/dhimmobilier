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

interface Propriete {
  id: string;
  nom: string;
  adresse?: string;
  type_id?: string;
  surface?: number;
  prix_achat?: number;
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
    prix_achat: "",
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

  const { data: typesProprietes } = useQuery({
    queryKey: ['types-proprietes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('types_proprietes').select('*').order('nom');
      if (error) throw error;
      return data;
    },
  });

  const createPropriete = useMutation({
    mutationFn: async (proprieteData: typeof formData) => {
      const processedData = {
        ...proprieteData,
        surface: proprieteData.surface ? parseFloat(proprieteData.surface) : null,
        prix_achat: proprieteData.prix_achat ? parseFloat(proprieteData.prix_achat) : null,
        type_id: proprieteData.type_id || null,
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
    mutationFn: async ({ id, nom, adresse, type_id, surface, prix_achat }: { id: string } & typeof formData) => {
      const processedData = {
        nom,
        adresse,
        surface: surface ? parseFloat(surface) : null,
        prix_achat: prix_achat ? parseFloat(prix_achat) : null,
        type_id: type_id || null,
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
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="prix_achat" className="text-right">
                    Prix d'achat (€)
                  </Label>
                  <Input
                    id="prix_achat"
                    type="number"
                    step="0.01"
                    value={formData.prix_achat}
                    onChange={(e) => setFormData({ ...formData, prix_achat: e.target.value })}
                    className="col-span-3"
                  />
                </div>
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
                  <TableHead>Surface</TableHead>
                  <TableHead>Prix d'achat</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proprietes?.map((propriete) => (
                  <TableRow key={propriete.id}>
                    <TableCell className="font-medium">{propriete.nom}</TableCell>
                    <TableCell>{propriete.types_proprietes?.nom}</TableCell>
                    <TableCell>{propriete.surface ? `${propriete.surface} m²` : "-"}</TableCell>
                    <TableCell>{propriete.prix_achat ? `${propriete.prix_achat}€` : "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{propriete.adresse}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
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