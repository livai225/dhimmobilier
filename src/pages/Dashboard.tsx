import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Building, FileText, TrendingUp, AlertCircle, CheckCircle, Home, DollarSign, Calendar, Clock, Plus, Receipt, CreditCard, MapPin } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  // Main dashboard data
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [
        clients, 
        proprietes, 
        factures, 
        souscriptions, 
        locations, 
        paiementsFactures, 
        paiementsLocations, 
        paiementsSouscriptions,
        echeances
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact' }),
        supabase.from('proprietes').select('*'),
        supabase.from('factures_fournisseurs').select('*'),
        supabase.from('souscriptions').select('*'),
        supabase.from('locations').select('*'),
        supabase.from('paiements_factures').select('*'),
        supabase.from('paiements_locations').select('*'),
        supabase.from('paiements_souscriptions').select('*'),
        supabase.from('echeances_droit_terre').select('*'),
      ]);

      // Calculate main KPIs
      const totalFactures = factures.data?.reduce((sum, f) => sum + (f.montant_total || 0), 0) || 0;
      const totalPaiementsFactures = paiementsFactures.data?.reduce((sum, p) => sum + (p.montant || 0), 0) || 0;
      const totalRevenuLocations = paiementsLocations.data?.reduce((sum, p) => sum + (p.montant || 0), 0) || 0;
      const totalRevenuSouscriptions = paiementsSouscriptions.data?.reduce((sum, p) => sum + (p.montant || 0), 0) || 0;
      
      const chiffreAffaires = totalRevenuLocations + totalRevenuSouscriptions;
      const facturesImpayees = factures.data?.reduce((sum, f) => sum + (f.solde || 0), 0) || 0;
      const dettesLocations = locations.data?.reduce((sum, l) => sum + (l.dette_totale || 0), 0) || 0;
      const echeancesEnRetard = echeances.data?.filter(e => 
        e.statut === 'en_attente' && new Date(e.date_echeance) < new Date()
      ).reduce((sum, e) => sum + (e.montant || 0), 0) || 0;
      
      const creancesImpayees = facturesImpayees + dettesLocations + echeancesEnRetard;
      
      const souscriptionsActives = souscriptions.data?.filter(s => s.statut === 'active').length || 0;
      const locationsActives = locations.data?.filter(l => l.statut === 'active').length || 0;
      const contratsActifs = souscriptionsActives + locationsActives;
      
      const proprietesLibres = proprietes.data?.filter(p => p.statut === 'Libre').length || 0;
      const proprietesOccupees = proprietes.data?.filter(p => p.statut === 'Occupé').length || 0;

      // Revenue breakdown
      const revenueBreakdown = [
        { name: 'Locations', value: totalRevenuLocations, color: '#8b5cf6' },
        { name: 'Souscriptions', value: totalRevenuSouscriptions, color: '#06b6d4' },
      ];

      // Monthly revenue trend (last 6 months)
      const monthlyRevenue = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().slice(0, 7);
        
        const monthLocations = paiementsLocations.data?.filter(p => 
          p.date_paiement.startsWith(monthKey)
        ).reduce((sum, p) => sum + (p.montant || 0), 0) || 0;
        
        const monthSouscriptions = paiementsSouscriptions.data?.filter(p => 
          p.date_paiement.startsWith(monthKey)
        ).reduce((sum, p) => sum + (p.montant || 0), 0) || 0;
        
        monthlyRevenue.push({
          month: date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
          locations: monthLocations,
          souscriptions: monthSouscriptions,
          total: monthLocations + monthSouscriptions
        });
      }

      return {
        // Main KPIs
        chiffreAffaires,
        creancesImpayees,
        contratsActifs,
        proprietesDisponibles: proprietesLibres,
        
        // Detailed stats
        totalClients: clients.count || 0,
        revenusRecurrents: (locations.data?.reduce((sum, l) => sum + (l.loyer_mensuel || 0), 0) || 0) +
                          (souscriptions.data?.filter(s => s.statut === 'active').reduce((sum, s) => sum + (s.montant_mensuel || 0), 0) || 0),
        totalFactures: factures.data?.length || 0,
        facturesImpayeesCount: factures.data?.filter(f => f.solde > 0).length || 0,
        facturesImpayeesMontant: facturesImpayees,
        tauxOccupation: proprietes.data?.length ? Math.round((proprietesOccupees / proprietes.data.length) * 100) : 0,
        echeancesEnRetardCount: echeances.data?.filter(e => 
          e.statut === 'en_attente' && new Date(e.date_echeance) < new Date()
        ).length || 0,
        
        // Charts data
        revenueBreakdown,
        monthlyRevenue,
        
        // Alerts
        facturesImpayeesListe: factures.data?.filter(f => f.solde > 0 && 
          new Date(f.date_facture) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ) || [],
        locationsEndettees: locations.data?.filter(l => l.dette_totale > 100000) || [],
        proprietesLibresLongtemps: proprietes.data?.filter(p => 
          p.statut === 'Libre' && 
          new Date(p.updated_at) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        ) || [],
      };
    },
  });

  // Recent activity data
  const { data: recentActivity } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const [recentSouscriptions, recentPaiements, recentClients] = await Promise.all([
        supabase.from('souscriptions').select('*, clients(nom, prenom), proprietes(nom)')
          .order('created_at', { ascending: false }).limit(5),
        supabase.from('paiements_locations').select('*, locations(*, clients(nom, prenom), proprietes(nom))')
          .order('date_paiement', { ascending: false }).limit(5),
        supabase.from('clients').select('*').order('created_at', { ascending: false }).limit(5),
      ]);

      return {
        recentSouscriptions: recentSouscriptions.data || [],
        recentPaiements: recentPaiements.data || [],
        recentClients: recentClients.data || [],
      };
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const chartConfig = {
    locations: {
      label: "Locations",
      color: "hsl(var(--primary))",
    },
    souscriptions: {
      label: "Souscriptions", 
      color: "hsl(var(--secondary))",
    },
  };

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Vue d'ensemble complète de votre activité immobilière
          </p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          <Button onClick={() => navigate('/souscriptions')} size="sm" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Souscription
          </Button>
          <Button onClick={() => navigate('/locations')} variant="outline" size="sm" className="w-full sm:w-auto">
            <Home className="h-4 w-4 mr-2" />
            Location
          </Button>
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats?.chiffreAffaires || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Revenus encaissés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Créances impayées</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(stats?.creancesImpayees || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              À recouvrer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contrats actifs</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.contratsActifs || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Souscriptions + Locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propriétés disponibles</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.proprietesDisponibles || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Libres pour location
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              Clients enregistrés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus récurrents</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.revenusRecurrents || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Par mois
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Factures fournisseurs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalFactures || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.facturesImpayeesCount || 0} impayées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux d'occupation</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.tauxOccupation || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Propriétés occupées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Échéances en retard</CardTitle>
            <Clock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats?.echeancesEnRetardCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Droit de terre
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">85%</div>
            <p className="text-xs text-muted-foreground">
              Score global
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Revenue Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Évolution des revenus</CardTitle>
            <CardDescription>
              Revenus mensuels par type (derniers 6 mois)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6">
            <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] lg:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.monthlyRevenue || []} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    fontSize={12}
                    tickMargin={5}
                  />
                  <YAxis 
                    tickFormatter={(value) => `${value / 1000}k`}
                    fontSize={12}
                    width={40}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => [formatCurrency(value), ""]}
                  />
                  <Area
                    type="monotone"
                    dataKey="locations"
                    stackId="1"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="souscriptions"
                    stackId="1"
                    stroke="hsl(var(--secondary))"
                    fill="hsl(var(--secondary))"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Revenue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition des revenus</CardTitle>
            <CardDescription>
              Par type d'activité
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-6">
            <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] lg:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <Pie
                    data={stats?.revenueBreakdown || []}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    dataKey="value"
                    label={({ name, percent }) => 
                      window.innerWidth > 640 ? `${name} ${(percent * 100).toFixed(0)}%` : `${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {stats?.revenueBreakdown?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    formatter={(value: number) => [formatCurrency(value), ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities and Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Recent Subscriptions */}
        <Card>
          <CardHeader>
            <CardTitle>Souscriptions récentes</CardTitle>
            <CardDescription>
              Dernières souscriptions enregistrées
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity?.recentSouscriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune souscription</p>
              ) : (
                recentActivity?.recentSouscriptions.map((souscription) => (
                  <div key={souscription.id} className="flex items-center">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">
                        {souscription.clients?.nom} {souscription.clients?.prenom}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {souscription.proprietes?.nom} - {souscription.phase_actuelle}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <CardTitle>Paiements récents</CardTitle>
            <CardDescription>
              Derniers paiements reçus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity?.recentPaiements.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun paiement</p>
              ) : (
                recentActivity?.recentPaiements.map((paiement) => (
                  <div key={paiement.id} className="flex items-center">
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">
                        {formatCurrency(paiement.montant)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {paiement.locations?.clients?.nom} - {paiement.locations?.proprietes?.nom}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Clients */}
        <Card>
          <CardHeader>
            <CardTitle>Nouveaux clients</CardTitle>
            <CardDescription>
              Derniers clients ajoutés
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity?.recentClients.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun client</p>
              ) : (
                recentActivity?.recentClients.map((client) => (
                  <div key={client.id} className="flex items-center">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">{client.nom} {client.prenom}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.telephone_principal || "Pas de téléphone"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Alertes importantes
            </CardTitle>
            <CardDescription>
              Points d'attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.facturesImpayeesListe?.length > 0 && (
                <div className="flex items-center">
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                    <Receipt className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-600">
                      {stats.facturesImpayeesListe.length} facture(s) impayée(s)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Depuis plus de 30 jours
                    </p>
                  </div>
                </div>
              )}
              
              {stats?.locationsEndettees?.length > 0 && (
                <div className="flex items-center">
                  <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center">
                    <Home className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-orange-600">
                      {stats.locationsEndettees.length} location(s) endettée(s)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Dette &gt; 100 000 FCFA
                    </p>
                  </div>
                </div>
              )}
              
              {stats?.proprietesLibresLongtemps?.length > 0 && (
                <div className="flex items-center">
                  <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-yellow-600">
                      {stats.proprietesLibresLongtemps.length} propriété(s) libre(s)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Depuis plus de 90 jours
                    </p>
                  </div>
                </div>
              )}

              {(!stats?.facturesImpayeesListe?.length && 
                !stats?.locationsEndettees?.length && 
                !stats?.proprietesLibresLongtemps?.length) && (
                <p className="text-sm text-muted-foreground">Aucune alerte</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}