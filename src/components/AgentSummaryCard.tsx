import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Home, Building, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface AgentSummaryCardProps {
  agentId: string;
  agentName: string;
  mode: 'locations' | 'souscriptions' | 'all';
  stats: {
    totalProperties: number;
    activeLocations: number;
    monthlyRentTotal: number;
    activeSubscriptions: number;
    monthlyLandRightsTotal: number;
    totalMonthlyIncome: number;
  };
}

export function AgentSummaryCard({ agentName, mode, stats }: AgentSummaryCardProps) {
  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building className="h-5 w-5 text-primary" />
          Résumé de l'agent : <span className="font-bold text-primary">{agentName}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col items-center p-3 bg-background/80 rounded-lg border">
            <Home className="h-5 w-5 text-blue-600 mb-1" />
            <span className="text-2xl font-bold text-blue-600">{stats.totalProperties}</span>
            <span className="text-xs text-muted-foreground text-center">Propriétés gérées</span>
          </div>
          
          {mode === 'locations' && (
            <>
              <div className="flex flex-col items-center p-3 bg-background/80 rounded-lg border">
                <Building className="h-5 w-5 text-green-600 mb-1" />
                <span className="text-2xl font-bold text-green-600">{stats.activeLocations}</span>
                <span className="text-xs text-muted-foreground text-center">Locations actives</span>
              </div>
              
              <div className="flex flex-col items-center p-3 bg-primary/10 rounded-lg border border-primary/30">
                <TrendingUp className="h-5 w-5 text-primary mb-1" />
                <span className="text-sm font-bold text-primary">
                  {formatCurrency(stats.monthlyRentTotal)}
                </span>
                <span className="text-xs text-muted-foreground text-center">Loyers mensuels</span>
              </div>
            </>
          )}

          {mode === 'souscriptions' && (
            <>
              <div className="flex flex-col items-center p-3 bg-background/80 rounded-lg border">
                <Calendar className="h-5 w-5 text-purple-600 mb-1" />
                <span className="text-2xl font-bold text-purple-600">{stats.activeSubscriptions}</span>
                <span className="text-xs text-muted-foreground text-center">Souscriptions actives</span>
              </div>
              
              <div className="flex flex-col items-center p-3 bg-primary/10 rounded-lg border border-primary/30">
                <TrendingUp className="h-5 w-5 text-primary mb-1" />
                <span className="text-sm font-bold text-primary">
                  {formatCurrency(stats.monthlyLandRightsTotal)}
                </span>
                <span className="text-xs text-muted-foreground text-center">Droits de terre</span>
              </div>
            </>
          )}

          {mode === 'all' && (
            <>
              <div className="flex flex-col items-center p-3 bg-background/80 rounded-lg border">
                <Building className="h-5 w-5 text-green-600 mb-1" />
                <span className="text-2xl font-bold text-green-600">{stats.activeLocations}</span>
                <span className="text-xs text-muted-foreground text-center">Locations actives</span>
              </div>
              
              <div className="flex flex-col items-center p-3 bg-background/80 rounded-lg border">
                <DollarSign className="h-5 w-5 text-emerald-600 mb-1" />
                <span className="text-sm font-bold text-emerald-600">
                  {formatCurrency(stats.monthlyRentTotal)}
                </span>
                <span className="text-xs text-muted-foreground text-center">Loyers mensuels</span>
              </div>
              
              <div className="flex flex-col items-center p-3 bg-background/80 rounded-lg border">
                <Calendar className="h-5 w-5 text-purple-600 mb-1" />
                <span className="text-2xl font-bold text-purple-600">{stats.activeSubscriptions}</span>
                <span className="text-xs text-muted-foreground text-center">Souscriptions actives</span>
              </div>
              
              <div className="flex flex-col items-center p-3 bg-background/80 rounded-lg border">
                <DollarSign className="h-5 w-5 text-orange-600 mb-1" />
                <span className="text-sm font-bold text-orange-600">
                  {formatCurrency(stats.monthlyLandRightsTotal)}
                </span>
                <span className="text-xs text-muted-foreground text-center">Droits de terre</span>
              </div>
              
              <div className="flex flex-col items-center p-3 bg-primary/10 rounded-lg border border-primary/30">
                <TrendingUp className="h-5 w-5 text-primary mb-1" />
                <span className="text-sm font-bold text-primary">
                  {formatCurrency(stats.totalMonthlyIncome)}
                </span>
                <span className="text-xs text-muted-foreground text-center">Total mensuel</span>
              </div>
            </>
          )}
        </div>
        
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          <Badge variant="secondary" className="text-xs">
            {mode === 'locations' ? 'Revenus locatifs mensuels' : 
             mode === 'souscriptions' ? 'Revenus droits de terre mensuels' : 
             'Revenus mensuels totaux à percevoir'}
          </Badge>
          <Badge variant={
            (mode === 'locations' ? stats.monthlyRentTotal :
             mode === 'souscriptions' ? stats.monthlyLandRightsTotal :
             stats.totalMonthlyIncome) > 0 ? "default" : "secondary"
          } className="text-xs">
            {(mode === 'locations' ? stats.monthlyRentTotal :
              mode === 'souscriptions' ? stats.monthlyLandRightsTotal :
              stats.totalMonthlyIncome) > 0 ? "Agent actif" : "Aucun revenu"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}