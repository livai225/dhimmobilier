import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sparkles, 
  BarChart3, 
  PieChart, 
  Activity, 
  Target,
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
  Zap,
  DollarSign,
  Home,
  MapPin,
  Receipt,
  Code,
  Settings
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import ModernDashboard from "./ModernDashboard";
import AdvancedCharts from "./AdvancedCharts";
import AdvancedMetrics from "./AdvancedMetrics";
import InteractiveDashboard from "./InteractiveDashboard";

export function DashboardShowcase() {
  const navigate = useNavigate();

  const features = [
    {
      title: "Design Responsive Moderne",
      description: "Interface adaptative avec grilles flexibles et animations fluides",
      icon: Sparkles,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Graphiques Avancés",
      description: "Graphiques interactifs avec Recharts et animations personnalisées",
      icon: BarChart3,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Métriques en Temps Réel",
      description: "Indicateurs de performance avec tendances et alertes",
      icon: Activity,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Vue Mobile Optimisée",
      description: "Cartes adaptatives et navigation tactile pour mobile",
      icon: Target,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    }
  ];

  const improvements = [
    "🎨 Design moderne avec gradients et animations",
    "📱 Interface 100% responsive pour tous les écrans",
    "📊 Graphiques interactifs avec Recharts",
    "⚡ Animations fluides et transitions",
    "🎯 Métriques de performance avancées",
    "🔔 Système d'alertes intelligent",
    "📈 Analyses de tendances détaillées",
    "🎪 Widgets interactifs et personnalisables",
    "🌙 Support du mode sombre",
    "♿ Accessibilité améliorée"
  ];

  return (
    <div className="container mx-auto p-4 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-8 w-8 text-purple-600" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Dashboard Moderne
          </h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Une expérience utilisateur révolutionnaire avec des graphiques modernes, 
          un design responsive et des fonctionnalités avancées
        </p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => navigate('/dashboard')} className="btn-gradient">
            <Eye className="h-4 w-4 mr-2" />
            Voir le Dashboard
          </Button>
          <Button variant="outline" onClick={() => navigate('/')}>
            <Home className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="dashboard-card hover:shadow-lg transition-all duration-300">
            <CardHeader className="text-center">
              <div className={`w-12 h-12 rounded-full ${feature.bgColor} flex items-center justify-center mx-auto mb-4`}>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <CardTitle className="text-lg">{feature.title}</CardTitle>
              <CardDescription className="text-sm">
                {feature.description}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Improvements List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Améliorations Apportées
          </CardTitle>
          <CardDescription>
            Liste complète des fonctionnalités et améliorations du nouveau dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {improvements.map((improvement, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <span className="text-lg">{improvement.split(' ')[0]}</span>
                <span className="text-sm">{improvement.substring(2)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Demo Tabs */}
      <Tabs defaultValue="modern" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="modern">Dashboard Moderne</TabsTrigger>
          <TabsTrigger value="charts">Graphiques Avancés</TabsTrigger>
          <TabsTrigger value="metrics">Métriques</TabsTrigger>
          <TabsTrigger value="interactive">Interactif</TabsTrigger>
        </TabsList>

        <TabsContent value="modern" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Dashboard Principal Moderne
              </CardTitle>
              <CardDescription>
                Interface principale avec design responsive et graphiques modernes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <ModernDashboard />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Graphiques Avancés
              </CardTitle>
              <CardDescription>
                Collection de graphiques modernes avec animations et interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <AdvancedCharts 
                  monthlyRevenue={[]}
                  revenueBreakdown={[]}
                  weeklyData={[]}
                  formatCurrency={(amount: number) => new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'XOF',
                    minimumFractionDigits: 0,
                  }).format(amount)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Métriques Avancées
              </CardTitle>
              <CardDescription>
                Indicateurs de performance avec tendances et progressions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <AdvancedMetrics 
                  stats={{
                    soldeCaisse: 2500000,
                    totalDepenses: 1200000,
                    creancesImpayees: 450000,
                    contratsActifs: 45,
                    tauxOccupation: 87,
                    tauxRecouvrement: 92,
                    revenusRecurrents: 1800000,
                    totalClients: 156,
                    facturesImpayeesCount: 3,
                    echeancesEnRetardCount: 2
                  }}
                  formatCurrency={(amount: number) => new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'XOF',
                    minimumFractionDigits: 0,
                  }).format(amount)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interactive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Dashboard Interactif
              </CardTitle>
              <CardDescription>
                Interface avec widgets interactifs et fonctionnalités avancées
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <InteractiveDashboard />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Détails Techniques
          </CardTitle>
          <CardDescription>
            Technologies et bibliothèques utilisées pour créer cette expérience moderne
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">Frontend</h4>
              <div className="space-y-2">
                <Badge variant="secondary">React 18</Badge>
                <Badge variant="secondary">TypeScript</Badge>
                <Badge variant="secondary">Tailwind CSS</Badge>
                <Badge variant="secondary">Vite</Badge>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">Graphiques</h4>
              <div className="space-y-2">
                <Badge variant="secondary">Recharts</Badge>
                <Badge variant="secondary">D3.js</Badge>
                <Badge variant="secondary">Responsive Design</Badge>
                <Badge variant="secondary">Animations CSS</Badge>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">UI/UX</h4>
              <div className="space-y-2">
                <Badge variant="secondary">Shadcn/ui</Badge>
                <Badge variant="secondary">Radix UI</Badge>
                <Badge variant="secondary">Lucide Icons</Badge>
                <Badge variant="secondary">CSS Grid</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="text-center py-8">
          <h3 className="text-2xl font-bold mb-4">Prêt à découvrir le nouveau dashboard ?</h3>
          <p className="text-muted-foreground mb-6">
            Explorez toutes les fonctionnalités modernes et l'expérience utilisateur améliorée
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate('/dashboard')} size="lg" className="btn-gradient">
              <Eye className="h-5 w-5 mr-2" />
              Accéder au Dashboard
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/settings')}>
              <Settings className="h-5 w-5 mr-2" />
              Configurer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
