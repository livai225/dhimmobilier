import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExportToExcelButton } from "@/components/ExportToExcelButton";
import { ImportRecouvrementData } from "@/components/ImportRecouvrementData";
import { CancelRecouvrementImportDialog } from "@/components/CancelRecouvrementImportDialog";
import { AgentRecoveryDashboard } from "@/components/AgentRecoveryDashboard";
import { Search, TrendingUp, TrendingDown, DollarSign, Users, User, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { formatFCFA } from "@/lib/format";

interface AgentRecoveryData {
  agent_id: string;
  agent_nom: string;
  agent_prenom: string;
  agent_code: string;
  proprietes_count: number;
  locations_count: number;
  souscriptions_count: number;
  total_du_loyers: number;
  total_du_droits_terre: number;
  total_du: number;
  total_verse: number;
  ecart: number;
  derniere_collecte: string | null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  // Prisma decimals often arrive as strings via JSON.
  const n = Number(String(value).replace(/,/g, ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export default function Recouvrement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'global' | 'agent'>('global');

  // Fetch all agents for selection
  const { data: allAgents = [] } = useQuery({
    queryKey: ['all-agents'],
    queryFn: async () => {
      const data = await apiClient.select({
        table: 'agents_recouvrement',
        columns: 'id,nom,prenom,code_agent,statut',
        filters: [{ op: 'eq', column: 'statut', value: 'actif' }],
        orderBy: { column: 'nom', ascending: true }
      });
      return data;
    },
    // Avoid flashing empty UI during refetches.
    placeholderData: (prev) => prev,
    staleTime: 120000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch agents with their recovery data
  const agentsRecoveryQuery = useQuery({
    queryKey: ['agents-recovery', monthFilter],
    queryFn: async () => {
      const date = new Date(`${monthFilter}-01`);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const startOfMonthDateTime = `${monthFilter}-01T00:00:00`;
      const endOfMonthDateTime = `${monthFilter}-${String(lastDay).padStart(2, "0")}T23:59:59.999`;

      // Fetch strictly what we need (avoid full table scans).
      const agentsData = await apiClient.select({
        table: "agents_recouvrement",
        columns: "id,nom,prenom,code_agent,statut",
        filters: [{ op: "eq", column: "statut", value: "actif" }],
        orderBy: { column: "nom", ascending: true },
      });

      const agentIds = agentsData?.map((a: any) => a.id).filter(Boolean) || [];
      if (agentIds.length === 0) return [];

      const proprietesData = await apiClient.select({
        table: "proprietes",
        columns: "id,agent_id,loyer_mensuel,droit_terre",
        filters: [{ op: "in", column: "agent_id", values: agentIds }],
      });

      const propertyIds = proprietesData?.map((p: any) => p.id).filter(Boolean) || [];
      if (propertyIds.length === 0) {
        return agentsData.map((agent: any) => ({
          agent_id: agent.id,
          agent_nom: agent.nom,
          agent_prenom: agent.prenom,
          agent_code: agent.code_agent,
          proprietes_count: 0,
          locations_count: 0,
          souscriptions_count: 0,
          total_du_loyers: 0,
          total_du_droits_terre: 0,
          total_du: 0,
          total_verse: 0,
          ecart: 0,
          derniere_collecte: null,
        })) as AgentRecoveryData[];
      }

      const [locationsData, souscriptionsData] = await Promise.all([
        apiClient.select({
          table: "locations",
          columns: "id,propriete_id,loyer_mensuel,statut",
          filters: [
            { op: "in", column: "propriete_id", values: propertyIds },
            { op: "eq", column: "statut", value: "active" },
          ],
        }),
        apiClient.select({
          table: "souscriptions",
          columns: "id,propriete_id,phase_actuelle,statut,montant_droit_terre_mensuel",
          filters: [
            { op: "in", column: "propriete_id", values: propertyIds },
            { op: "eq", column: "statut", value: "active" },
            { op: "eq", column: "phase_actuelle", value: "droit_terre" },
          ],
        }),
      ]);

      // Payments: some imports store the target month in mois_concerne (locations),
      // while date_paiement may be the import date. Support both.
      const [paiementsLocationsByDate, paiementsLocationsByMonth, paiementsDroitTerreData] =
        await Promise.all([
          apiClient.select({
            table: "paiements_locations",
            columns: "id,location_id,montant,date_paiement,mois_concerne",
            filters: [
              { op: "gte", column: "date_paiement", value: startOfMonthDateTime },
              { op: "lte", column: "date_paiement", value: endOfMonthDateTime },
            ],
          }),
          apiClient.select({
            table: "paiements_locations",
            columns: "id,location_id,montant,date_paiement,mois_concerne",
            filters: [
              {
                op: "in",
                column: "mois_concerne",
                values: Array.from(new Set([monthFilter, `${monthFilter}-01`].filter(Boolean))),
              },
            ],
          }),
          apiClient.select({
            table: "paiements_droit_terre",
            columns: "id,souscription_id,montant,date_paiement",
            filters: [
              { op: "gte", column: "date_paiement", value: startOfMonthDateTime },
              { op: "lte", column: "date_paiement", value: endOfMonthDateTime },
            ],
          }),
        ]);

      // Joindre les données
      const agents = agentsData.map((agent: any) => {
        const agentProprietes = proprietesData.filter((p: any) => p.agent_id === agent.id);
        const proprietesWithRelations = agentProprietes.map((propriete: any) => {
          const proprieteLocations = locationsData
            .filter((l: any) => l.propriete_id === propriete.id)
            .map((location: any) => ({ ...location }));
          const proprieteSouscriptions = souscriptionsData
            .filter((s: any) => s.propriete_id === propriete.id)
            .map((souscription: any) => ({ ...souscription }));
          return {
            ...propriete,
            locations: proprieteLocations,
            souscriptions: proprieteSouscriptions
          };
        });
        return { ...agent, proprietes: proprietesWithRelations };
      });

      const paiementsLocationsMap = new Map<string, any>();
      for (const p of (paiementsLocationsByDate || []) as any[]) paiementsLocationsMap.set(p.id, p);
      for (const p of (paiementsLocationsByMonth || []) as any[]) paiementsLocationsMap.set(p.id, p);
      const paiementsLocations = Array.from(paiementsLocationsMap.values());
      const paiementsDroitTerre = (paiementsDroitTerreData || []) as any[];

      // Build location to property mappings
      const locationPropertyMap = new Map(
        locationsData.map((l: any) => [l.id, l.propriete_id])
      );

      // Build souscription to property mappings
      const souscriptionPropertyMap = new Map(
        souscriptionsData.map((s: any) => [s.id, s.propriete_id])
      );

      // Process recovery data
      return agents?.map(agent => {
        let total_du_loyers = 0;
        let total_du_droits_terre = 0;
        let locations_count = 0;
        let souscriptions_count = 0;

        // Calculate amounts due from assigned properties
        agent.proprietes?.forEach(propriete => {
          // Count and calculate rental income
          propriete.locations?.forEach(location => {
            locations_count++;
            const monthlyRent = toNumber(location.loyer_mensuel) || toNumber(propriete.loyer_mensuel);
            total_du_loyers += monthlyRent;
          });

          // Count and calculate land rights income
        propriete.souscriptions?.forEach(souscription => {
          // Comptabiliser toutes les souscriptions en phase de paiement des droits de terre
          if (souscription.phase_actuelle === 'droit_terre' && souscription.statut === 'active') {
            souscriptions_count++;
            const monthlyDroit = toNumber(souscription.montant_droit_terre_mensuel) || toNumber(propriete.droit_terre);
            total_du_droits_terre += monthlyDroit;
          }
        });
        });

        // Calculate total payments collected by agent for the month
        // Get property IDs for this agent
        const propertyIds = agent.proprietes?.map(p => p.id) || [];
        
        // Sum payments for locations managed by this agent
        const verseLoc = paiementsLocations
          ?.filter((p: any) => {
            const propertyId = locationPropertyMap.get(p.location_id);
            return propertyId && propertyIds.includes(propertyId);
          })
          .reduce((sum, p) => sum + toNumber(p.montant), 0) || 0;
        
        // Sum payments for land rights managed by this agent
        const verseDT = paiementsDroitTerre
          ?.filter((p: any) => {
            const propertyId = souscriptionPropertyMap.get(p.souscription_id);
            return propertyId && propertyIds.includes(propertyId);
          })
          .reduce((sum, p) => sum + toNumber(p.montant), 0) || 0;
        
        const total_verse = verseLoc + verseDT;

        const total_du = total_du_loyers + total_du_droits_terre;
        const ecart = total_verse - total_du;

        return {
          agent_id: agent.id,
          agent_nom: agent.nom,
          agent_prenom: agent.prenom,
          agent_code: agent.code_agent,
          proprietes_count: agent.proprietes?.length || 0,
          locations_count,
          souscriptions_count,
          total_du_loyers,
          total_du_droits_terre,
          total_du,
          total_verse,
          ecart,
          derniere_collecte: null // Will be implemented later
        } as AgentRecoveryData;
      }) || [];
    },
    // Keep previous data while fetching to prevent summary cards from flashing "0".
    placeholderData: (prev) => prev,
    staleTime: 120000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const agentsRecovery = agentsRecoveryQuery.data ?? [];
  const isLoading = agentsRecoveryQuery.isLoading;
  const isFetching = agentsRecoveryQuery.isFetching;

  // Filter agents based on search and status
  const filteredAgents = agentsRecovery.filter(agent => {
    const matchesSearch = 
      agent.agent_nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.agent_prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.agent_code.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'en_retard') {
      matchesStatus = agent.ecart < 0;
    } else if (statusFilter === 'en_avance') {
      matchesStatus = agent.ecart > 0;
    } else if (statusFilter === 'a_jour') {
      matchesStatus = agent.ecart === 0;
    }
    
    return matchesSearch && matchesStatus;
  });

  // Calculate totals for summary.
  const totalStats = useMemo(() => {
    return agentsRecovery.reduce(
      (acc, agent) => ({
        total_proprietes: acc.total_proprietes + agent.proprietes_count,
        total_locations: acc.total_locations + agent.locations_count,
        total_souscriptions: acc.total_souscriptions + agent.souscriptions_count,
        total_du: acc.total_du + agent.total_du,
        total_verse: acc.total_verse + agent.total_verse,
        total_ecart: acc.total_ecart + agent.ecart,
      }),
      {
        total_proprietes: 0,
        total_locations: 0,
        total_souscriptions: 0,
        total_du: 0,
        total_verse: 0,
        total_ecart: 0,
      },
    );
  }, [agentsRecovery]);

  // Keep previous totals visible while refetching a different month.
  // Use state (not ref) so the cards re-render when totals update.
  const [stableTotals, setStableTotals] = useState(totalStats);
  useEffect(() => {
    // When a fetch completes successfully, update the stable totals.
    // During isFetching, we keep showing the previous stable values.
    if (!isFetching) setStableTotals(totalStats);
  }, [isFetching, totalStats]);

  const displayTotals = isFetching ? stableTotals : totalStats;
  const showLoadingNumbers = isLoading && agentsRecovery.length === 0;

  // Handle agent selection
  const handleAgentSelect = (agentId: string) => {
    setSelectedAgentId(agentId);
    setViewMode('agent');
  };

  const handleBackToGlobal = () => {
    setSelectedAgentId(null);
    setViewMode('global');
  };

  // If individual agent view is selected, show the agent dashboard
  if (viewMode === 'agent' && selectedAgentId) {
    return (
      <AgentRecoveryDashboard 
        agentId={selectedAgentId} 
        onBack={handleBackToGlobal}
        initialMonth={monthFilter}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Situation de Recouvrement</h2>
          <p className="text-muted-foreground">
            Suivi des recouvrements par agent de terrain - Vue globale
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportRecouvrementData />
          <CancelRecouvrementImportDialog />
          <ExportToExcelButton
            filename={`recouvrement_${monthFilter}`}
            rows={filteredAgents}
            columns={[
              { header: "Agent", accessor: (r: AgentRecoveryData) => `${r.agent_prenom} ${r.agent_nom}` },
              { header: "Code", accessor: (r: AgentRecoveryData) => r.agent_code },
              { header: "Propriétés", accessor: (r: AgentRecoveryData) => r.proprietes_count },
              { header: "Dû Loyers", accessor: (r: AgentRecoveryData) => r.total_du_loyers },
              { header: "Dû Droits Terre", accessor: (r: AgentRecoveryData) => r.total_du_droits_terre },
              { header: "Total Dû", accessor: (r: AgentRecoveryData) => r.total_du },
              { header: "Versé", accessor: (r: AgentRecoveryData) => r.total_verse },
              { header: "Écart", accessor: (r: AgentRecoveryData) => r.ecart },
            ]}
            label="Export Résumé"
          />
          <ExportToExcelButton
            filename={`recouvrement_global_${monthFilter}`}
            rows={filteredAgents}
            columns={[
              { header: "Agent", accessor: (r: AgentRecoveryData) => `${r.agent_prenom} ${r.agent_nom}` },
              { header: "Code", accessor: (r: AgentRecoveryData) => r.agent_code },
              { header: "Propriétés", accessor: (r: AgentRecoveryData) => r.proprietes_count },
              { header: "Locations", accessor: (r: AgentRecoveryData) => r.locations_count },
              { header: "Souscriptions", accessor: (r: AgentRecoveryData) => r.souscriptions_count },
              { header: "Dû Loyers (FCFA)", accessor: (r: AgentRecoveryData) => r.total_du_loyers },
              { header: "Dû Droits Terre (FCFA)", accessor: (r: AgentRecoveryData) => r.total_du_droits_terre },
              { header: "Total Dû (FCFA)", accessor: (r: AgentRecoveryData) => r.total_du },
              { header: "Versé (FCFA)", accessor: (r: AgentRecoveryData) => r.total_verse },
              { header: "Écart (FCFA)", accessor: (r: AgentRecoveryData) => r.ecart },
              { header: "Statut", accessor: (r: AgentRecoveryData) => r.ecart < 0 ? 'En retard' : r.ecart > 0 ? 'En avance' : 'À jour' }
            ]}
            label="Export Détaillé"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Agents Actifs</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{agentsRecovery.length}</div>
            <p className="text-xs text-blue-600">
              {totalStats.total_proprietes} propriétés confiées
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Total Dû</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {showLoadingNumbers ? "..." : formatFCFA(displayTotals.total_du)}
            </div>
            <p className="text-xs text-orange-600">
              Montant à collecter ce mois
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Total Versé</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {showLoadingNumbers ? "..." : formatFCFA(displayTotals.total_verse)}
            </div>
            <p className="text-xs text-green-600">
              Montant versé en caisse
            </p>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br border-2 hover:shadow-lg transition-all duration-300 hover:scale-105 ${
          displayTotals.total_ecart >= 0 
            ? 'from-green-50 to-green-100 border-green-200' 
            : 'from-red-50 to-red-100 border-red-200'
        }`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${
              displayTotals.total_ecart >= 0 ? 'text-green-800' : 'text-red-800'
            }`}>Écart Global</CardTitle>
            <TrendingDown className={`h-4 w-4 ${
              displayTotals.total_ecart >= 0 ? 'text-green-600' : 'text-red-600'
            }`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold transition-all duration-300 ${
              displayTotals.total_ecart >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {showLoadingNumbers ? "..." : formatFCFA(displayTotals.total_ecart)}
            </div>
            <p className={`text-xs ${
              displayTotals.total_ecart >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {displayTotals.total_ecart >= 0 ? 'Excédent' : 'Retard'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Agent Selection */}
      <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-gray-800">
            Filtres et Sélection d'Agent
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{viewMode === 'global' ? 'Vue Globale' : 'Vue Agent'}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="month">Mois</Label>
              <Input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="agent-select">Agent spécifique</Label>
              <Select value={selectedAgentId || "global"} onValueChange={(value) => {
                if (value === "global") {
                  handleBackToGlobal();
                } else {
                  handleAgentSelect(value);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Vue globale</SelectItem>
                  {allAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.prenom} {agent.nom} ({agent.code_agent})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="search">Rechercher un agent</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Nom, prénom, code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="status">Statut</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les agents</SelectItem>
                  <SelectItem value="en_retard">En retard</SelectItem>
                  <SelectItem value="a_jour">À jour</SelectItem>
                  <SelectItem value="en_avance">En avance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setViewMode(viewMode === 'global' ? 'agent' : 'global')}
              >
                <Eye className="h-4 w-4 mr-2" />
                {viewMode === 'global' ? 'Vue Agent' : 'Vue Globale'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recovery Table */}
      <Card className="bg-gradient-to-br from-white to-gray-50 border-gray-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <DollarSign className="h-5 w-5 text-purple-600" />
            Tableau de Recouvrement - {format(new Date(`${monthFilter}-01`), 'MMMM yyyy', { locale: fr })}
          </CardTitle>
          <CardDescription className="text-gray-600">
            {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''} sur {agentsRecovery.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Chargement...</p>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-10">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-600">Aucun agent trouvé</h3>
              <p className="mt-1 text-sm text-gray-500">
                Aucun agent ne correspond aux critères de recherche.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="bg-white">
                <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <TableRow className="border-gray-200">
                    <TableHead className="text-gray-700 font-semibold">Agent</TableHead>
                    <TableHead className="text-gray-700 font-semibold">Code</TableHead>
                    <TableHead className="text-gray-700 font-semibold">Portefeuille</TableHead>
                    <TableHead className="text-right text-gray-700 font-semibold">Dû Loyers</TableHead>
                    <TableHead className="text-right text-gray-700 font-semibold">Dû Droits Terre</TableHead>
                    <TableHead className="text-right text-gray-700 font-semibold">Total Dû</TableHead>
                    <TableHead className="text-right text-gray-700 font-semibold">Versé</TableHead>
                    <TableHead className="text-right text-gray-700 font-semibold">Écart</TableHead>
                    <TableHead className="text-gray-700 font-semibold">Statut</TableHead>
                    <TableHead className="text-gray-700 font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.map((agent) => (
                    <TableRow key={agent.agent_id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border-gray-100">
                      <TableCell className="font-medium text-gray-800">
                        {agent.agent_prenom} {agent.agent_nom}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{agent.agent_code}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-gray-800 font-medium">{agent.proprietes_count} propriétés</div>
                          <div className="text-gray-500">
                            {agent.locations_count} locations, {agent.souscriptions_count} droits terre
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-orange-600 font-semibold bg-orange-50 px-2 py-1 rounded-md">
                          {formatFCFA(agent.total_du_loyers)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded-md">
                          {formatFCFA(agent.total_du_droits_terre)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded-md">
                          {formatFCFA(agent.total_du)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded-md">
                          {formatFCFA(agent.total_verse)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`font-bold px-2 py-1 rounded-md transition-all duration-300 ${
                          agent.ecart > 0 
                            ? 'text-green-600 bg-green-50' 
                            : agent.ecart < 0 
                            ? 'text-red-600 bg-red-50' 
                            : 'text-gray-600 bg-gray-50'
                        }`}>
                          {agent.ecart >= 0 ? '+' : ''}{formatFCFA(agent.ecart)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`font-medium ${
                          agent.ecart < 0 
                            ? 'bg-red-100 text-red-700 border-red-200' 
                            : agent.ecart > 0 
                            ? 'bg-green-100 text-green-700 border-green-200' 
                            : 'bg-blue-100 text-blue-700 border-blue-200'
                        }`}>
                          {agent.ecart < 0 ? 'En retard' : 
                           agent.ecart > 0 ? 'En avance' : 
                           'À jour'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAgentSelect(agent.agent_id)}
                          className="flex items-center gap-1 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200"
                        >
                          <User className="h-3 w-3" />
                          Détails
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
