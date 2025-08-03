import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, CreditCard, FileText, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LocationForm } from "@/components/LocationForm";
import { LocationDetailsDialog } from "@/components/LocationDetailsDialog";
import { PaiementLocationDialog } from "@/components/PaiementLocationDialog";

export default function Locations() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showPaiementDialog, setShowPaiementDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: locations, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select(`
          *,
          clients(nom, prenom, telephone_principal),
          proprietes(nom, adresse, loyer_mensuel)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: string) => {
      const { error } = await supabase
        .from("locations")
        .delete()
        .eq("id", locationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast({
        title: "Location supprimée",
        description: "La location a été supprimée avec succès.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la location.",
        variant: "destructive",
      });
    },
  });

  const filteredLocations = locations?.filter((location) => {
    const matchesSearch =
      location.clients?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.clients?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.proprietes?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.proprietes?.adresse?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || location.statut === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (statut: string) => {
    const variants: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      active: "default",
      termine: "secondary",
      suspendu: "destructive",
    };
    return variants[statut] || "default";
  };

  const getStatusLabel = (statut: string) => {
    const labels = {
      active: "Active",
      termine: "Terminée",
      suspendu: "Suspendue",
    };
    return labels[statut as keyof typeof labels] || statut;
  };

  const handleDeleteLocation = (location: any) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette location ?")) {
      deleteLocationMutation.mutate(location.id);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Locations</h1>
          <p className="text-muted-foreground">
            Gestion des contrats de location avec système de caution 5 mois
          </p>
        </div>
        <Button onClick={() => setShowLocationForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle Location
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par client ou propriété..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="termine">Terminée</SelectItem>
            <SelectItem value="suspendu">Suspendue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Locations List */}
      <div className="grid gap-4">
        {filteredLocations?.map((location) => (
          <Card key={location.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {location.proprietes?.nom}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {location.proprietes?.adresse}
                  </p>
                </div>
                <Badge variant={getStatusBadge(location.statut)}>
                  {getStatusLabel(location.statut)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium">Locataire</p>
                  <p className="text-sm text-muted-foreground">
                    {location.clients?.prenom} {location.clients?.nom}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {location.clients?.telephone_principal}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Loyer Mensuel</p>
                  <p className="text-lg font-bold text-primary">
                    {location.loyer_mensuel?.toLocaleString()} FCFA
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Caution Versée</p>
                  <p className="text-sm text-green-600">
                    {location.caution_totale?.toLocaleString()} FCFA
                  </p>
                  <p className="text-xs text-muted-foreground">
                    (5 mois)
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Dette Restante</p>
                  <p className={`text-sm font-medium ${
                    location.dette_totale > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {location.dette_totale?.toLocaleString()} FCFA
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedLocation(location);
                    setShowDetailsDialog(true);
                  }}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Détails
                </Button>
                
                {location.statut === 'active' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedLocation(location);
                      setShowPaiementDialog(true);
                    }}
                  >
                    <CreditCard className="w-4 h-4 mr-1" />
                    Paiement
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteLocation(location)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Supprimer
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredLocations?.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                Aucune location trouvée.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      {showLocationForm && (
        <LocationForm
          onClose={() => setShowLocationForm(false)}
          onSuccess={() => {
            setShowLocationForm(false);
            queryClient.invalidateQueries({ queryKey: ["locations"] });
          }}
        />
      )}

      {showDetailsDialog && selectedLocation && (
        <LocationDetailsDialog
          location={selectedLocation}
          onClose={() => {
            setShowDetailsDialog(false);
            setSelectedLocation(null);
          }}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["locations"] });
          }}
        />
      )}

      {showPaiementDialog && selectedLocation && (
        <PaiementLocationDialog
          location={selectedLocation}
          onClose={() => {
            setShowPaiementDialog(false);
            setSelectedLocation(null);
          }}
          onSuccess={() => {
            setShowPaiementDialog(false);
            setSelectedLocation(null);
            queryClient.invalidateQueries({ queryKey: ["locations"] });
          }}
        />
      )}
    </div>
  );
}