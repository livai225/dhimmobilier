import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ComparativeReports() {
  const [period, setPeriod] = useState("monthly");

  const { data: comparativeData } = useQuery({
    queryKey: ["comparative-data", period],
    queryFn: async () => {
      const currentDate = new Date();
      const data = [];

      // Generate data for the last 12 months or 12 weeks
      for (let i = 11; i >= 0; i--) {
        let startDate: Date, endDate: Date, label: string;

        if (period === "monthly") {
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
          endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);
          label = startDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short' });
        } else {
          startDate = new Date(currentDate.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
          endDate = new Date(startDate.getTime() + (6 * 24 * 60 * 60 * 1000));
          label = `S${52 - i}`;
        }

        // Fetch revenues for this period
        const [locations, souscriptions, droitsTerre] = await Promise.all([
          supabase
            .from("paiements_locations")
            .select("montant")
            .gte("date_paiement", startDate.toISOString().split('T')[0])
            .lte("date_paiement", endDate.toISOString().split('T')[0]),
          supabase
            .from("paiements_souscriptions")
            .select("montant")
            .gte("date_paiement", startDate.toISOString().split('T')[0])
            .lte("date_paiement", endDate.toISOString().split('T')[0]),
          supabase
            .from("paiements_droit_terre")
            .select("montant")
            .gte("date_paiement", startDate.toISOString().split('T')[0])
            .lte("date_paiement", endDate.toISOString().split('T')[0])
        ]);

        const locationRevenue = locations.data?.reduce((sum, p) => sum + p.montant, 0) || 0;
        const souscriptionRevenue = souscriptions.data?.reduce((sum, p) => sum + p.montant, 0) || 0;
        const droitsTerreRevenue = droitsTerre.data?.reduce((sum, p) => sum + p.montant, 0) || 0;

        data.push({
          period: label,
          locations: locationRevenue,
          souscriptions: souscriptionRevenue,
          droitsTerre: droitsTerreRevenue,
          total: locationRevenue + souscriptionRevenue + droitsTerreRevenue
        });
      }

      return data;
    }
  });

  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const currentPeriod = comparativeData?.[comparativeData.length - 1];
  const previousPeriod = comparativeData?.[comparativeData.length - 2];
  
  const totalGrowth = currentPeriod && previousPeriod 
    ? calculateGrowth(currentPeriod.total, previousPeriod.total)
    : 0;

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (growth < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Analyses Comparatives</h3>
        <select 
          value={period} 
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="monthly">Mensuel</option>
          <option value="weekly">Hebdomadaire</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenus Totaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentPeriod?.total.toLocaleString() || 0} FCFA
            </div>
            <div className="flex items-center gap-1 mt-1">
              {getGrowthIcon(totalGrowth)}
              <span className={`text-sm ${totalGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalGrowth.toFixed(1)}%
              </span>
              <span className="text-sm text-muted-foreground">vs période précédente</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Moyenne Mobile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {comparativeData 
                ? (comparativeData.slice(-3).reduce((sum, d) => sum + d.total, 0) / 3).toLocaleString()
                : 0
              } FCFA
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Moyenne sur 3 {period === 'monthly' ? 'mois' : 'semaines'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pic Maximum
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {comparativeData 
                ? Math.max(...comparativeData.map(d => d.total)).toLocaleString()
                : 0
              } FCFA
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Record de la période
            </p>
          </CardContent>
        </Card>
      </div>

      {comparativeData && (
        <Card>
          <CardHeader>
            <CardTitle>Évolution des revenus</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={comparativeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value?.toLocaleString()} FCFA`, ""]} />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="locations" stroke="hsl(var(--chart-1))" strokeWidth={1} />
                <Line type="monotone" dataKey="souscriptions" stroke="hsl(var(--chart-2))" strokeWidth={1} />
                <Line type="monotone" dataKey="droitsTerre" stroke="hsl(var(--chart-3))" strokeWidth={1} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {comparativeData && (
        <Card>
          <CardHeader>
            <CardTitle>Répartition par source de revenus</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparativeData.slice(-6)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value?.toLocaleString()} FCFA`, ""]} />
                <Bar dataKey="locations" stackId="a" fill="hsl(var(--chart-1))" />
                <Bar dataKey="souscriptions" stackId="a" fill="hsl(var(--chart-2))" />
                <Bar dataKey="droitsTerre" stackId="a" fill="hsl(var(--chart-3))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}