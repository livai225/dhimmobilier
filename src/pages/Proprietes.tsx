import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, Building, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PropertyDetailsDialog } from "@/components/PropertyDetailsDialog";
import { PropertyForm } from "@/components/PropertyForm";
import { ExportToExcelButton } from "@/components/ExportToExcelButton";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatut, setSelectedStatut] = useState("");
  const [selectedUsage, setSelectedUsage] = useState("");
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

  // Fetch subscriptions and locations count for properties
  const { data: propertyStats } = useQuery({
    queryKey: ['property-stats'],
    queryFn: async () => {
      const [subscriptionsData, locationsData] = await Promise.all([
        supabase.from('souscriptions').select('propriete_id'),
        supabase.from('locations').select('propriete_id, statut')
      ]);

      const subscriptionCounts = subscriptionsData.data?.reduce((acc, sub) => {
        acc[sub.propriete_id] = (acc[sub.propriete_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const locationCounts = locationsData.data?.reduce((acc, loc) => {
        if (loc.statut === 'active') {
          acc[loc.propriete_id] = (acc[loc.propriete_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>) || {};

      return { subscriptionCounts, locationCounts };
    },
  });

  // Filter properties
  const filteredProprietes = proprietes?.filter((propriete) => {
    const matchesSearch = propriete.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      propriete.adresse?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      propriete.zone?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatut = !selectedStatut || propriete.statut === selectedStatut;
    const matchesUsage = !selectedUsage || propriete.usage === selectedUsage;
    
    return matchesSearch && matchesStatut && matchesUsage;
  }) || [];

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
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Propriétés</h2>
          <p className="text-muted-foreground">
            Gérez votre portefeuille immobilier
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportToExcelButton
            filename={`proprietes_${new Date().toISOString().slice(0,10)}`}
            rows={proprietes || []}
            columns={[
              { header: "Nom", accessor: (r:any) => r.nom },
              { header: "Type", accessor: (r:any) => r.types_proprietes?.nom || "" },
              { header: "Statut", accessor: (r:any) => r.statut || "" },
              { header: "Usage", accessor: (r:any) => r.usage || "" },
              { header: "Zone", accessor: (r:any) => r.zone || "" },
            ]}
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setEditingPropriete(null); }} className="w-full sm:w-auto">
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
              <PropertyForm 
                property={editingPropriete}
                onSuccess={() => {
                  setIsDialogOpen(false);
                  setEditingPropriete(null);
                  resetForm();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Rechercher une propriété..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={selectedStatut} onValueChange={setSelectedStatut}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tous statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous statuts</SelectItem>
              <SelectItem value="Libre">Libre</SelectItem>
              <SelectItem value="Occupé">Occupé</SelectItem>
              <SelectItem value="En travaux">En travaux</SelectItem>
              <SelectItem value="En vente">En vente</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedUsage} onValueChange={setSelectedUsage}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tous usages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous usages</SelectItem>
              <SelectItem value="Location">Location</SelectItem>
              <SelectItem value="Bail">Bail</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Liste des propriétés
          </CardTitle>
          <CardDescription>
            {filteredProprietes.length} propriété{filteredProprietes.length !== 1 ? 's' : ''} affichée{filteredProprietes.length !== 1 ? 's' : ''} sur {proprietes?.length || 0}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Chargement...</p>
          ) : filteredProprietes.length === 0 ? (
            <div className="text-center py-10">
              <Building className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">
                {searchTerm || selectedStatut || selectedUsage ? "Aucune propriété trouvée" : "Aucune propriété"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || selectedStatut || selectedUsage 
                  ? "Modifiez vos critères de recherche ou créez une nouvelle propriété." 
                  : "Commencez par créer votre première propriété."
                }
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
                  <TableHead>Activité</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProprietes.map((propriete) => (
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
                    <TableCell>
                      <div className="flex gap-1">
                        {(propertyStats?.subscriptionCounts[propriete.id] || 0) > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {propertyStats?.subscriptionCounts[propriete.id]} souscr.
                          </Badge>
                        )}
                        {(propertyStats?.locationCounts[propriete.id] || 0) > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {propertyStats?.locationCounts[propriete.id]} loc.
                          </Badge>
                        )}
                        {!(propertyStats?.subscriptionCounts[propriete.id] || 0) && 
                         !(propertyStats?.locationCounts[propriete.id] || 0) && (
                          <span className="text-xs text-muted-foreground">Libre</span>
                        )}
                      </div>
                    </TableCell>
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