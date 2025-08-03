import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Building, FileText, TrendingUp, AlertCircle, CheckCircle, Home } from "lucide-react";

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [clients, proprietes, factures, souscriptions, locations] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact' }),
        supabase.from('proprietes').select('*', { count: 'exact' }),
        supabase.from('factures_fournisseurs').select('*', { count: 'exact' }),
        supabase.from('souscriptions').select('*'),
        supabase.from('locations').select('*'),
      ]);

      const facturesImpayees = factures.data?.filter(f => f.solde > 0).length || 0;
      const souscriptionsActives = souscriptions.data?.filter(s => s.statut === 'active').length || 0;
      const locationsActives = locations.data?.filter(l => l.statut === 'active').length || 0;

      return {
        totalClients: clients.count || 0,
        totalProprietes: proprietes.count || 0,
        totalFactures: factures.count || 0,
        facturesImpayees,
        souscriptionsActives,
        locationsActives,
      };
    },
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const [recentClients, recentProprietes, recentFactures] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('proprietes').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('factures_fournisseurs').select('*, fournisseurs(nom)').order('created_at', { ascending: false }).limit(5),
      ]);

      return {
        recentClients: recentClients.data || [],
        recentProprietes: recentProprietes.data || [],
        recentFactures: recentFactures.data || [],
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Vue d'ensemble de votre activité immobilière
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              Clients enregistrés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Propriétés</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProprietes || 0}</div>
            <p className="text-xs text-muted-foreground">
              Propriétés gérées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Factures impayées</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.facturesImpayees || 0}</div>
            <p className="text-xs text-muted-foreground">
              Sur {stats?.totalFactures || 0} factures
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contrats actifs</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {(stats?.souscriptionsActives || 0) + (stats?.locationsActives || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Souscriptions + Locations
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Clients récents</CardTitle>
            <CardDescription>
              Derniers clients ajoutés
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity?.recentClients.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun client enregistré</p>
              ) : (
                recentActivity?.recentClients.map((client) => (
                  <div key={client.id} className="flex items-center">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">{client.nom} {client.prenom}</p>
                      <p className="text-xs text-muted-foreground">{client.telephone_principal || "-"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Propriétés récentes</CardTitle>
            <CardDescription>
              Dernières propriétés ajoutées
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity?.recentProprietes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune propriété enregistrée</p>
              ) : (
                recentActivity?.recentProprietes.map((propriete) => (
                  <div key={propriete.id} className="flex items-center">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building className="w-4 h-4" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">{propriete.nom}</p>
                      <p className="text-xs text-muted-foreground">{propriete.adresse}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Factures récentes</CardTitle>
            <CardDescription>
              Dernières factures enregistrées
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity?.recentFactures.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune facture enregistrée</p>
              ) : (
                recentActivity?.recentFactures.map((facture) => (
                  <div key={facture.id} className="flex items-center">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">{facture.numero}</p>
                      <p className="text-xs text-muted-foreground">
                        {facture.fournisseurs?.nom} - {facture.montant_total}€
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}