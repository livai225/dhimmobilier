import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  CreditCard,
  FileText,
  Home,
  Users,
  Zap
} from "lucide-react";
import { 
  generateCurrentYearMonthOptions, 
  generateExtendedMonthOptions, 
  generateLast12MonthsOptions,
  generateCurrentAndPreviousYearOptions 
} from "@/utils/monthOptions";

export function MonthSelectorShowcase() {
  const currentYearOptions = generateCurrentYearMonthOptions();
  const extendedOptions = generateExtendedMonthOptions(new Date('2024-01-01'));
  const last12MonthsOptions = generateLast12MonthsOptions();
  const currentAndPreviousOptions = generateCurrentAndPreviousYearOptions();

  const features = [
    {
      title: "Sélecteurs de Mois Améliorés",
      description: "Tous les mois de l'année disponibles dans les composants de paiement",
      icon: Calendar,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Fonctions Utilitaires",
      description: "Génération cohérente des options de mois dans toute l'application",
      icon: Zap,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Flexibilité",
      description: "Différentes périodes selon le contexte (année courante, étendue, etc.)",
      icon: Clock,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Cohérence",
      description: "Même format et style dans tous les composants de paiement",
      icon: CheckCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    }
  ];

  return (
    <div className="container mx-auto p-4 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Calendar className="h-8 w-8 text-blue-600" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Sélecteurs de Mois Améliorés
          </h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Tous les mois de l'année sont maintenant disponibles dans les composants de paiement 
          pour les locations et souscriptions
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="hover:shadow-lg transition-all duration-300">
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

      {/* Examples */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Paiement Souscriptions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Paiement Souscriptions
            </CardTitle>
            <CardDescription>
              Sélecteur avec tous les mois de l'année courante et suivante
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Mois disponibles :</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {currentYearOptions.slice(0, 8).map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span>{option.label}</span>
                    </div>
                  ))}
                  <div className="col-span-2 text-xs text-blue-600 mt-2">
                    ... et {currentYearOptions.length - 8} autres mois
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Total: {currentYearOptions.length} mois</Badge>
                <Badge variant="outline">Années: 2024-2025</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paiement Locations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Paiement Locations
            </CardTitle>
            <CardDescription>
              Sélecteur avec période étendue (20 ans) à partir de la date de début
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Mois disponibles :</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {extendedOptions.slice(0, 8).map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span>{option.label}</span>
                    </div>
                  ))}
                  <div className="col-span-2 text-xs text-green-600 mt-2">
                    ... et {extendedOptions.length - 8} autres mois
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Total: {extendedOptions.length} mois</Badge>
                <Badge variant="outline">Période: 20 ans</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Functions Available */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Fonctions Utilitaires Disponibles
          </CardTitle>
          <CardDescription>
            Différentes fonctions pour générer les options de mois selon le contexte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-semibold text-purple-800 mb-2">generateCurrentYearMonthOptions()</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Génère les mois de l'année courante et suivante
                </p>
                <Badge variant="outline">{currentYearOptions.length} mois</Badge>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg">
                <h4 className="font-semibold text-orange-800 mb-2">generateExtendedMonthOptions()</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Génère une période étendue (20 ans) à partir d'une date
                </p>
                <Badge variant="outline">{extendedOptions.length} mois</Badge>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-cyan-50 rounded-lg">
                <h4 className="font-semibold text-cyan-800 mb-2">generateLast12MonthsOptions()</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Génère les 12 derniers mois
                </p>
                <Badge variant="outline">{last12MonthsOptions.length} mois</Badge>
              </div>

              <div className="p-4 bg-pink-50 rounded-lg">
                <h4 className="font-semibold text-pink-800 mb-2">generateCurrentAndPreviousYearOptions()</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Génère les mois de l'année courante et précédente
                </p>
                <Badge variant="outline">{currentAndPreviousOptions.length} mois</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="text-center py-8">
          <h3 className="text-2xl font-bold mb-4">Avantages des Améliorations</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Users className="h-8 w-8 text-blue-600 mx-auto" />
              <h4 className="font-semibold">Meilleure UX</h4>
              <p className="text-sm text-muted-foreground">
                Plus de flexibilité pour les utilisateurs lors des paiements
              </p>
            </div>
            <div className="space-y-2">
              <CreditCard className="h-8 w-8 text-purple-600 mx-auto" />
              <h4 className="font-semibold">Cohérence</h4>
              <p className="text-sm text-muted-foreground">
                Même comportement dans tous les composants de paiement
              </p>
            </div>
            <div className="space-y-2">
              <Zap className="h-8 w-8 text-green-600 mx-auto" />
              <h4 className="font-semibold">Maintenabilité</h4>
              <p className="text-sm text-muted-foreground">
                Code centralisé et réutilisable pour la génération des mois
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
