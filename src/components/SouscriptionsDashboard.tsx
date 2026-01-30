import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  PieChart, 
  AlertTriangle,
  Calendar,
  Building2,
  Target,
  AlertCircle
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, Pie } from "recharts";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PHASE_COLORS = {
  souscription: "hsl(var(--primary))",
  finition: "hsl(var(--secondary))",
  droit_terre: "hsl(var(--accent))",
  termine: "hsl(var(--muted))"
};

export function SouscriptionsDashboard() {
  const { canAccessDashboard } = useUserPermissions();

  // Always call hooks in the same order - move useQuery before conditional return
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["souscriptions-dashboard"],
    queryFn: async () => {
      // Get all subscriptions with related data
      const souscriptions = await apiClient.select<any[]>({
        table: "souscriptions"
      });

      if (!souscriptions) throw new Error("Failed to fetch souscriptions");

      // Calculate statistics
      const totalSouscriptions = souscriptions.length;
      const totalSouscris = souscriptions.reduce((sum, s) => sum + (s.prix_total || 0), 0);
      const totalApports = souscriptions.reduce((sum, s) => sum + (s.apport_initial || 0), 0);
      const soldeRestant = souscriptions.reduce((sum, s) => sum + (s.solde_restant || 0), 0);

      // Group by phase
      const byPhase = souscriptions.reduce((acc, s) => {
        acc[s.phase_actuelle] = (acc[s.phase_actuelle] || 0) + 1;
        return acc;
      }, {});

      // Get payment trends (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const recentPayments = await apiClient.select<any[]>({
        table: "paiements_droit_terre",
        filters: [{ op: "gte", column: "date_paiement", value: sixMonthsAgo.toISOString().split('T')[0] }]
      });

      // Group payments by month
      const paymentsByMonth = (recentPayments || []).reduce((acc, payment) => {
        const month = new Date(payment.date_paiement).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
        acc[month] = (acc[month] || 0) + payment.montant;
        return acc;
      }, {});

      // Top properties
      const propertyStats = souscriptions.reduce((acc, s) => {
        const propName = s.proprietes?.nom || 'Sans nom';
        if (!acc[propName]) {
          acc[propName] = { count: 0, total: 0 };
        }
        acc[propName].count += 1;
        acc[propName].total += s.prix_total || 0;
        return acc;
      }, {});

      const topProperties = Object.entries(propertyStats)
        .map(([name, stats]: [string, any]) => ({
          name,
          count: stats.count,
          total: stats.total
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Alerts
      const alerts = [];
      
      // Subscriptions with high remaining balance
      const highBalances = souscriptions.filter(s => s.solde_restant > s.prix_total * 0.8);
      if (highBalances.length > 0) {
        alerts.push({
          type: "warning",
          message: `${highBalances.length} souscription(s) avec solde élevé (>80%)`
        });
      }

      // Finishing periods ending soon
      const finishingSoon = souscriptions.filter(s => {
        if (s.date_fin_finition) {
          const endDate = new Date(s.date_fin_finition);
          const today = new Date();
          const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays <= 30 && diffDays > 0;
        }
        return false;
      });

      if (finishingSoon.length > 0) {
        alerts.push({
          type: "info",
          message: `${finishingSoon.length} finition(s) se termine(nt) dans 30 jours`
        });
      }

      return {
        totalSouscriptions,
        totalSouscris,
        totalApports,
        soldeRestant,
        byPhase,
        paymentsByMonth,
        topProperties,
        alerts
      };
    },
    enabled: canAccessDashboard, // Only run query if user has permission
  });

  // Now check permissions after hooks are called
  if (!canAccessDashboard) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Accès refusé</h3>
              <p className="text-muted-foreground">
                Vous n'avez pas les permissions nécessaires pour accéder au tableau de bord des souscriptions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded animate-pulse mb-2" />
              <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const phaseData = Object.entries(dashboardData?.byPhase || {}).map(([phase, count]) => ({
    name: phase === 'souscription' ? 'Souscription' : 
          phase === 'finition' ? 'Finition' : 
          phase === 'droit_terre' ? 'Droit de terre' : 'Terminé',
    value: count,
    color: PHASE_COLORS[phase as keyof typeof PHASE_COLORS]
  }));

  const monthlyData = Object.entries(dashboardData?.paymentsByMonth || {}).map(([month, amount]) => ({
    month,
    amount
  }));

  return (
    <div className="space-y-6 mb-8">
      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Souscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData?.totalSouscriptions || 0}</div>
            <p className="text-xs text-muted-foreground">Toutes phases confondues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Montant Total Souscris</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dashboardData?.totalSouscris || 0).toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">Volume total des souscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Apports Reçus</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dashboardData?.totalApports || 0).toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboardData?.totalSouscris > 0 
                ? `${Math.round((dashboardData.totalApports / dashboardData.totalSouscris) * 100)}% du total`
                : "0% du total"
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde Restant</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dashboardData?.soldeRestant || 0).toLocaleString()} FCFA
            </div>
            <p className="text-xs text-muted-foreground">À percevoir</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Additional Info */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Phase Distribution */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Répartition par Phase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <RechartsPieChart>
                <Pie
                  data={phaseData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                >
                  {phaseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {phaseData.map((phase, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: phase.color }}
                    />
                    <span>{phase.name}</span>
                  </div>
                  <span className="font-medium">{String(phase.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Payments */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-4 w-4" />
              Paiements Mensuels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => [`${value.toLocaleString()} FCFA`, 'Montant']}
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Properties & Alerts */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Top Propriétés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData?.topProperties?.slice(0, 3).map((prop, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{prop.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {prop.total.toLocaleString()} FCFA
                    </p>
                  </div>
                  <Badge variant="secondary">{prop.count}</Badge>
                </div>
              ))}
            </div>

            {dashboardData?.alerts && dashboardData.alerts.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <h4 className="flex items-center gap-2 text-sm font-medium mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  Alertes
                </h4>
                <div className="space-y-2">
                  {dashboardData.alerts.map((alert, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${
                        alert.type === 'warning' ? 'bg-destructive' : 'bg-primary'
                      }`} />
                      <p className="text-xs text-muted-foreground">{alert.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}