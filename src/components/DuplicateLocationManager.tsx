import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Trash2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DuplicateGroup {
  client_id: string;
  propriete_id: string;
  client_name: string;
  propriete_name: string;
  locations: any[];
}

export function DuplicateLocationManager() {
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: locations, isLoading } = useQuery({
    queryKey: ["all-locations-duplicates"],
    queryFn: async () => {
      const data = await apiClient.select<any[]>({
        table: "locations",
        orderBy: { column: "created_at", ascending: true }
      });
      return data;
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: string) => {
      const data = await apiClient.rpc("delete_location_safely", { p_location_id: locationId });
      return data;
    },
    onSuccess: (report: any) => {
      queryClient.invalidateQueries({ queryKey: ["all-locations-duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cash_balance"] });
      toast({
        title: "Location supprimée",
        description: `${report.paiements_supprimes} paiement(s) supprimés. Solde recalculé.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la location.",
        variant: "destructive",
      });
    },
  });

  // Group locations by client + property to find duplicates
  const duplicateGroups: DuplicateGroup[] = [];
  if (locations) {
    const grouped = locations.reduce((acc, loc) => {
      const key = `${loc.client_id}_${loc.propriete_id}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(loc);
      return acc;
    }, {} as Record<string, any[]>);

    Object.entries(grouped).forEach(([key, locs]) => {
      if (locs.length > 1) {
        duplicateGroups.push({
          client_id: locs[0].client_id,
          propriete_id: locs[0].propriete_id,
          client_name: `${locs[0].clients?.prenom || ''} ${locs[0].clients?.nom || ''}`.trim(),
          propriete_name: locs[0].proprietes?.nom || 'Propriété inconnue',
          locations: locs,
        });
      }
    });
  }

  const handleToggleSelection = (locationId: string) => {
    setSelectedForDeletion(prev => {
      const newSet = new Set(prev);
      if (newSet.has(locationId)) {
        newSet.delete(locationId);
      } else {
        newSet.add(locationId);
      }
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedForDeletion.size === 0) return;
    
    const message = `Vous allez supprimer ${selectedForDeletion.size} location(s) en doublon.\n\nTous les paiements et données liées seront supprimés et les soldes recalculés.\n\nContinuer ?`;
    
    if (!confirm(message)) return;

    for (const locationId of selectedForDeletion) {
      await deleteLocationMutation.mutateAsync(locationId);
    }
    
    setSelectedForDeletion(new Set());
  };

  const getTotalPayments = (location: any) => {
    return location.paiements_locations?.reduce((sum: number, p: any) => sum + p.montant, 0) || 0;
  };

  if (isLoading) {
    return <div className="text-center py-4">Recherche de doublons...</div>;
  }

  if (duplicateGroups.length === 0) {
    return (
      <Alert>
        <Check className="h-4 w-4" />
        <AlertDescription>
          Aucun doublon détecté. Toutes les locations sont uniques.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {duplicateGroups.length} doublon(s) détecté(s) : même client + même propriété
        </AlertDescription>
      </Alert>

      {selectedForDeletion.size > 0 && (
        <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
          <span className="font-medium">{selectedForDeletion.size} location(s) sélectionnée(s)</span>
          <Button
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={deleteLocationMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Supprimer les locations sélectionnées
          </Button>
        </div>
      )}

      {duplicateGroups.map((group, idx) => (
        <Card key={idx} className="border-destructive">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Doublon: {group.client_name} - {group.propriete_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {group.locations.map((location) => {
                const totalPayments = getTotalPayments(location);
                const isSelected = selectedForDeletion.has(location.id);
                
                return (
                  <div
                    key={location.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-destructive/10 border-destructive' : 'hover:bg-muted'
                    }`}
                    onClick={() => handleToggleSelection(location.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={location.statut === 'active' ? 'default' : 'secondary'}>
                            {location.statut}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Créée le: {new Date(location.created_at).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-medium">Loyer mensuel:</p>
                            <p>{location.loyer_mensuel?.toLocaleString()} FCFA</p>
                          </div>
                          <div>
                            <p className="font-medium">Caution totale:</p>
                            <p>{location.caution_totale?.toLocaleString()} FCFA</p>
                          </div>
                          <div>
                            <p className="font-medium">Date début:</p>
                            <p>{new Date(location.date_debut).toLocaleDateString('fr-FR')}</p>
                          </div>
                          <div>
                            <p className="font-medium">Paiements:</p>
                            <p className={totalPayments > 0 ? 'text-orange-600 font-bold' : ''}>
                              {location.paiements_locations?.length || 0} - {totalPayments.toLocaleString()} FCFA
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        {isSelected ? (
                          <Check className="w-6 h-6 text-destructive" />
                        ) : (
                          <div className="w-6 h-6 border-2 rounded" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              💡 Cliquez sur une location pour la sélectionner pour suppression. 
              Gardez celle qui contient les bonnes informations et supprimez les autres.
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
