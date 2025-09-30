import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  TrendingUp, 
  Users, 
  Building, 
  CreditCard, 
  FileText, 
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Download,
  RefreshCw,
  Filter,
  Calendar,
  BarChart3,
  PieChart,
  Target
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";

interface DashboardWidgetProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  actions?: Array<{
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
  }>;
}

function DashboardWidget({ title, description, icon: Icon, children, actions }: DashboardWidgetProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
        {actions && (
          <div className="flex gap-1">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || "outline"}
                size="sm"
                onClick={action.onClick}
                className="h-8 w-8 p-0"
              >
                <action.icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

export function InteractiveDashboard() {
  // Recent activity data
  const { data: recentActivity, refetch: refetchActivity } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const [recentSouscriptions, recentPaiements, recentClients] = await Promise.all([
        supabase.from('souscriptions').select('*, clients(nom, prenom), proprietes(nom)')
          .order('created_at', { ascending: false }).limit(10),
        supabase.from('paiements_locations').select('*, locations(*, clients(nom, prenom), proprietes(nom))')
          .order('date_paiement', { ascending: false }).limit(10),
        supabase.from('clients').select('*').order('created_at', { ascending: false }).limit(10),
      ]);

      return {
        recentSouscriptions: recentSouscriptions.data || [],
        recentPaiements: recentPaiements.data || [],
        recentClients: recentClients.data || [],
      };
    },
  });

  // Alerts data
  const { data: alerts } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: async () => {
      const [factures, locations, proprietes, echeances] = await Promise.all([
        supabase.from('factures_fournisseurs').select('*, fournisseurs(nom)').gt('solde', 0),
        supabase.from('locations').select('*, clients(nom, prenom)').gt('dette_totale', 100000),
        supabase.from('proprietes').select('*').eq('statut', 'Libre'),
        supabase.from('echeances_droit_terre').select('*').eq('statut', 'en_attente').lt('date_echeance', new Date().toISOString())
      ]);

      return {
        facturesImpayees: factures.data || [],
        locationsEndettees: locations.data || [],
        proprietesLibres: proprietes.data || [],
        echeancesEnRetard: echeances.data || [],
      };
    },
  });

  const handleRefresh = () => {
    refetchActivity();
  };

  const handleExport = () => {
    // Export functionality
    console.log('Exporting data...');
  };

  const handleFilter = () => {
    // Filter functionality
    console.log('Opening filter...');
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Tableau de bord interactif</h2>
          <p className="text-muted-foreground">Vue d'ensemble en temps réel de votre activité</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button variant="outline" size="sm" onClick={handleFilter}>
            <Filter className="h-4 w-4 mr-2" />
            Filtrer
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="activity">Activité</TabsTrigger>
          <TabsTrigger value="alerts">Alertes</TabsTrigger>
          <TabsTrigger value="analytics">Analyses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardWidget
              title="Revenus du mois"
              description="Ce mois-ci"
              icon={TrendingUp}
              actions={[
                { label: "Voir détails", icon: Eye, onClick: () => {} }
              ]}
            >
              <div className="space-y-2">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(2500000)}
                </div>
                <div className="flex items-center text-sm text-green-600">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  +12% vs mois dernier
                </div>
              </div>
            </DashboardWidget>

            <DashboardWidget
              title="Contrats actifs"
              description="En cours"
              icon={Building}
              actions={[
                { label: "Voir détails", icon: Eye, onClick: () => {} }
              ]}
            >
              <div className="space-y-2">
                <div className="text-2xl font-bold text-blue-600">
                  45
                </div>
                <div className="flex items-center text-sm text-blue-600">
                  <Building className="h-4 w-4 mr-1" />
                  +3 nouveaux cette semaine
                </div>
              </div>
            </DashboardWidget>

            <DashboardWidget
              title="Taux d'occupation"
              description="Propriétés"
              icon={Target}
              actions={[
                { label: "Voir détails", icon: Eye, onClick: () => {} }
              ]}
            >
              <div className="space-y-2">
                <div className="text-2xl font-bold text-purple-600">
                  87%
                </div>
                <div className="flex items-center text-sm text-purple-600">
                  <Target className="h-4 w-4 mr-1" />
                  +2% vs mois dernier
                </div>
              </div>
            </DashboardWidget>

            <DashboardWidget
              title="Clients satisfaits"
              description="Évaluation"
              icon={Users}
              actions={[
                { label: "Voir détails", icon: Eye, onClick: () => {} }
              ]}
            >
              <div className="space-y-2">
                <div className="text-2xl font-bold text-indigo-600">
                  4.8/5
                </div>
                <div className="flex items-center text-sm text-indigo-600">
                  <Users className="h-4 w-4 mr-1" />
                  Basé sur 156 avis
                </div>
              </div>
            </DashboardWidget>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Subscriptions */}
            <DashboardWidget
              title="Souscriptions récentes"
              description="Dernières souscriptions"
              icon={FileText}
              actions={[
                { label: "Actualiser", icon: RefreshCw, onClick: handleRefresh },
                { label: "Voir tout", icon: Eye, onClick: () => {} }
              ]}
            >
              <div className="space-y-3">
                {recentActivity?.recentSouscriptions.slice(0, 5).map((souscription) => (
                  <div key={souscription.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {souscription.clients?.nom} {souscription.clients?.prenom}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {souscription.proprietes?.nom}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {souscription.statut}
                    </Badge>
                  </div>
                ))}
              </div>
            </DashboardWidget>

            {/* Recent Payments */}
            <DashboardWidget
              title="Paiements récents"
              description="Derniers paiements"
              icon={CreditCard}
              actions={[
                { label: "Actualiser", icon: RefreshCw, onClick: handleRefresh },
                { label: "Voir tout", icon: Eye, onClick: () => {} }
              ]}
            >
              <div className="space-y-3">
                {recentActivity?.recentPaiements.slice(0, 5).map((paiement) => (
                  <div key={paiement.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {formatCurrency(paiement.montant)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {paiement.locations?.clients?.nom}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Location
                    </Badge>
                  </div>
                ))}
              </div>
            </DashboardWidget>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Critical Alerts */}
            <DashboardWidget
              title="Alertes critiques"
              description="Action requise"
              icon={AlertCircle}
              actions={[
                { label: "Marquer comme lu", icon: CheckCircle, onClick: () => {} }
              ]}
            >
              <div className="space-y-3">
                {alerts?.facturesImpayees.slice(0, 3).map((facture) => (
                  <div key={facture.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-600">
                          Facture impayée
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(facture.solde)} - {facture.fournisseurs?.nom || 'Fournisseur inconnu'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      Urgent
                    </Badge>
                  </div>
                ))}
              </div>
            </DashboardWidget>

            {/* Warnings */}
            <DashboardWidget
              title="Avertissements"
              description="Surveillance"
              icon={Clock}
              actions={[
                { label: "Marquer comme lu", icon: CheckCircle, onClick: () => {} }
              ]}
            >
              <div className="space-y-3">
                {alerts?.locationsEndettees.slice(0, 3).map((location) => (
                  <div key={location.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-orange-600">
                          Location endettée
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(location.dette_totale)} - {location.clients?.prenom} {location.clients?.nom}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Attention
                    </Badge>
                  </div>
                ))}
              </div>
            </DashboardWidget>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Metrics */}
            <DashboardWidget
              title="Métriques de performance"
              description="Indicateurs clés"
              icon={BarChart3}
              actions={[
                { label: "Exporter", icon: Download, onClick: handleExport }
              ]}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Taux d'occupation</span>
                  <span className="text-sm font-semibold">87%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '87%' }}></div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm">Taux de recouvrement</span>
                  <span className="text-sm font-semibold">92%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: '92%' }}></div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm">Satisfaction client</span>
                  <span className="text-sm font-semibold">4.8/5</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: '96%' }}></div>
                </div>
              </div>
            </DashboardWidget>

            {/* Revenue Breakdown */}
            <DashboardWidget
              title="Répartition des revenus"
              description="Par type d'activité"
              icon={PieChart}
              actions={[
                { label: "Exporter", icon: Download, onClick: handleExport }
              ]}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm">Locations</span>
                  </div>
                  <span className="text-sm font-semibold">65%</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <span className="text-sm">Souscriptions</span>
                  </div>
                  <span className="text-sm font-semibold">25%</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm">Droit de terre</span>
                  </div>
                  <span className="text-sm font-semibold">10%</span>
                </div>
              </div>
            </DashboardWidget>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
