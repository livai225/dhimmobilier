import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, TrendingUp, Users, Clock, DollarSign, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

export function SouscriptionsDashboard() {
  const { data: souscriptions = [], isLoading } = useQuery({
    queryKey: ["souscriptions_dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("souscriptions")
        .select(`
          *,
          clients(nom, prenom),
          proprietes(nom, adresse, zone),
          paiements_souscriptions(montant, date_paiement)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: paiements = [], isLoading: isLoadingPaiements } = useQuery({
    queryKey: ["paiements_souscriptions_monthly"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_souscriptions")
        .select("montant, date_paiement")
        .gte("date_paiement", new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
        .order("date_paiement");

      if (error) throw error;
      return data;
    },
  });

  // Calculs des statistiques
  const stats = {
    total: souscriptions.length,
    active: souscriptions.filter(s => s.statut === 'active').length,
    termine: souscriptions.filter(s => s.statut === 'termine').length,
    totalRevenu: souscriptions.reduce((sum, s) => sum + (s.prix_total || 0), 0),
    soldeRestant: souscriptions.reduce((sum, s) => sum + (s.solde_restant || 0), 0),
    totalPaye: souscriptions.reduce((sum, s) => sum + ((s.prix_total || 0) - (s.solde_restant || 0)), 0)
  };

  // Données par phase
  const phaseData = [
    { phase: "Souscription", count: souscriptions.filter(s => s.phase_actuelle === 'souscription').length, color: "#3b82f6" },
    { phase: "Finition", count: souscriptions.filter(s => s.phase_actuelle === 'finition').length, color: "#f97316" },
    { phase: "Droit de terre", count: souscriptions.filter(s => s.phase_actuelle === 'droit_terre').length, color: "#22c55e" },
    { phase: "Terminé", count: souscriptions.filter(s => s.phase_actuelle === 'termine').length, color: "#6b7280" }
  ];

  // Données par type
  const typeData = [
    { type: "Classique", count: souscriptions.filter(s => s.type_souscription === 'classique').length, color: "#8b5cf6" },
    { type: "Mise en garde", count: souscriptions.filter(s => s.type_souscription === 'mise_en_garde').length, color: "#06b6d4" }
  ];

  // Données par zone
  const zoneData = souscriptions.reduce((acc: any[], sub) => {
    const zone = sub.proprietes?.zone || 'Non définie';
    const existing = acc.find(item => item.zone === zone);
    if (existing) {
      existing.count++;
      existing.valeur += sub.prix_total || 0;
    } else {
      acc.push({ zone, count: 1, valeur: sub.prix_total || 0 });
    }
    return acc;
  }, []).sort((a, b) => b.valeur - a.valeur);

  // Évolution des paiements mensuels
  const monthlyData = paiements.reduce((acc: any[], payment) => {
    const month = new Date(payment.date_paiement).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    const existing = acc.find(item => item.month === month);
    if (existing) {
      existing.montant += payment.montant;
    } else {
      acc.push({ month, montant: payment.montant });
    }
    return acc;
  }, []);

  // Souscriptions récentes
  const recentSouscriptions = souscriptions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Chargement du dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Souscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.active} actives, {stats.termine} terminées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRevenu.toLocaleString()} FCFA</div>
            <p className="text-xs text-muted-foreground">
              Valeur totale des contrats
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Montant encaissé</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalPaye.toLocaleString()} FCFA</div>
            <p className="text-xs text-muted-foreground">
              {((stats.totalPaye / stats.totalRevenu) * 100).toFixed(1)}% du total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solde restant</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.soldeRestant.toLocaleString()} FCFA</div>
            <p className="text-xs text-muted-foreground">
              {((stats.soldeRestant / stats.totalRevenu) * 100).toFixed(1)}% restant
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Répartition par phase</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={phaseData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ phase, count }) => `${phase} (${count})`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {phaseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition par type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8">
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Évolution des paiements et zones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Évolution des encaissements</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={(value: any) => [`${value.toLocaleString()} FCFA`, 'Montant']} />
                <Line type="monotone" dataKey="montant" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performances par zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {zoneData.slice(0, 5).map((zone, index) => (
                <div key={zone.zone} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-primary" style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }} />
                    <span className="text-sm font-medium">{zone.zone}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{zone.count} contrats</div>
                    <div className="text-xs text-muted-foreground">{zone.valeur.toLocaleString()} FCFA</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Souscriptions récentes */}
      <Card>
        <CardHeader>
          <CardTitle>Souscriptions récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentSouscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{sub.clients?.prenom} {sub.clients?.nom}</div>
                    <div className="text-sm text-muted-foreground">{sub.proprietes?.nom}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{sub.phase_actuelle}</Badge>
                    <Badge variant={sub.type_souscription === 'mise_en_garde' ? 'secondary' : 'default'}>
                      {sub.type_souscription === 'mise_en_garde' ? 'Mise en garde' : 'Classique'}
                    </Badge>
                  </div>
                  <div className="text-sm font-bold">{sub.prix_total?.toLocaleString()} FCFA</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}