import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Home, TrendingUp, AlertTriangle, DollarSign, Users, Calendar, AlertCircle } from "lucide-react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LocationsDashboard() {
  const { canAccessDashboard } = useUserPermissions();

  // Always call hooks in the same order - move useQuery before conditional return
  const { data: locations = [] } = useQuery({
    queryKey: ["locations_dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select(`
          *,
          clients(nom, prenom),
          proprietes(nom, loyer_mensuel)
        `);
      if (error) throw error;
      return data || [];
    },
    enabled: canAccessDashboard, // Only run query if user has permission
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["location_payments_dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_locations")
        .select(`
          *,
          locations!inner(
            proprietes(nom)
          )
        `)
        .order("date_paiement", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: canAccessDashboard, // Only run query if user has permission
  });

  // Calculate stats with useMemo - always called
  const stats = useMemo(() => {
    if (!canAccessDashboard) return {
      total: 0, active: 0, suspended: 0, terminated: 0,
      totalRevenue: 0, totalDebt: 0, totalCaution: 0, occupancyRate: 0
    };

    const total = locations.length;
    const active = locations.filter(l => l.statut === 'active').length;
    const suspended = locations.filter(l => l.statut === 'suspendu').length;
    const terminated = locations.filter(l => l.statut === 'termine').length;
    
    const totalRevenue = locations.reduce((sum, l) => sum + Number(l.loyer_mensuel || 0), 0);
    const totalDebt = locations.reduce((sum, l) => sum + Number(l.dette_totale || 0), 0);
    const totalCaution = locations.reduce((sum, l) => sum + Number(l.caution_totale || 0), 0);
    
    const occupancyRate = total > 0 ? (active / total) * 100 : 0;

    return {
      total, active, suspended, terminated,
      totalRevenue, totalDebt, totalCaution, occupancyRate
    };
  }, [locations, canAccessDashboard]);

  const monthlyPayments = useMemo(() => {
    if (!canAccessDashboard) return [];
    
    const monthlyData: { [key: string]: number } = {};
    
    payments.forEach(payment => {
      const month = new Date(payment.date_paiement).toLocaleDateString('fr-FR', { 
        year: 'numeric', 
        month: 'short' 
      });
      monthlyData[month] = (monthlyData[month] || 0) + Number(payment.montant);
    });

    return Object.entries(monthlyData)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .slice(-6); // Derniers 6 mois
  }, [payments, canAccessDashboard]);

  const revenueByProperty = useMemo(() => {
    if (!canAccessDashboard) return [];
    
    const propertyRevenue: { [key: string]: number } = {};
    
    locations.forEach(location => {
      if (location.proprietes?.nom) {
        propertyRevenue[location.proprietes.nom] = Number(location.loyer_mensuel || 0);
      }
    });

    return Object.entries(propertyRevenue)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10
  }, [locations, canAccessDashboard]);

  // Now check permissions after all hooks are called
  if (!canAccessDashboard) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Accès refusé</h3>
              <p className="text-muted-foreground">
                Vous n'avez pas les permissions nécessaires pour accéder au tableau de bord des locations.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusData = [
    { name: "Actives", value: stats.active, color: "#10b981" },
    { name: "Suspendues", value: stats.suspended, color: "#ef4444" },
    { name: "Terminées", value: stats.terminated, color: "#6b7280" }
  ];

  return (
    <div className="space-y-6">
      {/* KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Home className="w-4 h-4" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">locations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Taux occupation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.occupancyRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">actives/total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Revenus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-600">
              {stats.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">FCFA/mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Impayés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600">
              {stats.totalDebt.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">FCFA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Cautions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-purple-600">
              {stats.totalCaution.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">FCFA totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">en cours</p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Répartition par statut */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition par statut</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} locations`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4">
              {statusData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Évolution des encaissements */}
        <Card>
          <CardHeader>
            <CardTitle>Encaissements mensuels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyPayments}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `${(value/1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value) => [`${Number(value).toLocaleString()} FCFA`, "Montant"]}
                    labelFormatter={(label) => `Mois: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: "#3b82f6", strokeWidth: 2, r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top propriétés par revenus */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 - Revenus par propriété</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByProperty} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(value) => `${(value/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={150} />
                <Tooltip 
                  formatter={(value) => [`${Number(value).toLocaleString()} FCFA`, "Loyer mensuel"]}
                />
                <Bar dataKey="revenue" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Alertes et notifications */}
      <Card className="border-orange-200 bg-orange-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="w-5 h-5" />
            Alertes importantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.suspended > 0 && (
              <div className="flex items-center gap-2 p-3 bg-red-100 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-800">
                  {stats.suspended} location(s) suspendue(s) nécessitent une attention
                </span>
              </div>
            )}
            {stats.totalDebt > 0 && (
              <div className="flex items-center gap-2 p-3 bg-yellow-100 rounded-lg">
                <DollarSign className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  {stats.totalDebt.toLocaleString()} FCFA d'impayés à recouvrer
                </span>
              </div>
            )}
            {stats.occupancyRate < 80 && (
              <div className="flex items-center gap-2 p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-800">
                  Taux d'occupation à {stats.occupancyRate.toFixed(1)}% - Opportunité d'amélioration
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}