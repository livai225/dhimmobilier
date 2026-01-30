import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Users, Trash2, RefreshCw, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DuplicateGroup {
  key: string;
  clients: Array<{
    id: string;
    nom: string;
    prenom: string;
    created_at: string;
    hasRelations: boolean;
    relatedData: {
      locations: number;
      souscriptions: number;
      receipts: number;
    };
  }>;
  keepClient: string; // ID du client à conserver
  toDelete: string[]; // IDs des clients à supprimer
}

export function DuplicateClientManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Normalisation des noms pour la comparaison
  const normalizeName = (name: string): string => {
    if (!name) return '';
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
      .replace(/[^a-z\s]/g, '') // Garder seulement lettres et espaces
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .trim();
  };

  // Fonction pour analyser les doublons
  const analyzeDuplicates = async (): Promise<DuplicateGroup[]> => {
    setIsAnalyzing(true);
    
    try {
      // 1. Récupérer tous les clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, nom, prenom, created_at');

      if (clientsError) throw clientsError;

      // 2. Grouper par nom normalisé
      const groups = new Map<string, typeof clients>();
      
      clients?.forEach(client => {
        const fullName = `${normalizeName(client.nom || '')} ${normalizeName(client.prenom || '')}`.trim();
        if (fullName && fullName !== ' ') {
          if (!groups.has(fullName)) {
            groups.set(fullName, []);
          }
          groups.get(fullName)!.push(client);
        }
      });

      // 3. Filtrer seulement les groupes avec doublons (2+ clients)
      const duplicateGroups: DuplicateGroup[] = [];
      
      for (const [key, groupClients] of groups.entries()) {
        if (groupClients.length > 1) {
          // Trier par date de création (plus ancien en premier)
          const sortedClients = groupClients.sort((a, b) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          // Analyser les relations pour chaque client
          const clientsWithRelations = await Promise.all(
            sortedClients.map(async (client) => {
              const [locations, souscriptions, receipts] = await Promise.all([
                supabase.from('locations').select('id', { count: 'exact' }).eq('client_id', client.id),
                supabase.from('souscriptions').select('id', { count: 'exact' }).eq('client_id', client.id),
                supabase.from('recus').select('id', { count: 'exact' }).eq('client_id', client.id)
              ]);

              return {
                ...client,
                hasRelations: (locations.count || 0) > 0 || (souscriptions.count || 0) > 0 || (receipts.count || 0) > 0,
                relatedData: {
                  locations: locations.count || 0,
                  souscriptions: souscriptions.count || 0,
                  receipts: receipts.count || 0
                }
              };
            })
          );

          // Le premier client (plus ancien) est conservé, les autres supprimés
          // SAUF si un client plus récent a des relations et pas l'ancien
          let keepClient = clientsWithRelations[0];
          
          // Si le plus ancien n'a pas de relations mais qu'un plus récent en a, garder celui avec relations
          const clientWithRelations = clientsWithRelations.find(c => c.hasRelations);
          if (!keepClient.hasRelations && clientWithRelations) {
            keepClient = clientWithRelations;
          }

          duplicateGroups.push({
            key,
            clients: clientsWithRelations,
            keepClient: keepClient.id,
            toDelete: clientsWithRelations.filter(c => c.id !== keepClient.id).map(c => c.id)
          });
        }
      }

      return duplicateGroups;
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Query pour récupérer les doublons
  const { data: duplicateGroups = [], isLoading, refetch } = useQuery({
    queryKey: ['duplicate-clients'],
    queryFn: analyzeDuplicates,
    enabled: false, // Ne se lance que manuellement
  });

  // Mutation pour supprimer les doublons
  const deleteDuplicates = useMutation({
    mutationFn: async (groupsToDelete: string[]) => {
      const selectedDuplicates = duplicateGroups.filter(group => 
        groupsToDelete.includes(group.key)
      );

      const clientIdsToDelete = selectedDuplicates.flatMap(group => group.toDelete);
      
      // Vérifier qu'aucun client à supprimer n'a de relations critiques
      for (const group of selectedDuplicates) {
        for (const clientId of group.toDelete) {
          const client = group.clients.find(c => c.id === clientId);
          if (client?.hasRelations) {
            throw new Error(
              `Le client "${client.nom} ${client.prenom}" a des données liées et ne peut pas être supprimé automatiquement.`
            );
          }
        }
      }

      // Supprimer les clients
      const { error } = await supabase
        .from('clients')
        .delete()
        .in('id', clientIdsToDelete);

      if (error) throw error;

      return { deleted: clientIdsToDelete.length, groups: selectedDuplicates.length };
    },
    onSuccess: (result) => {
      toast({
        title: "✅ Doublons supprimés",
        description: `${result.deleted} clients doublons supprimés dans ${result.groups} groupes.`,
      });
      setSelectedGroups(new Set());
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erreur",
        description: error.message || "Impossible de supprimer les doublons",
        variant: "destructive",
      });
    },
  });

  const toggleGroupSelection = (groupKey: string) => {
    const newSelection = new Set(selectedGroups);
    if (newSelection.has(groupKey)) {
      newSelection.delete(groupKey);
    } else {
      newSelection.add(groupKey);
    }
    setSelectedGroups(newSelection);
  };

  const selectAllGroups = () => {
    const safeDuplicates = duplicateGroups.filter(group => 
      group.toDelete.every(clientId => {
        const client = group.clients.find(c => c.id === clientId);
        return !client?.hasRelations;
      })
    );
    setSelectedGroups(new Set(safeDuplicates.map(g => g.key)));
  };

  const totalDuplicates = duplicateGroups.reduce((acc, group) => acc + group.toDelete.length, 0);
  const selectedDuplicates = duplicateGroups
    .filter(group => selectedGroups.has(group.key))
    .reduce((acc, group) => acc + group.toDelete.length, 0);

  const safeDuplicatesCount = duplicateGroups.filter(group => 
    group.toDelete.every(clientId => {
      const client = group.clients.find(c => c.id === clientId);
      return !client?.hasRelations;
    })
  ).reduce((acc, group) => acc + group.toDelete.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Gestion des doublons clients
        </CardTitle>
        <CardDescription>
          Identifiez et supprimez les clients en double dans votre base de données.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!duplicateGroups.length ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Cliquez sur "Analyser les doublons" pour identifier les clients en double.
            </p>
            <Button 
              onClick={() => refetch()} 
              disabled={isLoading || isAnalyzing}
              className="mb-4"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(isLoading || isAnalyzing) ? 'animate-spin' : ''}`} />
              {isLoading || isAnalyzing ? 'Analyse en cours...' : 'Analyser les doublons'}
            </Button>
          </div>
        ) : (
          <>
            {/* Statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{duplicateGroups.length}</p>
                <p className="text-sm text-muted-foreground">Groupes de doublons</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">{totalDuplicates}</p>
                <p className="text-sm text-muted-foreground">Clients à supprimer</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{safeDuplicatesCount}</p>
                <p className="text-sm text-muted-foreground">Suppression sécurisée</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading || isAnalyzing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${(isLoading || isAnalyzing) ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
              
              <Button
                variant="outline"
                onClick={selectAllGroups}
                disabled={!duplicateGroups.length}
              >
                Sélectionner tout (sécurisé)
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={selectedGroups.size === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer sélectionnés ({selectedDuplicates})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                    <AlertDialogDescription>
                      Vous allez supprimer {selectedDuplicates} clients doublons dans {selectedGroups.size} groupes.
                      Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteDuplicates.mutate(Array.from(selectedGroups))}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Liste des doublons */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {duplicateGroups.map((group) => {
                const hasUnsafeDelete = group.toDelete.some(clientId => {
                  const client = group.clients.find(c => c.id === clientId);
                  return client?.hasRelations;
                });

                return (
                  <div
                    key={group.key}
                    className={`border rounded-lg p-4 ${
                      hasUnsafeDelete ? 'border-orange-200 bg-orange-50' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedGroups.has(group.key)}
                        onCheckedChange={() => toggleGroupSelection(group.key)}
                        disabled={hasUnsafeDelete}
                        className="mt-1"
                      />
                      
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium capitalize">
                            {group.key}
                          </h4>
                          {hasUnsafeDelete && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Suppression manuelle requise
                            </Badge>
                          )}
                        </div>

                        <div className="grid gap-2">
                          {group.clients.map((client) => {
                            const isKept = client.id === group.keepClient;
                            const willBeDeleted = group.toDelete.includes(client.id);

                            return (
                              <div
                                key={client.id}
                                className={`flex items-center justify-between p-2 rounded text-sm ${
                                  isKept
                                    ? 'bg-green-100 border border-green-200'
                                    : willBeDeleted
                                    ? client.hasRelations
                                      ? 'bg-orange-100 border border-orange-200'
                                      : 'bg-red-100 border border-red-200'
                                    : 'bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div>
                                    <p className="font-medium">
                                      {client.nom} {client.prenom}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      Créé le {new Date(client.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                  
                                  {client.hasRelations && (
                                    <div className="text-xs">
                                      <p className="text-orange-600">
                                        Relations: {client.relatedData.locations} locations, {client.relatedData.souscriptions} souscriptions, {client.relatedData.receipts} reçus
                                      </p>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {isKept && (
                                    <Badge variant="default" className="bg-green-600">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Conservé
                                    </Badge>
                                  )}
                                  {willBeDeleted && (
                                    <Badge
                                      variant={client.hasRelations ? "destructive" : "secondary"}
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      {client.hasRelations ? "Suppression manuelle" : "À supprimer"}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {duplicateGroups.some(group => 
              group.toDelete.some(clientId => {
                const client = group.clients.find(c => c.id === clientId);
                return client?.hasRelations;
              })
            ) && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-700">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Certains doublons ont des données liées (locations, souscriptions) et nécessitent une suppression manuelle pour éviter la perte de données.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}