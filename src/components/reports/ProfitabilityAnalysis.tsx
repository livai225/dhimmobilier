import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ProfitabilityAnalysis() {
  const { data: profitabilityData } = useQuery({
    queryKey: ["profitability-analysis"],
    queryFn: async () => {
      // Get all properties with their revenues and costs
      const { data: properties } = await supabase
        .from("proprietes")
        .select(`
          id,
          nom,
          loyer_mensuel,
          prix_achat,
          locations(
            id,
            paiements_locations(montant, date_paiement)
          ),
          souscriptions(
            id,
            paiements_souscriptions(montant, date_paiement),
            paiements_droit_terre(montant, date_paiement)
          ),
          factures_fournisseurs(
            montant_paye
          )
        `);

      if (!properties) return [];

      return properties.map(property => {
        // Calculate total revenues
        const locationRevenues = property.locations?.reduce((sum, location) => {
          return sum + (location.paiements_locations?.reduce((pSum, p) => pSum + p.montant, 0) || 0);
        }, 0) || 0;

        const subscriptionRevenues = (property.souscriptions as any)?.reduce((sum: number, sub: any) => {
          const subPayments = sub.paiements_souscriptions?.reduce((pSum: number, p: any) => pSum + p.montant, 0) || 0;
          const landPayments = sub.paiements_droit_terre?.reduce((pSum: number, p: any) => pSum + p.montant, 0) || 0;
          return sum + subPayments + landPayments;
        }, 0) || 0;

        const totalRevenues = locationRevenues + subscriptionRevenues;

        // Calculate costs
        const maintenanceCosts = property.factures_fournisseurs?.reduce((sum, facture) => {
          return sum + facture.montant_paye;
        }, 0) || 0;

        // Calculate profitability metrics
        const netProfit = totalRevenues - maintenanceCosts;
        const profitMargin = totalRevenues > 0 ? (netProfit / totalRevenues) * 100 : 0;
        const roi = property.prix_achat > 0 ? (netProfit / property.prix_achat) * 100 : 0;

        return {
          id: property.id,
          nom: property.nom,
          totalRevenues,
          maintenanceCosts,
          netProfit,
          profitMargin,
          roi,
          monthlyRent: property.loyer_mensuel || 0,
          purchasePrice: property.prix_achat || 0
        };
      }).sort((a, b) => b.netProfit - a.netProfit);
    }
  });

  const topProperties = profitabilityData?.slice(0, 10) || [];
  const totalRevenues = profitabilityData?.reduce((sum, p) => sum + p.totalRevenues, 0) || 0;
  const totalCosts = profitabilityData?.reduce((sum, p) => sum + p.maintenanceCosts, 0) || 0;
  const overallProfit = totalRevenues - totalCosts;
  const overallMargin = totalRevenues > 0 ? (overallProfit / totalRevenues) * 100 : 0;

  const pieData = topProperties.slice(0, 5).map((property, index) => ({
    name: property.nom,
    value: property.totalRevenues,
    fill: `hsl(${(index * 72) % 360}, 70%, 50%)`
  }));

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Analyse de Rentabilité par Propriété</h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenus Totaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalRevenues.toLocaleString()} FCFA
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coûts Totaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalCosts.toLocaleString()} FCFA
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Profit Net
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overallProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {overallProfit.toLocaleString()} FCFA
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Marge Globale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overallMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {overallMargin.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 - Rentabilité par propriété</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProperties} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="nom" type="category" width={80} />
                <Tooltip 
                  formatter={(value) => [`${value?.toLocaleString()} FCFA`, "Profit net"]}
                />
                <Bar dataKey="netProfit" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition des revenus (Top 5)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value?.toLocaleString()} FCFA`, "Revenus"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Détail de la rentabilité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Propriété</th>
                  <th className="text-right p-2">Revenus</th>
                  <th className="text-right p-2">Coûts</th>
                  <th className="text-right p-2">Profit Net</th>
                  <th className="text-right p-2">Marge</th>
                  <th className="text-right p-2">ROI</th>
                </tr>
              </thead>
              <tbody>
                {profitabilityData?.map((property) => (
                  <tr key={property.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{property.nom}</td>
                    <td className="p-2 text-right">{property.totalRevenues.toLocaleString()}</td>
                    <td className="p-2 text-right text-red-600">{property.maintenanceCosts.toLocaleString()}</td>
                    <td className={`p-2 text-right font-medium ${property.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {property.netProfit.toLocaleString()}
                    </td>
                    <td className={`p-2 text-right ${property.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {property.profitMargin.toFixed(1)}%
                    </td>
                    <td className={`p-2 text-right ${property.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {property.roi.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}