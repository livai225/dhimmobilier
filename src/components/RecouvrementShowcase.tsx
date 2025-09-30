import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Eye,
  Palette,
  Sparkles,
  BarChart3
} from "lucide-react";

export function RecouvrementShowcase() {
  const mockData = {
    agents: 12,
    totalDue: 2500000,
    totalPaid: 1800000,
    balance: -700000,
    properties: 45
  };

  return (
    <div className="container mx-auto p-4 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Palette className="h-8 w-8 text-purple-600" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Page de Recouvrement Restylée
          </h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Amélioration de l'interface avec des couleurs douces et une meilleure mise en évidence des montants
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-4">
              <Palette className="h-6 w-6 text-purple-600" />
            </div>
            <CardTitle className="text-lg">Couleurs Douces</CardTitle>
            <CardDescription className="text-sm">
              Palette de couleurs harmonieuse et apaisante
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-lg">Montants Colorés</CardTitle>
            <CardDescription className="text-sm">
              Différenciation visuelle des types de montants
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-lg">Animations</CardTitle>
            <CardDescription className="text-sm">
              Transitions fluides et effets visuels
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="h-6 w-6 text-orange-600" />
            </div>
            <CardTitle className="text-lg">Lisibilité</CardTitle>
            <CardDescription className="text-sm">
              Meilleure hiérarchie visuelle des informations
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Before/After Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Avant */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Avant
            </CardTitle>
            <CardDescription className="text-red-600">
              Interface monochrome sans différenciation visuelle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-white rounded-lg border border-red-200">
              <h4 className="font-semibold text-gray-800 mb-2">Cartes de Résumé</h4>
              <div className="space-y-2 text-sm">
                <div className="text-gray-600">Agents Actifs: 12</div>
                <div className="text-gray-600">Total Dû: 2,500,000 FCFA</div>
                <div className="text-gray-600">Total Versé: 1,800,000 FCFA</div>
                <div className="text-gray-600">Écart: -700,000 FCFA</div>
              </div>
            </div>
            <div className="p-4 bg-white rounded-lg border border-red-200">
              <h4 className="font-semibold text-gray-800 mb-2">Tableau</h4>
              <div className="space-y-1 text-sm">
                <div className="text-gray-600">Dû Loyers: 1,200,000 FCFA</div>
                <div className="text-gray-600">Dû Droits: 800,000 FCFA</div>
                <div className="text-gray-600">Total Dû: 2,000,000 FCFA</div>
                <div className="text-gray-600">Versé: 1,500,000 FCFA</div>
                <div className="text-gray-600">Écart: -500,000 FCFA</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Après */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Après
            </CardTitle>
            <CardDescription className="text-green-600">
              Interface colorée avec différenciation visuelle claire
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-white rounded-lg border border-green-200">
              <h4 className="font-semibold text-gray-800 mb-2">Cartes de Résumé</h4>
              <div className="space-y-2 text-sm">
                <div className="text-blue-600 font-semibold">Agents Actifs: 12</div>
                <div className="text-orange-600 font-semibold">Total Dû: 2,500,000 FCFA</div>
                <div className="text-blue-600 font-semibold">Total Versé: 1,800,000 FCFA</div>
                <div className="text-red-600 font-semibold">Écart: -700,000 FCFA</div>
              </div>
            </div>
            <div className="p-4 bg-white rounded-lg border border-green-200">
              <h4 className="font-semibold text-gray-800 mb-2">Tableau</h4>
              <div className="space-y-1 text-sm">
                <div className="text-orange-600 font-medium bg-orange-50 p-1 rounded">Dû Loyers: 1,200,000 FCFA</div>
                <div className="text-amber-600 font-medium bg-amber-50 p-1 rounded">Dû Droits: 800,000 FCFA</div>
                <div className="text-purple-600 font-bold bg-purple-50 p-1 rounded">Total Dû: 2,000,000 FCFA</div>
                <div className="text-blue-600 font-medium bg-blue-50 p-1 rounded">Versé: 1,500,000 FCFA</div>
                <div className="text-red-600 font-bold bg-red-50 p-1 rounded">Écart: -500,000 FCFA</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Color Legend */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-center text-blue-800">Légende des Couleurs</CardTitle>
          <CardDescription className="text-center">
            Signification des couleurs utilisées pour les montants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-orange-100 mx-auto flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-orange-500"></div>
              </div>
              <h4 className="font-semibold text-orange-700">Dû Loyers</h4>
              <p className="text-xs text-muted-foreground">Montants dus pour les loyers</p>
            </div>

            <div className="text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 mx-auto flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-amber-500"></div>
              </div>
              <h4 className="font-semibold text-amber-700">Dû Droits</h4>
              <p className="text-xs text-muted-foreground">Montants dus pour les droits de terre</p>
            </div>

            <div className="text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 mx-auto flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-purple-500"></div>
              </div>
              <h4 className="font-semibold text-purple-700">Total Dû</h4>
              <p className="text-xs text-muted-foreground">Montant total à collecter</p>
            </div>

            <div className="text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 mx-auto flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              </div>
              <h4 className="font-semibold text-blue-700">Versé</h4>
              <p className="text-xs text-muted-foreground">Montants déjà versés</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-green-100 mx-auto flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
              </div>
              <h4 className="font-semibold text-green-700">Écart Positif</h4>
              <p className="text-xs text-muted-foreground">En avance</p>
            </div>

            <div className="text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-red-100 mx-auto flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
              </div>
              <h4 className="font-semibold text-red-700">Écart Négatif</h4>
              <p className="text-xs text-muted-foreground">En retard</p>
            </div>

            <div className="text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 mx-auto flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-gray-500"></div>
              </div>
              <h4 className="font-semibold text-gray-700">Écart Neutre</h4>
              <p className="text-xs text-muted-foreground">À jour</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="text-center py-8">
          <h3 className="text-2xl font-bold mb-4">Avantages des Améliorations</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Eye className="h-8 w-8 text-blue-600 mx-auto" />
              <h4 className="font-semibold">Lisibilité Améliorée</h4>
              <p className="text-sm text-muted-foreground">
                Différenciation visuelle claire des types de montants
              </p>
            </div>
            <div className="space-y-2">
              <Palette className="h-8 w-8 text-purple-600 mx-auto" />
              <h4 className="font-semibold">Interface Moderne</h4>
              <p className="text-sm text-muted-foreground">
                Design harmonieux avec des couleurs douces
              </p>
            </div>
            <div className="space-y-2">
              <Sparkles className="h-8 w-8 text-green-600 mx-auto" />
              <h4 className="font-semibold">Expérience Utilisateur</h4>
              <p className="text-sm text-muted-foreground">
                Navigation plus intuitive et agréable
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
