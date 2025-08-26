import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { DollarSign, TrendingUp, AlertTriangle, Calendar, Search, CreditCard, FileText, Users } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ExportToExcelButton } from "@/components/ExportToExcelButton";

export default function Loyers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("last_6_months");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["rent_payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_locations")
        .select(`
          *,
          locations!inner(
            statut,
            loyer_mensuel,
            clients(nom, prenom, telephone_principal),
            proprietes(nom, adresse)
          )
        `)
        .order("date_paiement", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations_rent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select(`
          *,
          clients(nom, prenom),
          proprietes(nom, loyer_mensuel)
        `);
      if (error) throw error;
      return data || [];
    },
  });

  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      const matchesSearch = 
        payment.locations?.clients?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.locations?.clients?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.locations?.proprietes?.nom?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || payment.locations?.statut === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [payments, searchTerm, statusFilter]);

  const dashboardStats = useMemo(() => {
    const totalPayments = filteredPayments.reduce((sum, p) => sum + Number(p.montant), 0);
    const monthlyPayments = filteredPayments.filter(p => {
      const paymentDate = new Date(p.date_paiement);
      const thisMonth = startOfMonth(new Date());
      return paymentDate >= thisMonth;
    });
    const thisMonthTotal = monthlyPayments.reduce((sum, p) => sum + Number(p.montant), 0);
    
    const totalDebt = locations.reduce((sum, l) => sum + Number(l.dette_totale || 0), 0);
    const expectedMonthlyRevenue = locations
      .filter(l => l.statut === 'active')
      .reduce((sum, l) => sum + Number(l.loyer_mensuel || 0), 0);

    const collectionRate = expectedMonthlyRevenue > 0 ? (thisMonthTotal / expectedMonthlyRevenue) * 100 : 0;

    return {
      totalPayments,
      thisMonthTotal,
      totalDebt,
      expectedMonthlyRevenue,
      collectionRate,
      paymentCount: filteredPayments.length,
      monthlyPaymentCount: monthlyPayments.length
    };
  }, [filteredPayments, locations]);

  const monthlyData = useMemo(() => {
    const monthlyStats: { [key: string]: { revenue: number, count: number } } = {};
    
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), i);
      return format(date, 'yyyy-MM');
    }).reverse();

    last6Months.forEach(month => {
      monthlyStats[month] = { revenue: 0, count: 0 };
    });

    payments.forEach(payment => {
      const month = format(new Date(payment.date_paiement), 'yyyy-MM');
      if (monthlyStats[month]) {
        monthlyStats[month].revenue += Number(payment.montant);
        monthlyStats[month].count += 1;
      }
    });

    return Object.entries(monthlyStats).map(([month, data]) => ({
      month: format(new Date(month + '-01'), 'MMM yyyy'),
      revenue: data.revenue,
      count: data.count
    }));
  }, [payments]);

  const paymentsByProperty = useMemo(() => {
    const propertyStats: { [key: string]: number } = {};
    
    payments.forEach(payment => {
      const propertyName = payment.locations?.proprietes?.nom || 'Propriété inconnue';
      propertyStats[propertyName] = (propertyStats[propertyName] || 0) + Number(payment.montant);
    });

    return Object.entries(propertyStats)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [payments]);

  const statusData = useMemo(() => {
    const statusStats = locations.reduce((acc, location) => {
      acc[location.statut] = (acc[location.statut] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return [
      { name: "Actives", value: statusStats.active || 0, color: "#10b981" },
      { name: "Suspendues", value: statusStats.suspendu || 0, color: "#ef4444" },
      { name: "Terminées", value: statusStats.termine || 0, color: "#6b7280" }
    ];
  }, [locations]);

  return (
    <div className="container mx-auto p-4 lg:p-6">
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Suivi des Loyers</h1>
          <p className="text-muted-foreground">
            Dashboard complet des encaissements et impayés
          </p>
        </div>
        <ExportToExcelButton
          filename={`loyers_${new Date().toISOString().slice(0,10)}`}
          rows={filteredPayments}
          columns={[
            { header: "Date", accessor: (r:any) => new Date(r.date_paiement).toLocaleDateString('fr-FR') },
            { header: "Propriété", accessor: (r:any) => r.locations?.proprietes?.nom || "" },
            { header: "Client", accessor: (r:any) => `${r.locations?.clients?.prenom || ''} ${r.locations?.clients?.nom || ''}`.trim() },
            { header: "Montant", accessor: (r:any) => r.montant },
            { header: "Mode", accessor: (r:any) => r.mode_paiement || "" },
          ]}
        />
      </div>

      {/* KPIs Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total encaissé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">
              {dashboardStats.totalPayments.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">FCFA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Ce mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-600">
              {dashboardStats.thisMonthTotal.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">FCFA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Impayés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600">
              {dashboardStats.totalDebt.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">FCFA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Taux collecte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-purple-600">
              {dashboardStats.collectionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">ce mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Paiements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {dashboardStats.paymentCount}
            </div>
            <p className="text-xs text-muted-foreground">total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Attendu/mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-gray-600">
              {dashboardStats.expectedMonthlyRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">FCFA</p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Évolution mensuelle */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Évolution des encaissements (6 derniers mois)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `${(value/1000000).toFixed(1)}M`} />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'revenue' ? `${Number(value).toLocaleString()} FCFA` : value,
                      name === 'revenue' ? 'Montant' : 'Nombre'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: "#3b82f6", strokeWidth: 2, r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Répartition par statut */}
        <Card>
          <CardHeader>
            <CardTitle>État des locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 mt-4">
              {statusData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top propriétés */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Top 10 - Revenus par propriété</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentsByProperty}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis tickFormatter={(value) => `${(value/1000000).toFixed(1)}M`} />
                <Tooltip 
                  formatter={(value) => [`${Number(value).toLocaleString()} FCFA`, "Total encaissé"]}
                />
                <Bar dataKey="total" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Filtres */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtres et recherche</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par client ou propriété..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Combobox
              options={[
                { value: "all", label: "Tous les statuts" },
                { value: "active", label: "Actives" },
                { value: "suspendu", label: "Suspendues" },
                { value: "termine", label: "Terminées" }
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Filtrer par statut"
              buttonClassName="w-48"
            />
          </div>
        </CardContent>
      </Card>

      {/* Historique des paiements */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des paiements ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Propriété</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Statut location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6">Chargement...</TableCell>
                  </TableRow>
                ) : filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      Aucun paiement trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {format(new Date(payment.date_paiement), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {payment.locations?.proprietes?.nom}
                      </TableCell>
                      <TableCell>
                        {payment.locations?.clients?.prenom} {payment.locations?.clients?.nom}
                      </TableCell>
                      <TableCell className="font-medium text-green-600">
                        {Number(payment.montant).toLocaleString()} FCFA
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {payment.mode_paiement || 'Non spécifié'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {payment.reference || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          payment.locations?.statut === 'active' ? 'default' : 
                          payment.locations?.statut === 'suspendu' ? 'destructive' : 'secondary'
                        }>
                          {payment.locations?.statut}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}