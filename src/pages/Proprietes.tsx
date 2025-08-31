import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, Building, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PropertyDetailsDialog } from "@/components/PropertyDetailsDialog";
import { PropertyForm } from "@/components/PropertyForm";
import { ExportToExcelButton } from "@/components/ExportToExcelButton";
import { PropertiesDashboard } from "@/components/PropertiesDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [statusFilter, setStatusFilter] = useState("");
  const [usageFilter, setUsageFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
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

  // Filter properties based on search and filters
  const filteredProprietes = proprietes?.filter((propriete) => {
    const matchesSearch = 
      propriete.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      propriete.adresse?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      propriete.zone?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || propriete.statut === statusFilter;
    const matchesUsage = !usageFilter || propriete.usage === usageFilter;
    const matchesType = !typeFilter || propriete.type_id === typeFilter;
    const matchesZone = !zoneFilter || propriete.zone === zoneFilter;
    
    return matchesSearch && matchesStatus && matchesUsage && matchesType && matchesZone;
  }) || [];

  // Get unique zones for filter
  const uniqueZones = [...new Set(proprietes?.map(p => p.zone).filter(Boolean))] as string[];

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

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Tableau de Bord</TabsTrigger>
          <TabsTrigger value="list">Liste des Propriétés</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <PropertiesDashboard />
        </TabsContent>

        <TabsContent value="list">
          {/* Filters Section */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Filtres</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* Search */}
                <div className="col-span-1 md:col-span-2">
                  <Label htmlFor="search">Rechercher</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="search"
                      placeholder="Nom, adresse, zone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <Label htmlFor="status">Statut</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tous les statuts</SelectItem>
                      <SelectItem value="Libre">Libre</SelectItem>
                      <SelectItem value="Occupé">Occupé</SelectItem>
                      <SelectItem value="En travaux">En travaux</SelectItem>
                      <SelectItem value="En vente">En vente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Usage Filter */}
                <div>
                  <Label htmlFor="usage">Usage</Label>
                  <Select value={usageFilter} onValueChange={setUsageFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les usages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tous les usages</SelectItem>
                      <SelectItem value="Location">Location</SelectItem>
                      <SelectItem value="Bail">Bail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Type Filter */}
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tous les types</SelectItem>
                      {typesProprietes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Zone Filter */}
                <div>
                  <Label htmlFor="zone">Zone</Label>
                  <Select value={zoneFilter} onValueChange={setZoneFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Toutes les zones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Toutes les zones</SelectItem>
                      {uniqueZones.map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          {zone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Results count */}
              <div className="mt-4 text-sm text-muted-foreground">
                {filteredProprietes.length} propriété{filteredProprietes.length !== 1 ? 's' : ''} trouvée{filteredProprietes.length !== 1 ? 's' : ''}
                {(searchTerm || statusFilter || usageFilter || typeFilter || zoneFilter) && (
                  <span> sur {proprietes?.length || 0} au total</span>
                )}
              </div>
            </CardContent>
          </Card>

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
          ) : filteredProprietes.length === 0 ? (
            <div className="text-center py-10">
              <Building className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">
                {(searchTerm || statusFilter || usageFilter || typeFilter || zoneFilter) 
                  ? "Aucune propriété trouvée" 
                  : "Aucune propriété"
                }
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {(searchTerm || statusFilter || usageFilter || typeFilter || zoneFilter)
                  ? "Essayez de modifier vos filtres de recherche."
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
                  <TableHead>Adresse</TableHead>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}