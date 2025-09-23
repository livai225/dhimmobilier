import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ArrowLeft, TrendingUp, TrendingDown, Target, Calendar, MapPin, Phone, Mail } from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

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

interface Props {
  agentId: string;
  onBack: () => void;
}

export function AgentRecoveryDashboard({ agentId, onBack }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

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
            souscriptions:souscriptions!propriete_id (montant_droit_terre_mensuel, type_souscription)
          `)
          .eq('agent_id', agentId);

        let du_loyers = 0;
        let du_droits_terre = 0;

        properties?.forEach(prop => {
          // Calculate rental dues
          prop.locations?.forEach(loc => {
            du_loyers += loc.loyer_mensuel || prop.loyer_mensuel || 0;
          });

          // Calculate land rights dues
          prop.souscriptions?.forEach(sub => {
            if (sub.type_souscription === 'mise_en_garde') {
              du_droits_terre += sub.montant_droit_terre_mensuel || prop.droit_terre || 0;
            }
          });
        });

        // Get actual deposits for this month
        const { data: deposits } = await supabase
          .from('cash_transactions')
          .select('montant')
          .eq('agent_id', agentId)
          .eq('type_operation', 'versement_agent')
          .gte('date_transaction', startDate)
          .lte('date_transaction', endDate);

        const verse = deposits?.reduce((sum, d) => sum + (d.montant || 0), 0) || 0;
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
            id, client_id, montant_droit_terre_mensuel, type_souscription,
            clients:clients!client_id (nom, prenom)
          )
        `)
        .eq('agent_id', agentId);

      if (error) throw error;

      return props?.map(prop => {
        const locations_count = prop.locations?.length || 0;
        const souscriptions_count = prop.souscriptions?.filter(s => s.type_souscription === 'mise_en_garde').length || 0;
        
        const monthly_rent_due = prop.locations?.reduce((sum, loc) => sum + (loc.loyer_mensuel || 0), 0) || 0;
        const monthly_droit_terre_due = prop.souscriptions
          ?.filter(s => s.type_souscription === 'mise_en_garde')
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

  if (!agent) {
    return <div>Chargement...</div>;
  }

  const currentMonthData = performance[performance.length - 1] || {
    du_loyers: 0,
    du_droits_terre: 0,
    total_du: 0,
    verse: 0,
    taux_recouvrement: 0,
    ecart: 0
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
              {currentMonthData.verse.toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              Taux: {currentMonthData.taux_recouvrement.toFixed(1)}%
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
              currentMonthData.ecart >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {currentMonthData.ecart >= 0 ? '+' : ''}{currentMonthData.ecart.toLocaleString()}
            </div>
            <Progress 
              value={Math.min(currentMonthData.taux_recouvrement, 100)} 
              className="mt-2" 
            />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="properties">Portefeuille</TabsTrigger>
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
    </div>
  );
}