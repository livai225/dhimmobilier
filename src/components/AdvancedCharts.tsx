import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  LineChart,
  Line,
  RadialBarChart,
  RadialBar,
  ComposedChart,
  ScatterChart,
  Scatter
} from "recharts";
import { TrendingUp, BarChart3, PieChart, Activity, Target, Zap } from "lucide-react";

interface AdvancedChartsProps {
  monthlyRevenue: any[];
  revenueBreakdown: any[];
  weeklyData: any[];
  formatCurrency: (amount: number) => string;
}

const chartConfig = {
  locations: {
    label: "Locations",
    color: "hsl(217, 91%, 60%)",
  },
  souscriptions: {
    label: "Souscriptions", 
    color: "hsl(262, 83%, 58%)",
  },
  droitTerre: {
    label: "Droit de terre",
    color: "hsl(142, 76%, 36%)",
  },
  total: {
    label: "Total",
    color: "hsl(0, 0%, 9%)",
  },
  revenus: {
    label: "Revenus",
    color: "hsl(142, 76%, 36%)",
  },
  transactions: {
    label: "Transactions",
    color: "hsl(217, 91%, 60%)",
  }
};

export function AdvancedCharts({ monthlyRevenue, revenueBreakdown, weeklyData, formatCurrency }: AdvancedChartsProps) {
  return (
    <div className="space-y-6">
      {/* Enhanced Monthly Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Évolution des revenus - Analyse avancée
          </CardTitle>
          <CardDescription>
            Tendance des revenus avec projections et comparaisons
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <ChartContainer config={chartConfig} className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyRevenue} margin={{ top: 20, right: 20, left: 50, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="month" 
                  fontSize={12}
                  tickMargin={8}
                  height={40}
                />
                <YAxis 
                  tickFormatter={(value) => `${value / 1000}k`}
                  fontSize={12}
                  width={50}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => [formatCurrency(value), ""]}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  type="monotone"
                  dataKey="locations"
                  stackId="1"
                  stroke="hsl(217, 91%, 60%)"
                  fill="hsl(217, 91%, 60%)"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="souscriptions"
                  stackId="1"
                  stroke="hsl(262, 83%, 58%)"
                  fill="hsl(262, 83%, 58%)"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="droitTerre"
                  stackId="1"
                  stroke="hsl(142, 76%, 36%)"
                  fill="hsl(142, 76%, 36%)"
                  fillOpacity={0.6}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(0, 0%, 9%)"
                  strokeWidth={3}
                  dot={{ fill: "hsl(0, 0%, 9%)", strokeWidth: 2, r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Revenue Distribution with Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Répartition des revenus
            </CardTitle>
            <CardDescription>
              Distribution par type d'activité avec pourcentages
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pie-chart-container">
            <div className="w-full h-[200px] flex items-center justify-center">
              <ChartContainer config={chartConfig} className="h-[180px] w-[180px] max-w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                    <Pie
                      data={revenueBreakdown}
                      cx="50%"
                      cy="50%"
                      outerRadius={35}
                      innerRadius={15}
                      dataKey="value"
                      label={false}
                    >
                      {revenueBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => [formatCurrency(value), ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
            
            {/* Légende personnalisée */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {revenueBreakdown.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {entry.name} ({((entry.value / (revenueBreakdown.reduce((sum, item) => sum + item.value, 0) || 1)) * 100).toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Radial Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Indicateurs de performance
            </CardTitle>
            <CardDescription>
              Métriques clés de performance
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="80%" data={[
                  { name: 'Taux occupation', value: 85, fill: '#3b82f6' },
                  { name: 'Taux recouvrement', value: 92, fill: '#10b981' },
                  { name: 'Satisfaction client', value: 78, fill: '#8b5cf6' },
                  { name: 'Efficacité', value: 88, fill: '#f59e0b' }
                ]}>
                  <RadialBar dataKey="value" cornerRadius={4} fill="#8884d8" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </RadialBarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Performance Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Analyse de performance hebdomadaire
          </CardTitle>
          <CardDescription>
            Revenus et transactions des 7 derniers jours avec tendances
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis yAxisId="left" tickFormatter={(value) => `${value / 1000}k`} fontSize={12} />
                <YAxis yAxisId="right" orientation="right" fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} formatter={(value: number) => [formatCurrency(value), ""]} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar yAxisId="left" dataKey="revenus" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="transactions" stroke="hsl(217, 91%, 60%)" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Revenue Trend Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tendance des revenus totaux
          </CardTitle>
          <CardDescription>
            Évolution linéaire des revenus avec courbe de tendance
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyRevenue} margin={{ top: 20, right: 20, left: 50, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis tickFormatter={(value) => `${value / 1000}k`} fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} formatter={(value: number) => [formatCurrency(value), ""]} />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="hsl(217, 91%, 60%)" 
                  strokeWidth={3}
                  dot={{ fill: "hsl(217, 91%, 60%)", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: "hsl(217, 91%, 60%)", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
