import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Palette,
  CheckCircle
} from "lucide-react";

export function RecouvrementColorsDemo() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Palette className="h-8 w-8 text-purple-600" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Couleurs Appliquées à la Page de Recouvrement
          </h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Démonstration des couleurs vives et des styles appliqués
        </p>
      </div>

      {/* Cartes de Résumé */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Agents Actifs</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">12</div>
            <p className="text-xs text-blue-600">
              45 propriétés confiées
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Total Dû</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              2,500,000 FCFA
            </div>
            <p className="text-xs text-orange-600">
              Montant à collecter ce mois
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Total Versé</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              1,800,000 FCFA
            </div>
            <p className="text-xs text-green-600">
              Montant versé en caisse
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg transition-all duration-300 hover:scale-105">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Écart Global</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              -700,000 FCFA
            </div>
            <p className="text-xs text-red-600">
              Retard
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tableau de Démonstration */}
      <Card className="bg-gradient-to-br from-white to-gray-50 border-gray-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <DollarSign className="h-5 w-5 text-purple-600" />
            Exemple de Tableau avec Couleurs
          </CardTitle>
          <CardDescription className="text-gray-600">
            Montants colorés selon leur type
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Ligne d'exemple */}
            <div className="grid grid-cols-8 gap-4 items-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
              <div className="font-medium text-gray-800">Jean DUPONT</div>
              <div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">AG001</Badge>
              </div>
              <div className="text-sm text-gray-600">5 propriétés</div>
              <div className="text-right">
                <div className="text-orange-600 font-semibold bg-orange-50 px-2 py-1 rounded-md">
                  150,000 FCFA
                </div>
              </div>
              <div className="text-right">
                <div className="text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded-md">
                  80,000 FCFA
                </div>
              </div>
              <div className="text-right">
                <div className="text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded-md">
                  230,000 FCFA
                </div>
              </div>
              <div className="text-right">
                <div className="text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded-md">
                  200,000 FCFA
                </div>
              </div>
              <div className="text-right">
                <div className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded-md">
                  -30,000 FCFA
                </div>
              </div>
            </div>

            {/* Légende des couleurs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-orange-100 mx-auto flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                </div>
                <h4 className="font-semibold text-orange-700">Dû Loyers</h4>
                <p className="text-xs text-muted-foreground">Orange</p>
              </div>

              <div className="text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 mx-auto flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-amber-500"></div>
                </div>
                <h4 className="font-semibold text-amber-700">Dû Droits</h4>
                <p className="text-xs text-muted-foreground">Ambre</p>
              </div>

              <div className="text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 mx-auto flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                </div>
                <h4 className="font-semibold text-purple-700">Total Dû</h4>
                <p className="text-xs text-muted-foreground">Violet</p>
              </div>

              <div className="text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 mx-auto flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                </div>
                <h4 className="font-semibold text-blue-700">Versé</h4>
                <p className="text-xs text-muted-foreground">Bleu</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statuts */}
      <Card className="bg-gradient-to-r from-gray-50 to-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-800">Statuts avec Couleurs</CardTitle>
          <CardDescription>Badges colorés selon le statut de l'agent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Badge className="bg-red-100 text-red-700 border-red-200 font-medium">
              En retard
            </Badge>
            <Badge className="bg-green-100 text-green-700 border-green-200 font-medium">
              En avance
            </Badge>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-medium">
              À jour
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Résumé des Améliorations */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="text-center py-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <h3 className="text-2xl font-bold text-green-800">Couleurs Appliquées avec Succès !</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-orange-100 mx-auto flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-orange-600" />
              </div>
              <h4 className="font-semibold">Montants Colorés</h4>
              <p className="text-sm text-muted-foreground">
                Chaque type de montant a sa couleur distinctive
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-blue-100 mx-auto flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="font-semibold">Cartes Colorées</h4>
              <p className="text-sm text-muted-foreground">
                Cartes de résumé avec gradients et couleurs vives
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-purple-100 mx-auto flex items-center justify-center">
                <Palette className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="font-semibold">Design Moderne</h4>
              <p className="text-sm text-muted-foreground">
                Interface moderne avec animations et transitions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
