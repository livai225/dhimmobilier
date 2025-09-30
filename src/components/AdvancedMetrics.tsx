import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
  Target,
  Zap,
  Users,
  Building,
  DollarSign,
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  BarChart3
} from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  progress?: number;
  status?: 'success' | 'warning' | 'error' | 'info';
}

function MetricCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  color, 
  bgColor, 
  trend, 
  progress,
  status = 'info'
}: MetricCardProps) {
  const statusColors = {
    success: 'border-green-200 bg-green-50',
    warning: 'border-yellow-200 bg-yellow-50',
    error: 'border-red-200 bg-red-50',
    info: 'border-blue-200 bg-blue-50'
  };

  return (
    <Card className={`relative overflow-hidden hover:shadow-lg transition-all duration-300 ${statusColors[status]}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>
          {value}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
          {trend && (
            <div className={`flex items-center text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? (
                <ArrowUpRight className="h-3 w-3 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 mr-1" />
              )}
              {trend.value}
            </div>
          )}
        </div>
        {progress !== undefined && (
          <div className="mt-3">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {progress}% de l'objectif
            </p>
          </div>
        )}
      </CardContent>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
    </Card>
  );
}

interface AdvancedMetricsProps {
  stats: {
    soldeCaisse: number;
    totalDepenses: number;
    creancesImpayees: number;
    contratsActifs: number;
    tauxOccupation: number;
    tauxRecouvrement: number;
    revenusRecurrents: number;
    totalClients: number;
    facturesImpayeesCount: number;
    echeancesEnRetardCount: number;
  };
  formatCurrency: (amount: number) => string;
}

export function AdvancedMetrics({ stats, formatCurrency }: AdvancedMetricsProps) {
  const metrics = [
    {
      title: "Solde de caisse",
      value: formatCurrency(stats.soldeCaisse),
      description: "Revenus - dépenses",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
      trend: { value: "+12%", isPositive: true },
      progress: Math.min((stats.soldeCaisse / 10000000) * 100, 100),
      status: 'success' as const
    },
    {
      title: "Dépenses totales",
      value: formatCurrency(stats.totalDepenses),
      description: "Factures payées",
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      trend: { value: "+5%", isPositive: false },
      status: 'warning' as const
    },
    {
      title: "Créances impayées",
      value: formatCurrency(stats.creancesImpayees),
      description: "À recouvrer",
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      trend: { value: "-3%", isPositive: true },
      status: 'error' as const
    },
    {
      title: "Contrats actifs",
      value: stats.contratsActifs,
      description: "Total en cours",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      trend: { value: "+15%", isPositive: true },
      progress: Math.min((stats.contratsActifs / 100) * 100, 100),
      status: 'success' as const
    },
    {
      title: "Taux d'occupation",
      value: `${stats.tauxOccupation}%`,
      description: "Propriétés occupées",
      icon: Building,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      trend: { value: "+2%", isPositive: true },
      progress: stats.tauxOccupation,
      status: 'info' as const
    },
    {
      title: "Taux de recouvrement",
      value: `${stats.tauxRecouvrement}%`,
      description: "Efficacité de recouvrement",
      icon: Zap,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      trend: { value: "+8%", isPositive: true },
      progress: stats.tauxRecouvrement,
      status: 'success' as const
    },
    {
      title: "Revenus récurrents",
      value: formatCurrency(stats.revenusRecurrents),
      description: "Par mois",
      icon: DollarSign,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      trend: { value: "+10%", isPositive: true },
      status: 'success' as const
    },
    {
      title: "Total Clients",
      value: stats.totalClients,
      description: "Clients enregistrés",
      icon: Users,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
      trend: { value: "+20%", isPositive: true },
      progress: Math.min((stats.totalClients / 500) * 100, 100),
      status: 'info' as const
    }
  ];

  return (
    <div className="space-y-6">
      {/* Main KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.slice(0, 4).map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.slice(4).map((metric, index) => (
          <MetricCard key={index + 4} {...metric} />
        ))}
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Résumé de performance
          </CardTitle>
          <CardDescription>
            Vue d'ensemble des indicateurs clés de performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Financial Health */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">Santé financière</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Solde positif</span>
                  <Badge variant={stats.soldeCaisse > 0 ? "default" : "destructive"}>
                    {stats.soldeCaisse > 0 ? "Bon" : "Attention"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Créances</span>
                  <Badge variant={stats.creancesImpayees < 1000000 ? "default" : "destructive"}>
                    {stats.creancesImpayees < 1000000 ? "Contrôlées" : "Élevées"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Operational Efficiency */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">Efficacité opérationnelle</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Occupation</span>
                  <Badge variant={stats.tauxOccupation > 80 ? "default" : "secondary"}>
                    {stats.tauxOccupation}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Recouvrement</span>
                  <Badge variant={stats.tauxRecouvrement > 90 ? "default" : "secondary"}>
                    {stats.tauxRecouvrement}%
                  </Badge>
                </div>
              </div>
            </div>

            {/* Growth Indicators */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">Indicateurs de croissance</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Contrats actifs</span>
                  <Badge variant="default">{stats.contratsActifs}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Nouveaux clients</span>
                  <Badge variant="default">{stats.totalClients}</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
