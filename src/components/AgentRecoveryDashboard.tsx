import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ArrowLeft, TrendingUp, TrendingDown, Target, Calendar, MapPin, Phone, Mail, Search, CreditCard } from "lucide-react";
import { ExportToExcelButton } from "@/components/ExportToExcelButton";
import { GroupedPaymentDialog } from "@/components/GroupedPaymentDialog";
import { format, subMonths, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface AgentDetails {
  id: string;
  nom: string;
  prenom: string;
  code_agent: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  date_embauche: string;
  statut: string;
}

interface AgentPerformance {
  month: string;
  du_loyers: number;
  du_droits_terre: number;
  total_du: number;
  verse: number;
  taux_recouvrement: number;
  ecart: number;
}

interface PropertyAssignment {
  id: string;
  nom: string;
  adresse?: string;
  zone?: string;
  locations_count: number;
  souscriptions_count: number;
  monthly_rent_due: number;
  monthly_droit_terre_due: number;
  last_collection?: string;
  status: 'active' | 'suspended' | 'warning';
}

interface ClientRecoveryStatus {
  client_id: string;
  client_nom: string;
  client_prenom: string;
  client_telephone?: string;
  contract_types: ('location' | 'souscription')[];
  
  montant_du_locations: number;
  montant_du_droits_terre: number;
  total_du: number;
  
  montant_paye_locations: number;
  montant_paye_droits_terre: number;
  total_paye: number;
  
  statut: 'paye' | 'partiel' | 'impaye';
  last_payment_date?: string;
  
  locations: Array<{ id: string; propriete_nom: string; loyer_mensuel: number }>;
  souscriptions: Array<{ id: string; propriete_nom: string; montant_mensuel: number }>;
}

interface Props {
  agentId: string;
  onBack: () => void;
  initialMonth?: string;
}

export function AgentRecoveryDashboard({ agentId, onBack, initialMonth }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || format(new Date(), 'yyyy-MM'));
  const [clientStatusFilter, setClientStatusFilter] = useState<'all' | 'paye' | 'partiel' | 'impaye'>('all');
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [clientContractFilter, setClientContractFilter] = useState<'all' | 'location' | 'souscription'>('all');
  const [groupedPaymentDialog, setGroupedPaymentDialog] = useState<{
    isOpen: boolean;
    paymentType: 'location' | 'souscription' | 'droit_terre';
  }>({ isOpen: false, paymentType: 'location' });

  // Query alternative pour calculer les montants versés de manière plus directe
  const { data: agentPayments } = useQuery({
    queryKey: ['agent-payments', agentId, selectedMonth],
    queryFn: async () => {
      if (!selectedMonth) return { totalVerse: 0, details: [] };

      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-31`;

      // Get agent's properties
      const { data: properties } = await supabase
        .from('proprietes')
        .select('id')
        .eq('agent_id', agentId)
        .limit(999999);

      if (!properties || properties.length === 0) {
        return { totalVerse: 0, details: [] };
      }

      const propertyIds = properties.map(p => p.id);

      // Get locations for these properties
      const { data: locations } = await supabase
        .from('locations')
        .select('id')
        .in('propriete_id', propertyIds)
        .limit(999999);

      const locationIds = locations?.map(l => l.id) || [];

      // Get souscriptions for these properties
      const { data: souscriptions } = await supabase
        .from('souscriptions')
        .select('id')
        .in('propriete_id', propertyIds)
        .limit(999999);

      const souscriptionIds = souscriptions?.map(s => s.id) || [];

      // Get payments for locations
      const { data: paiementsLoc } = await supabase
        .from('paiements_locations')
        .select('montant, date_paiement, location_id')
        .in('location_id', locationIds)
        .gte('date_paiement', startDate)
        .lte('date_paiement', endDate)
        .limit(999999);

      // Get payments for souscriptions
      const { data: paiementsDT } = await supabase
        .from('paiements_droit_terre')
        .select('montant, date_paiement, souscription_id')
        .in('souscription_id', souscriptionIds)
        .gte('date_paiement', startDate)
        .lte('date_paiement', endDate)
        .limit(999999);

      const totalVerse = 
        (paiementsLoc?.reduce((sum, p) => sum + (p.montant || 0), 0) || 0) +
        (paiementsDT?.reduce((sum, p) => sum + (p.montant || 0), 0) || 0);

      console.log(`Debug Agent Payments ${selectedMonth}:`, {
        agentId,
        propertyIds: propertyIds.length,
        locationIds: locationIds.length,
        souscriptionIds: souscriptionIds.length,
        paiementsLoc: paiementsLoc?.length || 0,
        paiementsDT: paiementsDT?.length || 0,
        totalVerse,
        paiementsLocDetails: paiementsLoc?.map(p => ({ montant: p.montant, date: p.date_paiement })),
        paiementsDTDetails: paiementsDT?.map(p => ({ montant: p.montant, date: p.date_paiement }))
      });

      return {
        totalVerse,
        details: [
          ...(paiementsLoc || []),
          ...(paiementsDT || [])
        ]
      };
    },
  });

  // Fetch agent details
  const { data: agent } = useQuery({
    queryKey: ['agent-details', agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents_recouvrement')
        .select('*')
        .eq('id', agentId)
        .single();
      
      if (error) throw error;
      return data as AgentDetails;
    },
  });

  // Fetch agent performance over last 6 months
  const { data: performance = [] } = useQuery({
    queryKey: ['agent-performance', agentId],
    queryFn: async () => {
      const results: AgentPerformance[] = [];
      
      for (let i = 0; i < 6; i++) {
        const targetDate = subMonths(new Date(), i);
        const monthKey = format(targetDate, 'yyyy-MM');
        const startDate = format(startOfMonth(targetDate), 'yyyy-MM-dd');
        const endDate = format(new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0), 'yyyy-MM-dd');

        // Get agent's properties and their dues for this month
        const { data: properties } = await supabase
          .from('proprietes')
          .select(`
            id, loyer_mensuel, droit_terre,
            locations:locations!propriete_id (loyer_mensuel),
            souscriptions:souscriptions!propriete_id (montant_droit_terre_mensuel, type_souscription, phase_actuelle, statut)
          `)
          .eq('agent_id', agentId)
          .limit(999999);

        let du_loyers = 0;
        let du_droits_terre = 0;

        properties?.forEach(prop => {
          // Calculate rental dues
          prop.locations?.forEach(loc => {
            du_loyers += loc.loyer_mensuel || prop.loyer_mensuel || 0;
          });

          // Calculate land rights dues
          prop.souscriptions?.forEach(sub => {
            // Comptabiliser toutes les souscriptions en phase de paiement des droits de terre
            if (sub.phase_actuelle === 'droit_terre' && sub.statut === 'active') {
              du_droits_terre += sub.montant_droit_terre_mensuel || prop.droit_terre || 0;
            }
          });
        });

        // Get property IDs for this agent
        const propertyIds = properties?.map(p => p.id) || [];
        
        console.log(`[${monthKey}] PropertyIds for agent:`, propertyIds.length);

        // Étape 1: Récupérer les IDs des locations liées aux propriétés de l'agent
        const { data: agentLocations } = await supabase
          .from('locations')
          .select('id')
          .in('propriete_id', propertyIds)
          .eq('statut', 'active')
          .limit(999999);

        const locationIds = agentLocations?.map(l => l.id) || [];
        console.log(`[${monthKey}] LocationIds found:`, locationIds.length);

        // Étape 2: Récupérer les IDs des souscriptions liées aux propriétés de l'agent
        const { data: agentSouscriptions } = await supabase
          .from('souscriptions')
          .select('id')
          .in('propriete_id', propertyIds)
          .eq('statut', 'active')
          .limit(999999);

        const souscriptionIds = agentSouscriptions?.map(s => s.id) || [];
        console.log(`[${monthKey}] SouscriptionIds found:`, souscriptionIds.length);

        // Étape 3: Récupérer les paiements de locations pour ce mois
        let totalPaiementsLocations = 0;
        if (locationIds.length > 0) {
          const { data: paiementsLocations } = await supabase
            .from('paiements_locations')
            .select('montant')
            .in('location_id', locationIds)
            .gte('date_paiement', startDate)
            .lte('date_paiement', endDate)
            .limit(999999);

          totalPaiementsLocations = paiementsLocations?.reduce((sum, p) => sum + (p.montant || 0), 0) || 0;
          console.log(`[${monthKey}] Paiements locations:`, paiementsLocations?.length || 0, 'Total:', totalPaiementsLocations);
        }

        // Étape 4: Récupérer les paiements de droits de terre pour ce mois
        let totalPaiementsDroitTerre = 0;
        if (souscriptionIds.length > 0) {
          const { data: paiementsDroitTerre } = await supabase
            .from('paiements_droit_terre')
            .select('montant')
            .in('souscription_id', souscriptionIds)
            .gte('date_paiement', startDate)
            .lte('date_paiement', endDate)
            .limit(999999);

          totalPaiementsDroitTerre = paiementsDroitTerre?.reduce((sum, p) => sum + (p.montant || 0), 0) || 0;
          console.log(`[${monthKey}] Paiements droit terre:`, paiementsDroitTerre?.length || 0, 'Total:', totalPaiementsDroitTerre);
        }

        const verse = totalPaiementsLocations + totalPaiementsDroitTerre;

        console.log(`[${monthKey}] FINAL - Versé:`, verse, 'Dû loyers:', du_loyers, 'Dû droits:', du_droits_terre);
        const total_du = du_loyers + du_droits_terre;
        const taux_recouvrement = total_du > 0 ? (verse / total_du) * 100 : 0;
        const ecart = verse - total_du;

        results.unshift({
          month: format(targetDate, 'MMM yyyy', { locale: fr }),
          du_loyers,
          du_droits_terre,
          total_du,
          verse,
          taux_recouvrement,
          ecart
        });
      }

      return results;
    },
  });

  // Fetch assigned properties with detailed status
  const { data: properties = [] } = useQuery({
    queryKey: ['agent-properties', agentId],
    queryFn: async () => {
      const { data: props, error } = await supabase
        .from('proprietes')
        .select(`
          id, nom, adresse, zone,
          locations:locations!propriete_id (
            id, client_id, loyer_mensuel, statut,
            clients:clients!client_id (nom, prenom)
          ),
          souscriptions:souscriptions!propriete_id (
            id, client_id, montant_droit_terre_mensuel, type_souscription, phase_actuelle, statut,
            clients:clients!client_id (nom, prenom)
          )
        `)
        .eq('agent_id', agentId)
        .limit(999999);

      if (error) throw error;

      return props?.map(prop => {
        const locations_count = prop.locations?.length || 0;
        const souscriptions_count = prop.souscriptions?.filter(s => s.phase_actuelle === 'droit_terre' && s.statut === 'active').length || 0;
        
        const monthly_rent_due = prop.locations?.reduce((sum, loc) => sum + (loc.loyer_mensuel || 0), 0) || 0;
        const monthly_droit_terre_due = prop.souscriptions
          ?.filter(s => s.phase_actuelle === 'droit_terre' && s.statut === 'active')
          .reduce((sum, sub) => sum + (sub.montant_droit_terre_mensuel || 0), 0) || 0;

        // Determine status based on activity
        let status: 'active' | 'suspended' | 'warning' = 'active';
        if (locations_count === 0 && souscriptions_count === 0) status = 'suspended';
        else if (monthly_rent_due + monthly_droit_terre_due === 0) status = 'warning';

        return {
          id: prop.id,
          nom: prop.nom,
          adresse: prop.adresse,
          zone: prop.zone,
          locations_count,
          souscriptions_count,
          monthly_rent_due,
          monthly_droit_terre_due,
          status
        } as PropertyAssignment;
      }) || [];
    },
  });

  // Fetch clients with their payment status for the selected month
  const { data: clientsStatus = [] } = useQuery({
    queryKey: ['agent-clients-status', agentId, selectedMonth],
    queryFn: async () => {
      const startOfMonth = `${selectedMonth}-01`;
      // Calculate the last day of the month dynamically
      const date = new Date(`${selectedMonth}-01`);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const endOfMonth = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

      // Récupérer toutes les propriétés de l'agent avec clients
      const { data: props } = await supabase
        .from('proprietes')
        .select(`
          id, nom,
          locations:locations!propriete_id (
            id, client_id, loyer_mensuel, statut,
            clients:clients!client_id (id, nom, prenom, telephone_principal)
          ),
          souscriptions:souscriptions!propriete_id (
            id, client_id, montant_droit_terre_mensuel, type_souscription, phase_actuelle, statut,
            clients:clients!client_id (id, nom, prenom, telephone_principal)
          )
        `)
        .eq('agent_id', agentId)
        .limit(999999);

      // Récupérer tous les paiements du mois
      const { data: paiementsLocations } = await supabase
        .from('paiements_locations')
        .select('location_id, montant')
        .gte('date_paiement', startOfMonth)
        .lte('date_paiement', endOfMonth)
        .limit(999999);

      const { data: paiementsDroitTerre } = await supabase
        .from('paiements_droit_terre')
        .select('souscription_id, montant')
        .gte('date_paiement', startOfMonth)
        .lte('date_paiement', endOfMonth)
        .limit(999999);

      // Grouper par client
      const clientsMap = new Map<string, ClientRecoveryStatus>();

      props?.forEach(prop => {
        // Traiter les locations
        prop.locations?.forEach((loc: any) => {
          if (loc.statut !== 'active') return;
          
          const client = loc.clients;
          if (!client) return;

          const clientKey = client.id;
          if (!clientsMap.has(clientKey)) {
            clientsMap.set(clientKey, {
              client_id: client.id,
              client_nom: client.nom,
              client_prenom: client.prenom || '',
              client_telephone: client.telephone_principal,
              contract_types: [],
              montant_du_locations: 0,
              montant_du_droits_terre: 0,
              total_du: 0,
              montant_paye_locations: 0,
              montant_paye_droits_terre: 0,
              total_paye: 0,
              statut: 'impaye',
              locations: [],
              souscriptions: [],
            });
          }

          const clientData = clientsMap.get(clientKey)!;
          if (!clientData.contract_types.includes('location')) {
            clientData.contract_types.push('location');
          }

          clientData.montant_du_locations += loc.loyer_mensuel || 0;
          clientData.locations.push({
            id: loc.id,
            propriete_nom: prop.nom,
            loyer_mensuel: loc.loyer_mensuel || 0,
          });

          // Vérifier paiements - SOMME de tous les paiements du mois
          const paiements = paiementsLocations?.filter((p: any) => p.location_id === loc.id) || [];
          const totalPaiements = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
          clientData.montant_paye_locations += totalPaiements;
        });

        // Traiter les souscriptions
        prop.souscriptions?.forEach((sub: any) => {
          // Ne comptabiliser que les souscriptions actives en phase de droits de terre
          if (sub.phase_actuelle !== 'droit_terre' || sub.statut !== 'active') return;
          
          const client = sub.clients;
          if (!client) return;

          const clientKey = client.id;
          if (!clientsMap.has(clientKey)) {
            clientsMap.set(clientKey, {
              client_id: client.id,
              client_nom: client.nom,
              client_prenom: client.prenom || '',
              client_telephone: client.telephone_principal,
              contract_types: [],
              montant_du_locations: 0,
              montant_du_droits_terre: 0,
              total_du: 0,
              montant_paye_locations: 0,
              montant_paye_droits_terre: 0,
              total_paye: 0,
              statut: 'impaye',
              locations: [],
              souscriptions: [],
            });
          }

          const clientData = clientsMap.get(clientKey)!;
          if (!clientData.contract_types.includes('souscription')) {
            clientData.contract_types.push('souscription');
          }

          clientData.montant_du_droits_terre += sub.montant_droit_terre_mensuel || 0;
          clientData.souscriptions.push({
            id: sub.id,
            propriete_nom: prop.nom,
            montant_mensuel: sub.montant_droit_terre_mensuel || 0,
          });

          // Vérifier paiements - SOMME de tous les paiements du mois
          const paiements = paiementsDroitTerre?.filter((p: any) => p.souscription_id === sub.id) || [];
          const totalPaiements = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
          clientData.montant_paye_droits_terre += totalPaiements;
        });
      });

      // Calculer totaux et statuts
      return Array.from(clientsMap.values()).map(client => {
        client.total_du = client.montant_du_locations + client.montant_du_droits_terre;
        client.total_paye = client.montant_paye_locations + client.montant_paye_droits_terre;

        if (client.total_paye >= client.total_du) {
          client.statut = 'paye';
        } else if (client.total_paye > 0) {
          client.statut = 'partiel';
        } else {
          client.statut = 'impaye';
        }

        return client;
      });
    },
  });

  if (!agent) {
    return <div>Chargement...</div>;
  }

  const filteredClients = clientsStatus.filter(client => {
    const matchesSearch = 
      client.client_nom.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      client.client_prenom.toLowerCase().includes(clientSearchTerm.toLowerCase());
    
    const matchesStatus = clientStatusFilter === 'all' || client.statut === clientStatusFilter;
    
    const matchesContract = 
      clientContractFilter === 'all' || 
      client.contract_types.includes(clientContractFilter);
    
    return matchesSearch && matchesStatus && matchesContract;
  });

  // Debug: afficher les statistiques des clients
  const clientsAvecLocations = clientsStatus.filter(c => c.contract_types.includes('location'));
  const clientsAvecLocationsDettes = clientsStatus.filter(c => c.contract_types.includes('location') && c.montant_du_locations > c.montant_paye_locations);
  const clientsAvecSouscriptions = clientsStatus.filter(c => c.contract_types.includes('souscription'));
  const clientsAvecSouscriptionsDettes = clientsStatus.filter(c => c.contract_types.includes('souscription') && c.montant_du_droits_terre > c.montant_paye_droits_terre);
  
  console.log('Debug clientsStatus:', {
    total: clientsStatus.length,
    payes: clientsStatus.filter(c => c.statut === 'paye').length,
    partiels: clientsStatus.filter(c => c.statut === 'partiel').length,
    impayes: clientsStatus.filter(c => c.statut === 'impaye').length,
    souscriptions: clientsAvecSouscriptions.length,
    locations: clientsAvecLocations.length,
    souscriptionsAvecDettes: clientsAvecSouscriptionsDettes.length,
    locationsAvecDettes: clientsAvecLocationsDettes.length,
    filteredClients: filteredClients.length,
    clientStatusFilter,
    clientContractFilter,
    // Détails des clients avec locations
    clientsAvecLocations: clientsAvecLocations.map(c => ({
      nom: `${c.client_prenom} ${c.client_nom}`,
      montantDu: c.montant_du_locations,
      montantPaye: c.montant_paye_locations,
      reste: c.montant_du_locations - c.montant_paye_locations
    }))
  });

  const clientStats = {
    total: clientsStatus.length,
    payes: clientsStatus.filter(c => c.statut === 'paye').length,
    partiels: clientsStatus.filter(c => c.statut === 'partiel').length,
    impayes: clientsStatus.filter(c => c.statut === 'impaye').length,
    taux_paiement: clientsStatus.length > 0 
      ? (clientsStatus.filter(c => c.statut === 'paye').length / clientsStatus.length) * 100 
      : 0,
  };

  const currentMonthData = performance[performance.length - 1] || {
    du_loyers: 0,
    du_droits_terre: 0,
    total_du: 0,
    verse: 0,
    taux_recouvrement: 0,
    ecart: 0
  };

  // Calculer le taux de recouvrement avec les nouvelles données
  const actualVerse = agentPayments?.totalVerse || 0;
  const actualTauxRecouvrement = currentMonthData.total_du > 0 ? (actualVerse / currentMonthData.total_du) * 100 : 0;
  const actualEcart = actualVerse - currentMonthData.total_du;

  const handleGroupedPayment = (paymentType: 'location' | 'souscription' | 'droit_terre') => {
    setGroupedPaymentDialog({ isOpen: true, paymentType });
  };

  const handleGroupedPaymentSuccess = () => {
    // Les queries seront invalidées automatiquement par le composant GroupedPaymentDialog
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-lg">
              {agent.prenom?.[0]}{agent.nom[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold">{agent.prenom} {agent.nom}</h2>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Code: {agent.code_agent}</span>
              {agent.telephone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {agent.telephone}
                </span>
              )}
              {agent.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {agent.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portefeuille</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{properties.length}</div>
            <p className="text-xs text-muted-foreground">
              {properties.reduce((sum, p) => sum + p.locations_count + p.souscriptions_count, 0)} contrats actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">À Collecter</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMonthData.total_du.toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              Loyers: {currentMonthData.du_loyers.toLocaleString()} | Droits: {currentMonthData.du_droits_terre.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Versé</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(agentPayments?.totalVerse || 0).toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              Taux: {actualTauxRecouvrement.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              actualEcart >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {actualEcart >= 0 ? '+' : ''}{actualEcart.toLocaleString()}
            </div>
            <Progress 
              value={Math.min(actualTauxRecouvrement, 100)} 
              className="mt-2" 
            />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="properties">Portefeuille</TabsTrigger>
          <TabsTrigger value="clients">Clients ({clientsStatus.length})</TabsTrigger>
          <TabsTrigger value="analytics">Analyses</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          {/* Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Évolution sur 6 mois</CardTitle>
              <CardDescription>Comparaison entre montants dus et versés</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString()} FCFA`} />
                  <Legend />
                  <Line type="monotone" dataKey="total_du" stroke="#f59e0b" name="Total Dû" />
                  <Line type="monotone" dataKey="verse" stroke="#10b981" name="Versé" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recovery Rate Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Taux de Recouvrement</CardTitle>
              <CardDescription>Pourcentage du montant dû effectivement collecté</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={performance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                  <Bar dataKey="taux_recouvrement" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="properties" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-blue-600">Locations</CardTitle>
                <CardDescription>Montant à collecter en loyers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {properties.reduce((sum, p) => sum + p.monthly_rent_due, 0).toLocaleString()} FCFA
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {properties.reduce((sum, p) => sum + p.locations_count, 0)} contrats de location
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-orange-600">Souscriptions</CardTitle>
                <CardDescription>Montant à collecter en droits de terre</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {properties.reduce((sum, p) => sum + p.monthly_droit_terre_due, 0).toLocaleString()} FCFA
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {properties.reduce((sum, p) => sum + p.souscriptions_count, 0)} contrats droits de terre
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Locations Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-600">Portfolio Locations</CardTitle>
              <CardDescription>Propriétés en location à gérer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Propriété</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead className="text-center">Nb Locations</TableHead>
                      <TableHead className="text-right">Loyers Mensuels</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {properties
                      .filter(property => property.locations_count > 0)
                      .map((property) => (
                        <TableRow key={`location-${property.id}`}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{property.nom}</div>
                              {property.adresse && (
                                <div className="text-xs text-muted-foreground">{property.adresse}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{property.zone || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{property.locations_count}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-blue-600">
                            {property.monthly_rent_due.toLocaleString()} FCFA
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              property.status === 'active' ? 'default' :
                              property.status === 'warning' ? 'secondary' :
                              'destructive'
                            }>
                              {property.status === 'active' ? 'Actif' :
                               property.status === 'warning' ? 'Attention' :
                               'Inactif'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                {properties.filter(p => p.locations_count > 0).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Aucune propriété en location assignée</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Souscriptions Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-orange-600">Portfolio Souscriptions</CardTitle>
              <CardDescription>Propriétés avec droits de terre à collecter</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Propriété</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead className="text-center">Nb Souscriptions</TableHead>
                      <TableHead className="text-right">Droits de Terre/mois</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {properties
                      .filter(property => property.souscriptions_count > 0)
                      .map((property) => (
                        <TableRow key={`souscription-${property.id}`}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{property.nom}</div>
                              {property.adresse && (
                                <div className="text-xs text-muted-foreground">{property.adresse}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{property.zone || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{property.souscriptions_count}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-orange-600">
                            {property.monthly_droit_terre_due.toLocaleString()} FCFA
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              property.status === 'active' ? 'default' :
                              property.status === 'warning' ? 'secondary' :
                              'destructive'
                            }>
                              {property.status === 'active' ? 'Actif' :
                               property.status === 'warning' ? 'Attention' :
                               'Inactif'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                {properties.filter(p => p.souscriptions_count > 0).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Aucune propriété avec droits de terre assignée</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          {/* Cartes récapitulatives */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clientStats.total}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-600">Payés</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{clientStats.payes}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {clientStats.taux_paiement.toFixed(1)}% du total
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-yellow-600">Partiels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{clientStats.partiels}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-600">Impayés</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{clientStats.impayes}</div>
              </CardContent>
            </Card>
          </div>

          {/* Statistiques par type de contrat */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-600">Locataires</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {clientsStatus.filter(c => c.contract_types.includes('location')).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Payés: {clientsStatus.filter(c => c.contract_types.includes('location') && c.statut === 'paye').length} • 
                  Partiels: {clientsStatus.filter(c => c.contract_types.includes('location') && c.statut === 'partiel').length} • 
                  Impayés: {clientsStatus.filter(c => c.contract_types.includes('location') && c.statut === 'impaye').length}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-orange-600">Souscripteurs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {clientsStatus.filter(c => c.contract_types.includes('souscription')).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Payés: {clientsStatus.filter(c => c.contract_types.includes('souscription') && c.statut === 'paye').length} • 
                  Partiels: {clientsStatus.filter(c => c.contract_types.includes('souscription') && c.statut === 'partiel').length} • 
                  Impayés: {clientsStatus.filter(c => c.contract_types.includes('souscription') && c.statut === 'impaye').length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filtres et Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtres et Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filtres */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="client-search">Rechercher un client</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        id="client-search"
                        placeholder="Nom ou prénom..."
                        value={clientSearchTerm}
                        onChange={(e) => setClientSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="status-filter">Statut de paiement</Label>
                    <Select value={clientStatusFilter} onValueChange={(value: any) => setClientStatusFilter(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les clients</SelectItem>
                        <SelectItem value="paye">Payés uniquement</SelectItem>
                        <SelectItem value="partiel">Partiels uniquement</SelectItem>
                        <SelectItem value="impaye">Impayés uniquement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="contract-filter">Type de contrat</Label>
                    <Select value={clientContractFilter} onValueChange={(value: any) => setClientContractFilter(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les contrats</SelectItem>
                        <SelectItem value="location">Locataires uniquement</SelectItem>
                        <SelectItem value="souscription">Souscripteurs uniquement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Actions de paiement groupé */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Paiements groupés</h4>
                      <p className="text-xs text-muted-foreground">
                        Effectuer des paiements groupés pour le mois sélectionné
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGroupedPayment('location')}
                        disabled={clientsStatus.filter(c => c.contract_types.includes('location') && c.montant_du_locations > c.montant_paye_locations).length === 0}
                        className="flex items-center gap-2"
                        title={`Clients avec dettes de location: ${clientsStatus.filter(c => c.contract_types.includes('location') && c.montant_du_locations > c.montant_paye_locations).length}`}
                      >
                        <CreditCard className="h-4 w-4" />
                        Paiement Locations
                        <span className="text-xs ml-1">
                          ({clientsStatus.filter(c => c.contract_types.includes('location') && c.montant_du_locations > c.montant_paye_locations).length})
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGroupedPayment('souscription')}
                        disabled={clientsStatus.filter(c => c.contract_types.includes('souscription') && c.montant_du_droits_terre > c.montant_paye_droits_terre).length === 0}
                        className="flex items-center gap-2"
                        title={`Clients avec dettes de droits de terre: ${clientsStatus.filter(c => c.contract_types.includes('souscription') && c.montant_du_droits_terre > c.montant_paye_droits_terre).length}`}
                      >
                        <CreditCard className="h-4 w-4" />
                        Paiement Droits Terre
                        <span className="text-xs ml-1">
                          ({clientsStatus.filter(c => c.contract_types.includes('souscription') && c.montant_du_droits_terre > c.montant_paye_droits_terre).length})
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tableau des clients */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Liste des Clients - {format(new Date(`${selectedMonth}-01`), 'MMMM yyyy', { locale: fr })}</CardTitle>
                <CardDescription>
                  {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''} sur {clientsStatus.length}
                  {clientStatusFilter !== 'all' && (
                    <span className="ml-2 text-blue-600">
                      (Filtre: {clientStatusFilter === 'paye' ? 'Payés' : clientStatusFilter === 'partiel' ? 'Partiels' : 'Impayés'})
                    </span>
                  )}
                  {clientContractFilter !== 'all' && (
                    <span className="ml-2 text-green-600">
                      (Type: {clientContractFilter === 'location' ? 'Locations' : 'Souscriptions'})
                    </span>
                  )}
                </CardDescription>
              </div>
              <ExportToExcelButton
                filename={`paiements_agent_${agent.code_agent}_${selectedMonth}`}
                rows={filteredClients}
                columns={[
                  { header: "Client", accessor: (c) => `${c.client_prenom} ${c.client_nom}` },
                  { header: "Téléphone", accessor: (c) => c.client_telephone || "" },
                  { header: "Type de contrat", accessor: (c) => c.contract_types.includes('location') && c.contract_types.includes('souscription') ? "Location + Souscription" : c.contract_types.includes('location') ? "Location" : "Souscription" },
                  { header: "Locations", accessor: (c) => c.locations.length },
                  { header: "Souscriptions", accessor: (c) => c.souscriptions.length },
                  { header: "Dû Loyers (FCFA)", accessor: (c) => c.montant_du_locations },
                  { header: "Dû Droits Terre (FCFA)", accessor: (c) => c.montant_du_droits_terre },
                  { header: "Total Dû (FCFA)", accessor: (c) => c.total_du },
                  { header: "Payé Loyers (FCFA)", accessor: (c) => c.montant_paye_locations },
                  { header: "Payé Droits Terre (FCFA)", accessor: (c) => c.montant_paye_droits_terre },
                  { header: "Total Payé (FCFA)", accessor: (c) => c.total_paye },
                  { header: "Reste à payer (FCFA)", accessor: (c) => c.total_du - c.total_paye },
                  { header: "Statut", accessor: (c) => c.statut === 'paye' ? 'Payé' : c.statut === 'partiel' ? 'Partiel' : 'Impayé' },
                  { header: "Adresse propriété", accessor: (c) => c.locations.map((l: any) => l.propriete_adresse || '').concat(c.souscriptions.map((s: any) => s.propriete_adresse || '')).filter(Boolean).join('; ') }
                ]}
                label="Exporter en Excel"
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Type de contrat</TableHead>
                      <TableHead className="text-right">Montant Dû</TableHead>
                      <TableHead className="text-right">Montant Payé</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow key={client.client_id}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{client.client_prenom} {client.client_nom}</div>
                            <div className="text-xs text-muted-foreground">
                              {client.locations.length > 0 && `${client.locations.length} location(s)`}
                              {client.locations.length > 0 && client.souscriptions.length > 0 && ' • '}
                              {client.souscriptions.length > 0 && `${client.souscriptions.length} souscription(s)`}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {client.client_telephone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {client.client_telephone}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {client.contract_types.includes('location') && (
                              <Badge variant="outline" className="bg-blue-50">Location</Badge>
                            )}
                            {client.contract_types.includes('souscription') && (
                              <Badge variant="outline" className="bg-orange-50">Souscription</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="space-y-1">
                            <div className="font-medium">{client.total_du.toLocaleString()} FCFA</div>
                            {client.montant_du_locations > 0 && (
                              <div className="text-xs text-blue-600">
                                Loyers: {client.montant_du_locations.toLocaleString()}
                              </div>
                            )}
                            {client.montant_du_droits_terre > 0 && (
                              <div className="text-xs text-orange-600">
                                Droits: {client.montant_du_droits_terre.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {client.total_paye.toLocaleString()} FCFA
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            client.statut === 'paye' ? 'default' :
                            client.statut === 'partiel' ? 'secondary' :
                            'destructive'
                          }>
                            {client.statut === 'paye' && '✅ Payé'}
                            {client.statut === 'partiel' && '⏳ Partiel'}
                            {client.statut === 'impaye' && '❌ Impayé'}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            Dû: {client.total_du.toLocaleString()} | Payé: {client.total_paye.toLocaleString()}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredClients.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun client trouvé
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Répartition des Revenus</CardTitle>
              <CardDescription>Analyse de la composition du portefeuille</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString()} FCFA`} />
                  <Legend />
                  <Bar dataKey="du_loyers" stackId="a" fill="#3b82f6" name="Loyers" />
                  <Bar dataKey="du_droits_terre" stackId="a" fill="#f59e0b" name="Droits de Terre" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Statistiques</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Moyenne mensuelle collectée:</span>
                  <span className="font-medium">
                    {(performance.reduce((sum, p) => sum + p.verse, 0) / Math.max(performance.length, 1)).toLocaleString()} FCFA
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meilleur mois:</span>
                  <span className="font-medium">
                    {Math.max(...performance.map(p => p.verse)).toLocaleString()} FCFA
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taux moyen:</span>
                  <span className="font-medium">
                    {(performance.reduce((sum, p) => sum + p.taux_recouvrement, 0) / Math.max(performance.length, 1)).toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Objectifs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Taux de recouvrement</span>
                    <span className="text-sm">{currentMonthData.taux_recouvrement.toFixed(1)}% / 95%</span>
                  </div>
                  <Progress value={Math.min(currentMonthData.taux_recouvrement, 100)} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Collecte mensuelle</span>
                    <span className="text-sm">{currentMonthData.verse.toLocaleString()} FCFA</span>
                  </div>
                  <Progress value={Math.min((currentMonthData.verse / Math.max(currentMonthData.total_du, 1)) * 100, 100)} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de paiement groupé */}
      <GroupedPaymentDialog
        agentId={agentId}
        selectedMonth={selectedMonth}
        paymentType={groupedPaymentDialog.paymentType}
        clients={clientsStatus}
        isOpen={groupedPaymentDialog.isOpen}
        onClose={() => setGroupedPaymentDialog({ isOpen: false, paymentType: 'location' })}
        onSuccess={handleGroupedPaymentSuccess}
      />
    </div>
  );
}