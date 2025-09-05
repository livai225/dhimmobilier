import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Calculator } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function AccountingReports() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: accountingData } = useQuery({
    queryKey: ["accounting-data", selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      // Revenus
      const [locations, souscriptions, droitsTerre] = await Promise.all([
        supabase
          .from("paiements_locations")
          .select("montant, date_paiement")
          .gte("date_paiement", startDate)
          .lte("date_paiement", endDate),
        supabase
          .from("paiements_souscriptions")
          .select("montant, date_paiement")
          .gte("date_paiement", startDate)
          .lte("date_paiement", endDate),
        supabase
          .from("paiements_droit_terre")
          .select("montant, date_paiement")
          .gte("date_paiement", startDate)
          .lte("date_paiement", endDate)
      ]);

      // Dépenses
      const { data: expenses } = await supabase
        .from("paiements_factures")
        .select("montant, date_paiement")
        .gte("date_paiement", startDate)
        .lte("date_paiement", endDate);

      const totalLocationRevenues = locations.data?.reduce((sum, p) => sum + p.montant, 0) || 0;
      const totalSubscriptionRevenues = souscriptions.data?.reduce((sum, p) => sum + p.montant, 0) || 0;
      const totalLandRightRevenues = droitsTerre.data?.reduce((sum, p) => sum + p.montant, 0) || 0;
      const totalExpenses = expenses?.reduce((sum, p) => sum + p.montant, 0) || 0;

      const totalRevenues = totalLocationRevenues + totalSubscriptionRevenues + totalLandRightRevenues;
      const netResult = totalRevenues - totalExpenses;

      // Monthly breakdown
      const monthlyData = [];
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(selectedYear, month, 1);
        const monthEnd = new Date(selectedYear, month + 1, 0);
        const monthStartStr = monthStart.toISOString().split('T')[0];
        const monthEndStr = monthEnd.toISOString().split('T')[0];

        const monthLocations = locations.data?.filter(p => 
          p.date_paiement >= monthStartStr && p.date_paiement <= monthEndStr
        ).reduce((sum, p) => sum + p.montant, 0) || 0;

        const monthSouscriptions = souscriptions.data?.filter(p => 
          p.date_paiement >= monthStartStr && p.date_paiement <= monthEndStr
        ).reduce((sum, p) => sum + p.montant, 0) || 0;

        const monthDroitsTerre = droitsTerre.data?.filter(p => 
          p.date_paiement >= monthStartStr && p.date_paiement <= monthEndStr
        ).reduce((sum, p) => sum + p.montant, 0) || 0;

        const monthExpenses = expenses?.filter(p => 
          p.date_paiement >= monthStartStr && p.date_paiement <= monthEndStr
        ).reduce((sum, p) => sum + p.montant, 0) || 0;

        const monthRevenues = monthLocations + monthSouscriptions + monthDroitsTerre;

        monthlyData.push({
          month: monthStart.toLocaleDateString('fr-FR', { month: 'long' }),
          revenus: monthRevenues,
          depenses: monthExpenses,
          resultat: monthRevenues - monthExpenses
        });
      }

      return {
        year: selectedYear,
        summary: {
          revenus: {
            locations: totalLocationRevenues,
            souscriptions: totalSubscriptionRevenues,
            droitsTerre: totalLandRightRevenues,
            total: totalRevenues
          },
          depenses: totalExpenses,
          resultatNet: netResult
        },
        monthly: monthlyData
      };
    }
  });

  const generatePDF = () => {
    // Generate accounting report PDF
    console.log("Generating accounting PDF for year:", selectedYear);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Rapports Comptables</h3>
        <div className="flex gap-2">
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-md bg-background"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <option key={i} value={new Date().getFullYear() - i}>
                {new Date().getFullYear() - i}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={generatePDF}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {accountingData && (
        <>
          {/* Bilan simplifié */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Compte de Résultat {accountingData.year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 text-green-700">PRODUITS</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Revenus Locations</span>
                      <span className="font-medium">
                        {accountingData.summary.revenus.locations.toLocaleString()} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Revenus Souscriptions</span>
                      <span className="font-medium">
                        {accountingData.summary.revenus.souscriptions.toLocaleString()} FCFA
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Revenus Droits de Terre</span>
                      <span className="font-medium">
                        {accountingData.summary.revenus.droitsTerre.toLocaleString()} FCFA
                      </span>
                    </div>
                    <hr className="my-2" />
                    <div className="flex justify-between font-semibold text-green-700">
                      <span>TOTAL PRODUITS</span>
                      <span>{accountingData.summary.revenus.total.toLocaleString()} FCFA</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3 text-red-700">CHARGES</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Charges d'exploitation</span>
                      <span className="font-medium">
                        {accountingData.summary.depenses.toLocaleString()} FCFA
                      </span>
                    </div>
                    <hr className="my-2" />
                    <div className="flex justify-between font-semibold text-red-700">
                      <span>TOTAL CHARGES</span>
                      <span>{accountingData.summary.depenses.toLocaleString()} FCFA</span>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="my-6" />
              
              <div className="text-center">
                <div className={`text-2xl font-bold ${accountingData.summary.resultatNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  RÉSULTAT NET: {accountingData.summary.resultatNet.toLocaleString()} FCFA
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {accountingData.summary.resultatNet >= 0 ? 'Bénéfice' : 'Perte'} pour l'exercice {accountingData.year}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Détail mensuel */}
          <Card>
            <CardHeader>
              <CardTitle>Évolution mensuelle {accountingData.year}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Mois</th>
                      <th className="text-right p-2">Revenus</th>
                      <th className="text-right p-2">Dépenses</th>
                      <th className="text-right p-2">Résultat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountingData.monthly.map((month, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium capitalize">{month.month}</td>
                        <td className="p-2 text-right text-green-600">
                          {month.revenus.toLocaleString()} FCFA
                        </td>
                        <td className="p-2 text-right text-red-600">
                          {month.depenses.toLocaleString()} FCFA
                        </td>
                        <td className={`p-2 text-right font-medium ${month.resultat >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {month.resultat.toLocaleString()} FCFA
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold">
                      <td className="p-2">TOTAL</td>
                      <td className="p-2 text-right text-green-600">
                        {accountingData.summary.revenus.total.toLocaleString()} FCFA
                      </td>
                      <td className="p-2 text-right text-red-600">
                        {accountingData.summary.depenses.toLocaleString()} FCFA
                      </td>
                      <td className={`p-2 text-right ${accountingData.summary.resultatNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {accountingData.summary.resultatNet.toLocaleString()} FCFA
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}