import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, TrendingUp, MapPin, DollarSign, BarChart3, PieChart as PieChartIcon, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Alert, AlertDescription } from "@/components/ui/alert";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

interface DashboardStats {
  totalProperties: number;
  occupationRate: number;
  currentRevenue: number;
  potentialRevenue: number;
  statusDistribution: Array<{ name: string; value: number; color: string }>;
  typePerformance: Array<{ type: string; count: number; avgRent: number; potential: number }>;
  zonePerformance: Array<{ zone: string; count: number; occupation: number; revenue: number }>;
}

export function PropertiesDashboard() {
  const { canAccessDashboard } = useUserPermissions();

  const { data: dashboardStats, isLoading } = useQuery({
    queryKey: ['properties-dashboard'],
    queryFn: async (): Promise<DashboardStats> => {
      if (!canAccessDashboard) {
        throw new Error('Accès non autorisé au tableau de bord');
      }
      
      // Fetch properties with related data
      const { data: properties, error: propError } = await supabase
        .from('proprietes')
        .select(`
          *,
          types_proprietes(nom)
        `);

      if (propError) throw propError;

      // Fetch active locations
      const { data: activeLocations, error: locError } = await supabase
        .from('locations')
        .select('propriete_id, loyer_mensuel')
        .eq('statut', 'active');

      if (locError) throw locError;

      // Fetch active subscriptions with land rights
      const { data: activeSubscriptions, error: subError } = await supabase
        .from('souscriptions')
        .select('propriete_id, montant_droit_terre_mensuel')
        .eq('statut', 'active')
        .eq('phase_actuelle', 'droit_terre');

      if (subError) throw subError;

      // Calculate metrics
      const totalProperties = properties?.length || 0;
      
      // Create sets of occupied properties
      const occupiedByLocation = new Set(activeLocations?.map(l => l.propriete_id) || []);
      const occupiedBySubscription = new Set(activeSubscriptions?.map(s => s.propriete_id) || []);
      const allOccupied = new Set([...occupiedByLocation, ...occupiedBySubscription]);
      
      const occupationRate = totalProperties > 0 ? (allOccupied.size / totalProperties) * 100 : 0;

      // Calculate current revenue
      const locationRevenue = activeLocations?.reduce((sum, loc) => sum + (loc.loyer_mensuel || 0), 0) || 0;
      const landRightsRevenue = activeSubscriptions?.reduce((sum, sub) => sum + (sub.montant_droit_terre_mensuel || 0), 0) || 0;
      const currentRevenue = locationRevenue + landRightsRevenue;

      // Calculate potential revenue
      const potentialLocationRevenue = properties?.reduce((sum, prop) => {
        return sum + (prop.usage === 'Location' ? (prop.loyer_mensuel || 0) : 0);
      }, 0) || 0;
      
      const potentialLandRightsRevenue = properties?.reduce((sum, prop) => {
        return sum + (prop.usage === 'Bail' ? (prop.droit_terre || 0) : 0);
      }, 0) || 0;
      
      const potentialRevenue = potentialLocationRevenue + potentialLandRightsRevenue;

      // Status distribution
      const statusCounts = properties?.reduce((acc, prop) => {
        const isOccupied = allOccupied.has(prop.id);
        const status = isOccupied ? 'Occupé' : (prop.statut || 'Libre');
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const statusDistribution = Object.entries(statusCounts).map(([name, value], index) => ({
        name,
        value,
        color: COLORS[index % COLORS.length]
      }));

      // Type performance
      const typeGroups = properties?.reduce((acc, prop) => {
        const typeName = prop.types_proprietes?.nom || 'Non défini';
        if (!acc[typeName]) {
          acc[typeName] = {
            properties: [],
            totalRevenue: 0,
            potentialRevenue: 0
          };
        }
        acc[typeName].properties.push(prop);
        
        // Add potential revenue
        if (prop.usage === 'Location') {
          acc[typeName].potentialRevenue += prop.loyer_mensuel || 0;
        } else if (prop.usage === 'Bail') {
          acc[typeName].potentialRevenue += prop.droit_terre || 0;
        }
        
        return acc;
      }, {} as Record<string, any>) || {};

      const typePerformance = Object.entries(typeGroups).map(([type, data]) => ({
        type,
        count: data.properties.length,
        avgRent: data.properties.length > 0 ? data.potentialRevenue / data.properties.length : 0,
        potential: data.potentialRevenue
      }));

      // Zone performance
      const zoneGroups = properties?.reduce((acc, prop) => {
        const zone = prop.zone || 'Non défini';
        if (!acc[zone]) {
          acc[zone] = {
            total: 0,
            occupied: 0,
            revenue: 0
          };
        }
        acc[zone].total += 1;
        if (allOccupied.has(prop.id)) {
          acc[zone].occupied += 1;
        }
        
        // Add current revenue for this property
        const locationRev = activeLocations?.find(l => l.propriete_id === prop.id)?.loyer_mensuel || 0;
        const landRev = activeSubscriptions?.find(s => s.propriete_id === prop.id)?.montant_droit_terre_mensuel || 0;
        acc[zone].revenue += locationRev + landRev;
        
        return acc;
      }, {} as Record<string, any>) || {};

      const zonePerformance = Object.entries(zoneGroups).map(([zone, data]) => ({
        zone,
        count: data.total,
        occupation: data.total > 0 ? (data.occupied / data.total) * 100 : 0,
        revenue: data.revenue
      }));

      return {
        totalProperties,
        occupationRate,
        currentRevenue,
        potentialRevenue,
        statusDistribution,
        typePerformance,
        zonePerformance
      };
    },
    enabled: canAccessDashboard
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount).replace('XOF', 'FCFA');
  };

  if (!canAccessDashboard) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Accès refusé</h3>
              <p className="text-muted-foreground">
                Vous n'avez pas les permissions nécessaires pour accéder au tableau de bord financier.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6">Chargement du tableau de bord...</div>;
  }

  if (!dashboardStats) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Impossible de charger les données du tableau de bord.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const stats = dashboardStats;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Total</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProperties}</div>
            <p className="text-xs text-muted-foreground">
              propriétés enregistrées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux d'occupation</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.occupationRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              propriétés occupées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus Actuels</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.currentRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              /mois (loyers + droits terre)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus Potentiels</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.potentialRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              /mois si 100% occupé
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="charts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="charts">Graphiques</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Répartition par Statut
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.statusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {stats.statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Type Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance par Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.typePerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => {
                      if (name === 'potential') return [formatCurrency(Number(value)), 'Revenus Potentiels'];
                      return [value, name === 'count' ? 'Nombre' : 'Loyer Moyen'];
                    }} />
                    <Legend />
                    <Bar dataKey="count" fill="hsl(var(--primary))" name="Nombre" />
                    <Bar dataKey="potential" fill="hsl(var(--secondary))" name="Revenus Potentiels" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Zone Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Performance par Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.zonePerformance} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="zone" type="category" width={100} />
                  <Tooltip formatter={(value, name) => {
                    if (name === 'revenue') return [formatCurrency(Number(value)), 'Revenus Actuels'];
                    if (name === 'occupation') return [`${Number(value).toFixed(1)}%`, 'Taux d\'occupation'];
                    return [value, 'Nombre'];
                  }} />
                  <Legend />
                  <Bar dataKey="count" fill="hsl(var(--primary))" name="Nombre" />
                  <Bar dataKey="revenue" fill="hsl(var(--accent))" name="Revenus Actuels" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Performance by Type Table */}
            <Card>
              <CardHeader>
                <CardTitle>Performance par Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.typePerformance.map((type, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{type.type}</div>
                        <div className="text-sm text-muted-foreground">{type.count} propriétés</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(type.potential)}</div>
                        <div className="text-sm text-muted-foreground">potentiel/mois</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance by Zone Table */}
            <Card>
              <CardHeader>
                <CardTitle>Performance par Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.zonePerformance.map((zone, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <div className="font-medium">{zone.zone}</div>
                        <div className="text-sm text-muted-foreground">{zone.count} propriétés</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{zone.occupation.toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">{formatCurrency(zone.revenue)}/mois</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}