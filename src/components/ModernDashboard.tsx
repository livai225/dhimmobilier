import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { 
  Users, 
  Building, 
  FileText, 
  TrendingUp, 
  TrendingDown,
  AlertCircle, 
  CheckCircle, 
  Home, 
  DollarSign, 
  Calendar, 
  Clock, 
  Plus, 
  Receipt, 
  CreditCard, 
  MapPin,
  Activity,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Target,
  Zap
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  LineChart,
  Line,
  RadialBarChart,
  RadialBar,
  ComposedChart
} from "recharts";
import { useNavigate } from "react-router-dom";
import { BalanceBadge } from "@/components/BalanceBadge";
import { ProtectedAction } from "@/components/ProtectedAction";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileCard } from "@/components/MobileCard";

export default function ModernDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Main dashboard data
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    placeholderData: (previousData) => previousData,
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
        paiementsDroitTerre,
        echeances,
        soldeCaisseEntreprise,
        soldeCaisseVersement,
        depensesEntreprise,
        allCashTransactions
      ] = await Promise.all([
        apiClient.select({ table: 'clients' }),
        apiClient.select({ table: 'proprietes' }),
        apiClient.select({ table: 'factures_fournisseurs' }),
        apiClient.select({ table: 'souscriptions' }),
        apiClient.select({ table: 'locations' }),
        apiClient.select({ table: 'paiements_factures' }),
        apiClient.select({ table: 'paiements_locations' }),
        apiClient.select({ table: 'paiements_souscriptions' }),
        apiClient.select({ table: 'paiements_droit_terre' }),
        apiClient.select({ table: 'echeances_droit_terre' }),
        apiClient.rpc('get_solde_caisse_entreprise'),
        apiClient.rpc('get_current_cash_balance'),
        apiClient.select({ table: 'cash_transactions', filters: [{ op: 'eq', column: 'type_operation', value: 'depense_entreprise' }] }),
        apiClient.select({ table: 'cash_transactions' })
      ]);

      const clientsData = Array.isArray(clients) ? clients : [];
      const proprietesData = Array.isArray(proprietes) ? proprietes : [];
      const facturesData = Array.isArray(factures) ? factures : [];
      const souscriptionsData = Array.isArray(souscriptions) ? souscriptions : [];
      const locationsData = Array.isArray(locations) ? locations : [];
      const paiementsFacturesData = Array.isArray(paiementsFactures) ? paiementsFactures : [];
      const paiementsLocationsData = Array.isArray(paiementsLocations) ? paiementsLocations : [];
      const paiementsSouscriptionsData = Array.isArray(paiementsSouscriptions) ? paiementsSouscriptions : [];
      const paiementsDroitTerreData = Array.isArray(paiementsDroitTerre) ? paiementsDroitTerre : [];
      const echeancesData = Array.isArray(echeances) ? echeances : [];
      const allCashTransactionsData = Array.isArray(allCashTransactions) ? allCashTransactions : [];
      const soldeCaisseEntrepriseValue = Number.isFinite(Number(soldeCaisseEntreprise))
        ? Number(soldeCaisseEntreprise)
        : 0;
      const soldeCaisseVersementValue = Number.isFinite(Number(soldeCaisseVersement))
        ? Number(soldeCaisseVersement)
        : 0;
      const depensesEntrepriseData = Array.isArray(depensesEntreprise) ? depensesEntreprise : [];

      // Calculate main KPIs
      const totalFactures = facturesData.reduce((sum: number, f: any) => sum + (f.montant_total || 0), 0);
      const totalPaiementsFactures = paiementsFacturesData.reduce((sum: number, p: any) => sum + (p.montant || 0), 0);

      // Solde de caisse (ex-chiffre d'affaires) = revenus - dépenses entreprise
      const soldeCaisse = soldeCaisseEntrepriseValue;

      // Dépenses = paiements de factures fournisseurs + dépenses d'entreprise de la caisse
      const depensesEntrepriseMontant = depensesEntrepriseData.reduce((sum: number, t: any) => sum + (t.montant || 0), 0);
      const totalDepenses = totalPaiementsFactures + depensesEntrepriseMontant;

      // Solde de caisse versement (ancien solde caisse)
      const soldeCaisseVersementMontant = soldeCaisseVersementValue;

      const facturesImpayees = facturesData.reduce((sum: number, f: any) => sum + (f.solde || 0), 0);
      const dettesLocations = locationsData.reduce((sum: number, l: any) => sum + (l.dette_totale || 0), 0);
      const echeancesEnRetard = echeancesData.filter((e: any) =>
        e.statut === 'en_attente' && new Date(e.date_echeance) < new Date()
      ).reduce((sum: number, e: any) => sum + (e.montant || 0), 0);

      const creancesImpayees = facturesImpayees + dettesLocations + echeancesEnRetard;

      const souscriptionsActives = souscriptionsData.filter((s: any) => s.statut === 'active').length;
      const locationsActives = locationsData.filter((l: any) => l.statut === 'active').length;
      const contratsActifs = souscriptionsActives + locationsActives;

      const proprietesLibres = proprietesData.filter((p: any) => p.statut === 'Libre').length;
      const proprietesOccupees = proprietesData.filter((p: any) => p.statut === 'Occupé').length;

      // Calculate revenue details for charts
      const totalRevenuLocations = paiementsLocationsData.reduce((sum: number, p: any) => sum + (p.montant || 0), 0);
      const totalRevenuSouscriptions = paiementsSouscriptionsData.reduce((sum: number, p: any) => sum + (p.montant || 0), 0);
      const totalRevenuDroitTerre = paiementsDroitTerreData.reduce((sum: number, p: any) => sum + (p.montant || 0), 0);

      // Revenue breakdown with better colors
      const revenueBreakdown = [
        { name: 'Locations', value: totalRevenuLocations, color: '#3b82f6', fill: '#3b82f6' },
        { name: 'Souscriptions', value: totalRevenuSouscriptions, color: '#8b5cf6', fill: '#8b5cf6' },
        { name: 'Droit de terre', value: totalRevenuDroitTerre, color: '#10b981', fill: '#10b981' },
      ];

      // Monthly revenue trend (last 12 months)
      const monthlyRevenue = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().slice(0, 7);

        const monthLocations = paiementsLocationsData.filter((p: any) =>
          p.date_paiement?.startsWith(monthKey)
        ).reduce((sum: number, p: any) => sum + (p.montant || 0), 0);

        const monthSouscriptions = paiementsSouscriptionsData.filter((p: any) =>
          p.date_paiement?.startsWith(monthKey)
        ).reduce((sum: number, p: any) => sum + (p.montant || 0), 0);

        const monthDroitTerre = paiementsDroitTerreData.filter((p: any) =>
          p.date_paiement?.startsWith(monthKey)
        ).reduce((sum: number, p: any) => sum + (p.montant || 0), 0);

        monthlyRevenue.push({
          month: date.toLocaleDateString('fr-FR', { month: 'short' }),
          monthFull: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          locations: monthLocations,
          souscriptions: monthSouscriptions,
          droitTerre: monthDroitTerre,
          total: monthLocations + monthSouscriptions + monthDroitTerre
        });
      }

      // Performance metrics
      const tauxRecouvrement = contratsActifs > 0 ?
        Math.round((soldeCaisse / (soldeCaisse + creancesImpayees)) * 100) : 0;

      const tauxOccupation = proprietesData.length ?
        Math.round((proprietesOccupees / proprietesData.length) * 100) : 0;

      // Weekly performance data (last 7 days) based on cash_transactions
      // cash_transactions.date_transaction reflects the actual operation date,
      // unlike payment tables where date_paiement is the concerned period.
      const weeklyData = [];
      const toDate = (value: any) => {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
      };
      const inDayRange = (value: any, start: Date, end: Date) => {
        const d = toDate(value);
        return d ? d >= start && d <= end : false;
      };

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        const dayTransactions = allCashTransactionsData.filter(
          (t: any) => inDayRange(t.date_transaction, start, end)
        );

        const revenus = dayTransactions
          .filter((t: any) => t.type_transaction === 'entree' && t.type_operation !== 'annulation_import')
          .reduce((sum: number, t: any) => sum + (t.montant || 0), 0);
        const transactions = dayTransactions
          .filter((t: any) => t.type_operation !== 'annulation_import').length;

        weeklyData.push({
          day: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
          dayFull: date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' }),
          revenus,
          transactions
        });
      }

      return {
        // Main KPIs
        soldeCaisse,
        totalDepenses,
        soldeCaisseVersement: soldeCaisseVersementMontant,
        creancesImpayees,
        contratsActifs,
        proprietesDisponibles: proprietesLibres,

        // Detailed stats
        totalClients: clientsData.length,
        revenusRecurrents: locationsData.reduce((sum: number, l: any) => sum + (l.loyer_mensuel || 0), 0) +
                          souscriptionsData.filter((s: any) => s.statut === 'active').reduce((sum: number, s: any) => sum + (s.montant_mensuel || 0), 0),
        totalFactures: facturesData.length,
        facturesImpayeesCount: facturesData.filter((f: any) => f.solde > 0).length,
        facturesImpayeesMontant: facturesImpayees,
        tauxOccupation,
        tauxRecouvrement,
        echeancesEnRetardCount: echeancesData.filter((e: any) =>
          e.statut === 'en_attente' && new Date(e.date_echeance) < new Date()
        ).length,

        // Charts data
        revenueBreakdown,
        monthlyRevenue,
        weeklyData,

        // Alerts
        facturesImpayeesListe: facturesData.filter((f: any) => f.solde > 0 &&
          new Date(f.date_facture) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ),
        locationsEndettees: locationsData.filter((l: any) => l.dette_totale > 100000),
        proprietesLibresLongtemps: proprietesData.filter((p: any) =>
          p.statut === 'Libre' &&
          new Date(p.updated_at) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        ),
      };
    },
  });

  // Recent activity data
  const { data: recentActivity } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const [souscriptions, paiements, clients, proprietes, locations] = await Promise.all([
        apiClient.select({ table: 'souscriptions', orderBy: { column: 'created_at', ascending: false }, limit: 5 }),
        apiClient.select({ table: 'paiements_locations', orderBy: { column: 'date_paiement', ascending: false }, limit: 5 }),
        apiClient.select({ table: 'clients', orderBy: { column: 'created_at', ascending: false }, limit: 5 }),
        apiClient.select({ table: 'proprietes' }),
        apiClient.select({ table: 'locations' }),
      ]);

      const clientsList = Array.isArray(clients) ? clients : [];
      const proprietesList = Array.isArray(proprietes) ? proprietes : [];
      const locationsList = Array.isArray(locations) ? locations : [];

      // Join data for souscriptions
      const souscriptionsList = (Array.isArray(souscriptions) ? souscriptions : []).map((s: any) => ({
        ...s,
        clients: clientsList.find((c: any) => c.id === s.client_id),
        proprietes: proprietesList.find((p: any) => p.id === s.propriete_id)
      }));

      // Join data for paiements
      const paiementsList = (Array.isArray(paiements) ? paiements : []).map((p: any) => {
        const location = locationsList.find((l: any) => l.id === p.location_id);
        return {
          ...p,
          locations: location ? {
            ...location,
            clients: clientsList.find((c: any) => c.id === location.client_id),
            proprietes: proprietesList.find((pr: any) => pr.id === location.propriete_id)
          } : null
        };
      });

      return {
        recentSouscriptions: souscriptionsList,
        recentPaiements: paiementsList,
        recentClients: clientsList,
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
      color: "hsl(217, 91%, 60%)",
    },
    souscriptions: {
      label: "Souscriptions", 
      color: "hsl(262, 83%, 58%)",
    },
    droitTerre: {
      label: "Droit de terre",
      color: "hsl(142, 76%, 36%)",
    },
    total: {
      label: "Total",
      color: "hsl(0, 0%, 9%)",
    },
    revenus: {
      label: "Revenus",
      color: "hsl(142, 76%, 36%)",
    },
    transactions: {
      label: "Transactions",
      color: "hsl(217, 91%, 60%)",
    }
  };

  // Mobile KPI Cards
  const kpiCards = [
    {
      title: "Solde de caisse",
      value: formatCurrency(stats?.soldeCaisse || 0),
      description: "Revenus - dépenses",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
      trend: "+12%",
      trendColor: "text-green-600"
    },
    {
      title: "Dépenses",
      value: formatCurrency(stats?.totalDepenses || 0),
      description: "Factures payées",
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      trend: "+5%",
      trendColor: "text-red-600"
    },
    {
      title: "Solde caisse versement",
      value: formatCurrency(stats?.soldeCaisseVersement || 0),
      description: "Caisse disponible",
      icon: DollarSign,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      trend: "+8%",
      trendColor: "text-blue-600"
    },
    {
      title: "Créances impayées",
      value: formatCurrency(stats?.creancesImpayees || 0),
      description: "À recouvrer",
      icon: AlertCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      trend: "-3%",
      trendColor: "text-green-600"
    },
    {
      title: "Contrats actifs",
      value: stats?.contratsActifs || 0,
      description: "Total en cours",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      trend: "+15%",
      trendColor: "text-green-600"
    }
  ];

  if (isMobile) {
    return (
      <ProtectedAction permission="canAccessDashboard" showMessage={true}>
        <div className="container mx-auto p-4 space-y-6">
          {/* Header */}
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
              <p className="text-muted-foreground">
                Vue d'ensemble de votre activité immobilière
              </p>
            </div>
            
            <div className="flex flex-col space-y-2">
              <BalanceBadge />
              <div className="flex space-x-2">
                <Button onClick={() => navigate('/souscriptions')} size="sm" className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Souscription
                </Button>
                <Button onClick={() => navigate('/locations')} variant="outline" size="sm" className="flex-1">
                  <Home className="h-4 w-4 mr-2" />
                  Location
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile KPI Cards */}
          <div className="space-y-3">
            {kpiCards.map((card, index) => (
              <MobileCard
                key={index}
                title={card.title}
                fields={[
                  { label: "Valeur", value: <span className="text-lg font-bold">{card.value}</span> },
                  { label: "Tendance", value: <span className={`text-sm ${card.trendColor}`}>{card.trend}</span> }
                ]}
                actions={[
                  { label: "Voir détails", icon: <Eye className="h-4 w-4" />, onClick: () => {} }
                ]}
              />
            ))}
          </div>

          {/* Mobile Charts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Évolution des revenus
              </CardTitle>
              <CardDescription>Derniers 6 mois</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.monthlyRevenue?.slice(-6) || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis tickFormatter={(value) => `${value / 1000}k`} fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent />} formatter={(value: number) => [formatCurrency(value), ""]} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="hsl(217, 91%, 60%)"
                      fill="hsl(217, 91%, 60%)"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Mobile Revenue Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Répartition des revenus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={stats?.revenueBreakdown || []}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      dataKey="value"
                      label={false}
                    >
                      {stats?.revenueBreakdown?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} formatter={(value: number) => [formatCurrency(value), ""]} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Mobile Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activité récente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity?.recentPaiements.slice(0, 3).map((paiement) => (
                  <div key={paiement.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{formatCurrency(paiement.montant)}</p>
                        <p className="text-xs text-muted-foreground">
                          {paiement.locations?.clients?.nom} - {paiement.locations?.proprietes?.nom}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Location
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </ProtectedAction>
    );
  }

  return (
    <ProtectedAction permission="canAccessDashboard" showMessage={true}>
      <div className="container mx-auto p-2 sm:p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          <div>
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard Moderne
            </h2>
            <p className="text-muted-foreground">
              Vue d'ensemble complète de votre activité immobilière avec analyses avancées
            </p>
          </div>
          
          {/* Quick Actions */}
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
            <BalanceBadge />
            <Button onClick={() => navigate('/souscriptions')} size="sm" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Souscription
            </Button>
            <Button onClick={() => navigate('/locations')} variant="outline" size="sm" className="w-full sm:w-auto">
              <Home className="h-4 w-4 mr-2" />
              Nouvelle Location
            </Button>
          </div>
        </div>

        {/* Main KPIs with enhanced design */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpiCards.map((card, index) => (
            <Card key={index} className="relative overflow-hidden hover:shadow-lg transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.color}`}>
                  {card.value}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    {card.description}
                  </p>
                  <div className={`flex items-center text-xs ${card.trendColor}`}>
                    {card.trendColor.includes('green') ? (
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 mr-1" />
                    )}
                    {card.trend}
                  </div>
                </div>
              </CardContent>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
            </Card>
          ))}
        </div>

        {/* Enhanced Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Revenue Trend - Enhanced */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Évolution des revenus
              </CardTitle>
              <CardDescription>
                Analyse des revenus mensuels par type d'activité (derniers 12 mois)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <ChartContainer config={chartConfig} className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={stats?.monthlyRevenue || []} margin={{ top: 20, right: 20, left: 50, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      fontSize={12}
                      tickMargin={8}
                      height={40}
                    />
                    <YAxis 
                      tickFormatter={(value) => `${value / 1000}k`}
                      fontSize={12}
                      width={50}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => [formatCurrency(value), ""]}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area
                      type="monotone"
                      dataKey="locations"
                      stackId="1"
                      stroke="hsl(217, 91%, 60%)"
                      fill="hsl(217, 91%, 60%)"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="souscriptions"
                      stackId="1"
                      stroke="hsl(262, 83%, 58%)"
                      fill="hsl(262, 83%, 58%)"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="droitTerre"
                      stackId="1"
                      stroke="hsl(142, 76%, 36%)"
                      fill="hsl(142, 76%, 36%)"
                      fillOpacity={0.6}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="hsl(0, 0%, 9%)"
                      strokeWidth={3}
                      dot={{ fill: "hsl(0, 0%, 9%)", strokeWidth: 2, r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Revenue Breakdown - Enhanced */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Répartition des revenus
              </CardTitle>
              <CardDescription>
                Distribution par type d'activité
              </CardDescription>
            </CardHeader>
          <CardContent className="p-4 pie-chart-container">
            <div className="w-full h-[250px] flex items-center justify-center">
              <ChartContainer config={chartConfig} className="h-[200px] w-[200px] max-w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                    <Pie
                      data={stats?.revenueBreakdown || []}
                      cx="50%"
                      cy="50%"
                      outerRadius={35}
                      innerRadius={15}
                      dataKey="value"
                      label={false}
                    >
                      {stats?.revenueBreakdown?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => [formatCurrency(value), ""]}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
            
            {/* Légende personnalisée */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {stats?.revenueBreakdown?.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {entry.name} ({((entry.value / (stats?.revenueBreakdown?.reduce((sum, item) => sum + item.value, 0) || 1)) * 100).toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taux d'occupation</CardTitle>
              <Target className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats?.tauxOccupation || 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                Propriétés occupées
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taux de recouvrement</CardTitle>
              <Zap className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats?.tauxRecouvrement || 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                Efficacité de recouvrement
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenus récurrents</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(stats?.revenusRecurrents || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Par mois
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">
                {stats?.totalClients || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Clients enregistrés
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Performance hebdomadaire
            </CardTitle>
            <CardDescription>
              Revenus et transactions des 7 derniers jours avec tendances
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <ChartContainer config={chartConfig} className="h-[300px] w-full composed-chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats?.weeklyData || []} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="day" 
                    fontSize={12}
                    tickMargin={8}
                    height={40}
                  />
                  <YAxis 
                    yAxisId="left"
                    tickFormatter={(value) => `${value / 1000}k`}
                    fontSize={12}
                    width={40}
                    label={{ value: 'Revenus', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    fontSize={12}
                    width={40}
                    label={{ value: 'Transactions', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }}
                  />
                  <ChartTooltip 
                    content={<ChartTooltipContent />} 
                    formatter={(value: number, name: string) => [
                      name === 'revenus' ? formatCurrency(value) : value, 
                      name === 'revenus' ? 'Revenus' : 'Transactions'
                    ]}
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data?.dayFull || label;
                    }}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar 
                    yAxisId="left" 
                    dataKey="revenus" 
                    fill="hsl(142, 76%, 36%)" 
                    radius={[4, 4, 0, 0]}
                    name="Revenus"
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="transactions" 
                    stroke="hsl(217, 91%, 60%)" 
                    strokeWidth={3}
                    dot={{ fill: "hsl(217, 91%, 60%)", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: "hsl(217, 91%, 60%)", strokeWidth: 2 }}
                    name="Transactions"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
            
            {/* Statistiques hebdomadaires */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats?.weeklyData?.reduce((sum, day) => sum + day.revenus, 0) || 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total hebdomadaire</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {stats?.weeklyData?.reduce((sum, day) => sum + day.transactions, 0) || 0}
                </div>
                <div className="text-sm text-muted-foreground">Total transactions</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(Math.round((stats?.weeklyData?.reduce((sum, day) => sum + day.revenus, 0) || 0) / 7))}
                </div>
                <div className="text-sm text-muted-foreground">Moyenne quotidienne</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities and Alerts - Enhanced */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Recent Subscriptions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Souscriptions récentes
              </CardTitle>
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
                    <div key={souscription.id} className="flex items-center p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium">
                          {souscription.clients?.nom} {souscription.clients?.prenom}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {souscription.proprietes?.nom} - {souscription.phase_actuelle}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {souscription.statut}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Paiements récents
              </CardTitle>
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
                    <div key={paiement.id} className="flex items-center p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium">
                          {formatCurrency(paiement.montant)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {paiement.locations?.clients?.nom} - {paiement.locations?.proprietes?.nom}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Location
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Clients */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Nouveaux clients
              </CardTitle>
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
                    <div key={client.id} className="flex items-center p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                        <Users className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium">{client.nom} {client.prenom}</p>
                        <p className="text-xs text-muted-foreground">
                          {client.telephone_principal || "Pas de téléphone"}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Nouveau
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                Alertes importantes
              </CardTitle>
              <CardDescription>
                Points d'attention critiques
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.facturesImpayeesListe?.length > 0 && (
                  <div className="flex items-center p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                      <Receipt className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-red-600">
                        {stats.facturesImpayeesListe.length} facture(s) impayée(s)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Depuis plus de 30 jours
                      </p>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      Urgent
                    </Badge>
                  </div>
                )}
                
                {stats?.locationsEndettees?.length > 0 && (
                  <div className="flex items-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center">
                      <Home className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-orange-600">
                        {stats.locationsEndettees.length} location(s) endettée(s)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Dette &gt; 100 000 FCFA
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Attention
                    </Badge>
                  </div>
                )}
                
                {stats?.proprietesLibresLongtemps?.length > 0 && (
                  <div className="flex items-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-yellow-600">
                        {stats.proprietesLibresLongtemps.length} propriété(s) libre(s)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Depuis plus de 90 jours
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Info
                    </Badge>
                  </div>
                )}

                {(!stats?.facturesImpayeesListe?.length && 
                  !stats?.locationsEndettees?.length && 
                  !stats?.proprietesLibresLongtemps?.length) && (
                  <div className="flex items-center p-3 bg-green-50 rounded-lg">
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-600">
                        Aucune alerte critique
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tout va bien !
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedAction>
  );
}
