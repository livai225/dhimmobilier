import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { AgentRecoveryDashboard } from "@/components/AgentRecoveryDashboard";
import { Search, TrendingUp, TrendingDown, DollarSign, Users, User, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
      const { data, error } = await supabase
        .from('agents_recouvrement')
        .select('id, nom, prenom, code_agent')
        .eq('statut', 'actif')
        .order('nom');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch agents with their recovery data
  const { data: agentsRecovery = [], isLoading } = useQuery({
    queryKey: ['agents-recovery', monthFilter],
    queryFn: async () => {
      // Get agents with their assigned properties
      const { data: agents, error: agentsError } = await supabase
        .from('agents_recouvrement')
        .select(`
          id, nom, prenom, code_agent, statut,
          proprietes:proprietes!agent_id (
            id, nom, usage, loyer_mensuel, droit_terre,
            locations:locations!propriete_id (
              id, client_id, loyer_mensuel, date_debut,
              clients:clients!client_id (nom, prenom)
            ),
        souscriptions:souscriptions!propriete_id (
          id, client_id, type_souscription, montant_droit_terre_mensuel, phase_actuelle, statut,
          clients:clients!client_id (nom, prenom)
        )
          )
        `)
        .eq('statut', 'actif')
        .order('nom')
        .limit(999999);

      if (agentsError) throw agentsError;

      // Calculate the date range for the month
      const startOfMonth = `${monthFilter}-01`;
      const date = new Date(`${monthFilter}-01`);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const endOfMonth = `${monthFilter}-${String(lastDay).padStart(2, '0')}`;
      
      // Get all payments for locations in the month
      const { data: paiementsLocations, error: locError } = await supabase
        .from('paiements_locations')
        .select('location_id, montant')
        .gte('date_paiement', startOfMonth)
        .lte('date_paiement', endOfMonth)
        .limit(999999);

      if (locError) {
        console.error('Error fetching paiements_locations:', locError);
      }

      // Get all payments for land rights in the month
      const { data: paiementsDroitTerre, error: dtError } = await supabase
        .from('paiements_droit_terre')
        .select('souscription_id, montant')
        .gte('date_paiement', startOfMonth)
        .lte('date_paiement', endOfMonth)
        .limit(999999);

      if (dtError) {
        console.error('Error fetching paiements_droit_terre:', dtError);
      }

      // Get location to property mappings
      const locationIds = paiementsLocations?.map(p => p.location_id) || [];
      const { data: locations } = await supabase
        .from('locations')
        .select('id, propriete_id')
        .in('id', locationIds)
        .limit(999999);

      const locationPropertyMap = new Map(
        locations?.map(l => [l.id, l.propriete_id]) || []
      );

      // Get souscription to property mappings
      const souscriptionIds = paiementsDroitTerre?.map(p => p.souscription_id) || [];
      const { data: souscriptions } = await supabase
        .from('souscriptions')
        .select('id, propriete_id')
        .in('id', souscriptionIds)
        .limit(999999);

      const souscriptionPropertyMap = new Map(
        souscriptions?.map(s => [s.id, s.propriete_id]) || []
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
            const monthlyRent = location.loyer_mensuel || propriete.loyer_mensuel || 0;
            total_du_loyers += monthlyRent;
          });

          // Count and calculate land rights income
        propriete.souscriptions?.forEach(souscription => {
          // Comptabiliser toutes les souscriptions en phase de paiement des droits de terre
          if (souscription.phase_actuelle === 'droit_terre' && souscription.statut === 'active') {
            souscriptions_count++;
            const monthlyDroit = souscription.montant_droit_terre_mensuel || propriete.droit_terre || 0;
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
          .reduce((sum, p) => sum + (p.montant || 0), 0) || 0;
        
        // Sum payments for land rights managed by this agent
        const verseDT = paiementsDroitTerre
          ?.filter((p: any) => {
            const propertyId = souscriptionPropertyMap.get(p.souscription_id);
            return propertyId && propertyIds.includes(propertyId);
          })
          .reduce((sum, p) => sum + (p.montant || 0), 0) || 0;
        
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
  });

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

  // Calculate totals for summary
  const totalStats = agentsRecovery.reduce((acc, agent) => ({
    total_proprietes: acc.total_proprietes + agent.proprietes_count,
    total_locations: acc.total_locations + agent.locations_count,
    total_souscriptions: acc.total_souscriptions + agent.souscriptions_count,
    total_du: acc.total_du + agent.total_du,
    total_verse: acc.total_verse + agent.total_verse,
    total_ecart: acc.total_ecart + agent.ecart,
  }), {
    total_proprietes: 0,
    total_locations: 0,
    total_souscriptions: 0,
    total_du: 0,
    total_verse: 0,
    total_ecart: 0,
  });

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
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Situation de Recouvrement</h2>
          <p className="text-muted-foreground">
            Suivi des recouvrements par agent de terrain - Vue globale
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportRecouvrementData />
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
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents Actifs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agentsRecovery.length}</div>
            <p className="text-xs text-muted-foreground">
              {totalStats.total_proprietes} propriétés confiées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Dû</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStats.total_du.toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              Montant à collecter ce mois
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Versé</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalStats.total_verse.toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              Montant versé en caisse
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Écart Global</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              totalStats.total_ecart >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {totalStats.total_ecart.toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              {totalStats.total_ecart >= 0 ? 'Excédent' : 'Retard'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Agent Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Filtres et Sélection d'Agent
            <Badge variant="outline">{viewMode === 'global' ? 'Vue Globale' : 'Vue Agent'}</Badge>
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Tableau de Recouvrement - {format(new Date(`${monthFilter}-01`), 'MMMM yyyy', { locale: fr })}
          </CardTitle>
          <CardDescription>
            {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''} sur {agentsRecovery.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Chargement...</p>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-10">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">Aucun agent trouvé</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Aucun agent ne correspond aux critères de recherche.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Portefeuille</TableHead>
                    <TableHead className="text-right">Dû Loyers</TableHead>
                    <TableHead className="text-right">Dû Droits Terre</TableHead>
                    <TableHead className="text-right">Total Dû</TableHead>
                    <TableHead className="text-right">Versé</TableHead>
                    <TableHead className="text-right">Écart</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.map((agent) => (
                    <TableRow key={agent.agent_id}>
                      <TableCell className="font-medium">
                        {agent.agent_prenom} {agent.agent_nom}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{agent.agent_code}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{agent.proprietes_count} propriétés</div>
                          <div className="text-muted-foreground">
                            {agent.locations_count} locations, {agent.souscriptions_count} droits terre
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {agent.total_du_loyers.toLocaleString()} FCFA
                      </TableCell>
                      <TableCell className="text-right">
                        {agent.total_du_droits_terre.toLocaleString()} FCFA
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {agent.total_du.toLocaleString()} FCFA
                      </TableCell>
                      <TableCell className="text-right">
                        {agent.total_verse.toLocaleString()} FCFA
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        agent.ecart >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {agent.ecart >= 0 ? '+' : ''}{agent.ecart.toLocaleString()} FCFA
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          agent.ecart < 0 ? 'destructive' : 
                          agent.ecart > 0 ? 'default' : 
                          'secondary'
                        }>
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
                          className="flex items-center gap-1"
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