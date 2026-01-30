import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, CreditCard, FileText, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LocationForm } from "@/components/LocationForm";
import { LocationDetailsDialog } from "@/components/LocationDetailsDialog";
import { PaiementLocationDialog } from "@/components/PaiementLocationDialog";
import { ExportToExcelButton } from "@/components/ExportToExcelButton";
import { LocationsDashboard } from "@/components/LocationsDashboard";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { ProtectedAction } from "@/components/ProtectedAction";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateLocationDebt, calculateLocationProgress } from "@/utils/locationUtils";
import { AgentSummaryCard } from "@/components/AgentSummaryCard";
import { useAgentStats } from "@/hooks/useAgentStats";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { DuplicateLocationManager } from "@/components/DuplicateLocationManager";

export default function Locations() {
  const { canAccessDashboard } = useUserPermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showPaiementDialog, setShowPaiementDialog] = useState(false);
  const [showDuplicatesManager, setShowDuplicatesManager] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: locations, isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      // Récupérer les locations
      const locationsData = await apiClient.select({
        table: "locations",
        orderBy: { column: "created_at", ascending: false }
      });

      // Récupérer les données liées
      const [clientsData, proprietesData, agentsData, paiementsData] = await Promise.all([
        apiClient.select({ table: "clients" }),
        apiClient.select({ table: "proprietes" }),
        apiClient.select({ table: "agents_recouvrement" }),
        apiClient.select({ table: "paiements_locations" })
      ]);

      // Joindre les données
      return locationsData.map((location: any) => {
        const client = clientsData.find((c: any) => c.id === location.client_id);
        const propriete = proprietesData.find((p: any) => p.id === location.propriete_id);
        const agent = propriete ? agentsData.find((a: any) => a.id === propriete.agent_id) : null;
        const paiements = paiementsData.filter((p: any) => p.location_id === location.id);

        return {
          ...location,
          clients: client ? { nom: client.nom, prenom: client.prenom, telephone_principal: client.telephone_principal } : null,
          proprietes: propriete ? {
            ...propriete,
            agents_recouvrement: agent ? { nom: agent.nom, prenom: agent.prenom } : null
          } : null,
          paiements_locations: paiements
        };
      });
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const data = await apiClient.select({
        table: "agents_recouvrement",
        filters: [{ op: "eq", column: "statut", value: "actif" }],
        orderBy: { column: "nom", ascending: true }
      });
      return data;
    },
  });

  const { data: zones } = useQuery({
    queryKey: ["zones"],
    queryFn: async () => {
      const data = await apiClient.select({ table: "proprietes" });

      // Extraire les zones uniques et les trier
      const uniqueZones = [...new Set(data?.map((p: any) => p.zone).filter(Boolean))].sort();
      return uniqueZones as string[];
    },
  });

  const { data: agentStats } = useAgentStats(
    agentFilter !== "all" ? agentFilter : null, 
    'locations', 
    selectedMonth || undefined
  );
  
  const selectedAgent = agents?.find(agent => agent.id === agentFilter);
  const shouldShowAgentSummary = agentFilter !== "all" && selectedAgent && agentStats;

  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: string) => {
      return await apiClient.deleteLocationSafely(locationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cash_balance"] });
      toast({
        title: "Location supprimée avec succès",
        description: "La location et ses paiements associés ont été supprimés. Les soldes de caisse ont été recalculés.",
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

  const filteredLocations = locations?.filter((location) => {
    const matchesSearch =
      location.clients?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.clients?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.proprietes?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.proprietes?.adresse?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || location.statut === statusFilter;
    
    const matchesAgent = agentFilter === "all" || 
      (location.proprietes?.agent_id && location.proprietes.agent_id === agentFilter);

    const matchesZone = zoneFilter === "all" || 
      (location.proprietes?.zone && location.proprietes.zone === zoneFilter);

    return matchesSearch && matchesStatus && matchesAgent && matchesZone;
  });

  const {
    currentPage,
    totalPages,
    paginatedItems: paginatedLocations,
    goToPage,
    totalItems,
  } = usePagination({
    items: filteredLocations,
    itemsPerPage: 10,
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
    const totalPayments = location.paiements_locations?.reduce((sum: number, p: any) => sum + p.montant, 0) || 0;
    const message = totalPayments > 0
      ? `Attention ! Cette location a ${location.paiements_locations?.length || 0} paiement(s) pour un total de ${totalPayments.toLocaleString()} FCFA.\n\nTous les paiements, reçus et transactions de caisse liés seront supprimés, et le solde de caisse sera recalculé automatiquement.\n\nÊtes-vous sûr de vouloir continuer ?`
      : `Êtes-vous sûr de vouloir supprimer cette location ?`;
    
    if (confirm(message)) {
      deleteLocationMutation.mutate(location.id);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  return (
    <div className="container mx-auto p-4 lg:p-6">
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Gestion des Locations</h1>
          <p className="text-muted-foreground">
            Dashboard et gestion des contrats de location
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportToExcelButton
            filename={`locations_${new Date().toISOString().slice(0,10)}`}
            rows={filteredLocations || []}
            columns={[
              { header: "Propriété", accessor: (r:any) => r.proprietes?.nom || "" },
              { header: "Client", accessor: (r:any) => `${r.clients?.prenom || ''} ${r.clients?.nom || ''}`.trim() },
              { header: "Loyer", accessor: (r:any) => r.loyer_mensuel },
              { header: "Statut", accessor: (r:any) => r.statut },
              { header: "Début", accessor: (r:any) => r.date_debut ? new Date(r.date_debut).toLocaleDateString('fr-FR') : "" },
            ]}
          />
          <ProtectedAction permission="canCreateRentals">
            <Button onClick={() => setShowLocationForm(true)} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Location
            </Button>
          </ProtectedAction>
        </div>
      </div>

      <Tabs defaultValue={canAccessDashboard ? "dashboard" : "list"} className="w-full">
        <TabsList className={`grid w-full ${canAccessDashboard ? 'grid-cols-3' : 'grid-cols-2'} mb-6`}>
          {canAccessDashboard && (
            <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
          )}
          <TabsTrigger value="list">📋 Liste des locations</TabsTrigger>
          <TabsTrigger value="duplicates">⚠️ Gérer les doublons</TabsTrigger>
        </TabsList>
        
        {canAccessDashboard && (
          <TabsContent value="dashboard" className="space-y-6">
            <LocationsDashboard />
          </TabsContent>
        )}
        
        <TabsContent value="list" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par client ou propriété..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Combobox
              options={[
                { value: "all", label: "Tous les statuts" },
                { value: "active", label: "Active" },
                { value: "termine", label: "Terminée" },
                { value: "suspendu", label: "Suspendue" }
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Filtrer par statut"
              buttonClassName="w-48 min-w-40 justify-start"
            />
            <Combobox
              options={[
                { value: "all", label: "Tous les agents" },
                ...(agents?.map(agent => ({
                  value: agent.id,
                  label: `${agent.prenom} ${agent.nom}`
                })) || [])
              ]}
              value={agentFilter}
              onChange={setAgentFilter}
              placeholder="Filtrer par agent"
              buttonClassName="w-48 min-w-40 justify-start"
            />
            <Combobox
              options={[
                { value: "all", label: "Toutes les zones" },
                ...(zones?.map(zone => ({
                  value: zone,
                  label: zone
                })) || [])
              ]}
              value={zoneFilter}
              onChange={setZoneFilter}
              placeholder="Filtrer par zone"
              buttonClassName="w-48 min-w-40 justify-start"
            />
          </div>

          {/* Agent Summary */}
          {shouldShowAgentSummary && (
            <AgentSummaryCard
              agentId={agentFilter}
              agentName={`${selectedAgent.prenom} ${selectedAgent.nom}`}
              mode="locations"
              stats={agentStats}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
            />
          )}

          {/* Locations List */}
          <div className="grid gap-4">
        {paginatedLocations?.map((location) => (
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
                  {location.proprietes?.zone && (
                    <p className="text-xs text-blue-600 font-medium">
                      Zone: {location.proprietes.zone}
                    </p>
                  )}
                </div>
                <Badge variant={getStatusBadge(location.statut)}>
                  {getStatusLabel(location.statut)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium">Locataire</p>
                  <p className="text-sm text-muted-foreground">
                    {location.clients?.prenom} {location.clients?.nom}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {location.clients?.telephone_principal}
                  </p>
                  {location.proprietes?.agents_recouvrement && (
                    <p className="text-xs text-blue-600 font-medium">
                      Agent: {location.proprietes.agents_recouvrement.prenom} {location.proprietes.agents_recouvrement.nom}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">Loyer Mensuel</p>
                  <p className="text-lg font-bold text-primary">
                    {location.loyer_mensuel?.toLocaleString()} FCFA
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Caution Versée</p>
                  <p className="text-lg font-bold text-green-600">
                    {location.caution_totale?.toLocaleString()} FCFA
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {location.type_contrat === 'historique' 
                      ? '(ancien locataire)' 
                      : '(5 mois)'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Montant restant à payer</p>
                  <p className="text-lg font-bold text-orange-600">
                    {(() => {
                      const progress = calculateLocationProgress({
                        ...location,
                        paiements_locations: location.paiements_locations || []
                      });
                      return progress.currentYearDue?.toLocaleString();
                    })()} FCFA
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
                  <ProtectedAction permission="canPayRents">
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
                  </ProtectedAction>
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

          {/* Pagination */}
          {filteredLocations && filteredLocations.length > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
              totalItems={totalItems}
              itemsPerPage={10}
            />
          )}
        </TabsContent>

        <TabsContent value="duplicates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gestionnaire de Doublons</CardTitle>
              <p className="text-sm text-muted-foreground">
                Identifiez et supprimez les locations en doublon (même client + même propriété)
              </p>
            </CardHeader>
            <CardContent>
              <DuplicateLocationManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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