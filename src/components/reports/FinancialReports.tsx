import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToPDF } from "@/utils/pdfExporter";

export function FinancialReports() {
  const [selectedPeriod, setSelectedPeriod] = useState("current-month");

  const { data: financialData, isLoading } = useQuery({
    queryKey: ["financial-summary", selectedPeriod],
    queryFn: async () => {
      const currentDate = new Date();
      let startDate: Date;
      let endDate = new Date();

      switch (selectedPeriod) {
        case "current-month":
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          break;
        case "last-month":
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
          endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
          break;
        case "current-year":
          startDate = new Date(currentDate.getFullYear(), 0, 1);
          break;
        case "last-year":
          startDate = new Date(currentDate.getFullYear() - 1, 0, 1);
          endDate = new Date(currentDate.getFullYear() - 1, 11, 31);
          break;
        default:
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      }

      // Revenus locations
      const { data: locationRevenues } = await supabase
        .from("paiements_locations")
        .select("montant")
        .gte("date_paiement", startDate.toISOString().split('T')[0])
        .lte("date_paiement", endDate.toISOString().split('T')[0]);

      // Revenus souscriptions
      const { data: subscriptionRevenues } = await supabase
        .from("paiements_souscriptions")
        .select("montant")
        .gte("date_paiement", startDate.toISOString().split('T')[0])
        .lte("date_paiement", endDate.toISOString().split('T')[0]);

      // Revenus droits de terre
      const { data: landRightRevenues } = await supabase
        .from("paiements_droit_terre")
        .select("montant")
        .gte("date_paiement", startDate.toISOString().split('T')[0])
        .lte("date_paiement", endDate.toISOString().split('T')[0]);

      // Dépenses (factures payées)
      const { data: expenses } = await supabase
        .from("paiements_factures")
        .select("montant")
        .gte("date_paiement", startDate.toISOString().split('T')[0])
        .lte("date_paiement", endDate.toISOString().split('T')[0]);

      const totalLocationRevenues = locationRevenues?.reduce((sum, p) => sum + p.montant, 0) || 0;
      const totalSubscriptionRevenues = subscriptionRevenues?.reduce((sum, p) => sum + p.montant, 0) || 0;
      const totalLandRightRevenues = landRightRevenues?.reduce((sum, p) => sum + p.montant, 0) || 0;
      const totalExpenses = expenses?.reduce((sum, p) => sum + p.montant, 0) || 0;

      const totalRevenues = totalLocationRevenues + totalSubscriptionRevenues + totalLandRightRevenues;
      const netResult = totalRevenues - totalExpenses;

      return {
        period: selectedPeriod,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        revenues: {
          locations: totalLocationRevenues,
          souscriptions: totalSubscriptionRevenues,
          droitsTerre: totalLandRightRevenues,
          total: totalRevenues
        },
        expenses: totalExpenses,
        netResult,
        profitMargin: totalRevenues > 0 ? ((netResult / totalRevenues) * 100) : 0
      };
    }
  });

  const handleExportPDF = () => {
    if (!financialData) return;
    
    const reportData = {
      title: "Rapport Financier",
      period: `Du ${financialData.startDate} au ${financialData.endDate}`,
      data: financialData
    };
    
    exportToPDF(reportData, `rapport-financier-${financialData.period}.pdf`);
  };

  if (isLoading) {
    return <div className="animate-pulse">Chargement des données financières...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-semibold">Rapports Financiers</h3>
        <div className="flex gap-2">
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="current-month">Mois en cours</option>
            <option value="last-month">Mois précédent</option>
            <option value="current-year">Année en cours</option>
            <option value="last-year">Année précédente</option>
          </select>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {financialData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Revenus Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {financialData.revenues.locations.toLocaleString()} FCFA
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Revenus Souscriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {financialData.revenues.souscriptions.toLocaleString()} FCFA
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Dépenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {financialData.expenses.toLocaleString()} FCFA
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Résultat Net
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${financialData.netResult >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {financialData.netResult.toLocaleString()} FCFA
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Marge: {financialData.profitMargin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Détails des revenus
          </CardTitle>
        </CardHeader>
        <CardContent>
          {financialData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Locations</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {financialData.revenues.locations.toLocaleString()} FCFA
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {((financialData.revenues.locations / financialData.revenues.total) * 100).toFixed(1)}% du total
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Souscriptions</h4>
                  <p className="text-2xl font-bold text-green-600">
                    {financialData.revenues.souscriptions.toLocaleString()} FCFA
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {((financialData.revenues.souscriptions / financialData.revenues.total) * 100).toFixed(1)}% du total
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Droits de terre</h4>
                  <p className="text-2xl font-bold text-orange-600">
                    {financialData.revenues.droitsTerre.toLocaleString()} FCFA
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {((financialData.revenues.droitsTerre / financialData.revenues.total) * 100).toFixed(1)}% du total
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}