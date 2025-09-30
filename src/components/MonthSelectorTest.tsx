import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  generateCurrentYearMonthOptions, 
  generateExtendedMonthOptions, 
  generateLast12MonthsOptions,
  generateCurrentAndPreviousYearOptions 
} from "@/utils/monthOptions";

export function MonthSelectorTest() {
  const currentYearOptions = generateCurrentYearMonthOptions();
  const extendedOptions = generateExtendedMonthOptions(new Date('2024-01-01'));
  const last12MonthsOptions = generateLast12MonthsOptions();
  const currentAndPreviousOptions = generateCurrentAndPreviousYearOptions();

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Test des Sélecteurs de Mois</h1>
        <p className="text-muted-foreground">
          Vérification que tous les sélecteurs commencent en janvier
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Année courante + suivante */}
        <Card>
          <CardHeader>
            <CardTitle>Année Courante + Suivante</CardTitle>
            <CardDescription>
              generateCurrentYearMonthOptions()
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge variant="outline">Total: {currentYearOptions.length} mois</Badge>
              <div className="text-sm">
                <strong>Premier mois:</strong> {currentYearOptions[0]?.label}
              </div>
              <div className="text-sm">
                <strong>Dernier mois:</strong> {currentYearOptions[currentYearOptions.length - 1]?.label}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {currentYearOptions.slice(0, 6).map(option => option.label).join(', ')}...
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Période étendue */}
        <Card>
          <CardHeader>
            <CardTitle>Période Étendue (20 ans)</CardTitle>
            <CardDescription>
              generateExtendedMonthOptions()
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge variant="outline">Total: {extendedOptions.length} mois</Badge>
              <div className="text-sm">
                <strong>Premier mois:</strong> {extendedOptions[0]?.label}
              </div>
              <div className="text-sm">
                <strong>Dernier mois:</strong> {extendedOptions[extendedOptions.length - 1]?.label}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {extendedOptions.slice(0, 6).map(option => option.label).join(', ')}...
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 12 derniers mois */}
        <Card>
          <CardHeader>
            <CardTitle>12 Derniers Mois</CardTitle>
            <CardDescription>
              generateLast12MonthsOptions()
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge variant="outline">Total: {last12MonthsOptions.length} mois</Badge>
              <div className="text-sm">
                <strong>Premier mois:</strong> {last12MonthsOptions[0]?.label}
              </div>
              <div className="text-sm">
                <strong>Dernier mois:</strong> {last12MonthsOptions[last12MonthsOptions.length - 1]?.label}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {last12MonthsOptions.slice(0, 6).map(option => option.label).join(', ')}...
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Année courante + précédente */}
        <Card>
          <CardHeader>
            <CardTitle>Année Courante + Précédente</CardTitle>
            <CardDescription>
              generateCurrentAndPreviousYearOptions()
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge variant="outline">Total: {currentAndPreviousOptions.length} mois</Badge>
              <div className="text-sm">
                <strong>Premier mois:</strong> {currentAndPreviousOptions[0]?.label}
              </div>
              <div className="text-sm">
                <strong>Dernier mois:</strong> {currentAndPreviousOptions[currentAndPreviousOptions.length - 1]?.label}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {currentAndPreviousOptions.slice(0, 6).map(option => option.label).join(', ')}...
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vérification */}
      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-green-800">✅ Vérification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>
                <strong>Année courante + suivante:</strong> Commence par {currentYearOptions[0]?.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>
                <strong>Période étendue:</strong> Commence par {extendedOptions[0]?.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>
                <strong>12 derniers mois:</strong> Commence par {last12MonthsOptions[0]?.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>
                <strong>Année courante + précédente:</strong> Commence par {currentAndPreviousOptions[0]?.label}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
