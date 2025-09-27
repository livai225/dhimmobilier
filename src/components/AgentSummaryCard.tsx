import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Home, Building, DollarSign, Calendar, TrendingUp, Users, Target, Percent } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useState } from "react";

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
    totalClients: number;
    clientsFromLocations: number;
    clientsFromSubscriptions: number;
    totalDue: number;
    totalPaid: number;
    recoveryRate: number;
    outstanding: number;
  };
  onMonthChange?: (month: string) => void;
}

export function AgentSummaryCard({ agentName, mode, stats, onMonthChange }: AgentSummaryCardProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const months = [
    { value: "all", label: "Tous les mois" },
    { value: `${new Date().getFullYear()}-1`, label: "Janvier 2024" },
    { value: `${new Date().getFullYear()}-2`, label: "Février 2024" },
    { value: `${new Date().getFullYear()}-3`, label: "Mars 2024" },
    { value: `${new Date().getFullYear()}-4`, label: "Avril 2024" },
    { value: `${new Date().getFullYear()}-5`, label: "Mai 2024" },
    { value: `${new Date().getFullYear()}-6`, label: "Juin 2024" },
    { value: `${new Date().getFullYear()}-7`, label: "Juillet 2024" },
    { value: `${new Date().getFullYear()}-8`, label: "Août 2024" },
    { value: `${new Date().getFullYear()}-9`, label: "Septembre 2024" },
    { value: `${new Date().getFullYear()}-10`, label: "Octobre 2024" },
    { value: `${new Date().getFullYear()}-11`, label: "Novembre 2024" },
    { value: `${new Date().getFullYear()}-12`, label: "Décembre 2024" },
  ];

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    onMonthChange?.(month);
  };
  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg">
            <Building className="h-5 w-5 text-primary" />
            Résumé de l'agent : <span className="font-bold text-primary">{agentName}</span>
          </div>
          <Select value={selectedMonth} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sélectionner un mois" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              
              <div className="flex flex-col items-center p-3 bg-background/80 rounded-lg border">
                <Users className="h-5 w-5 text-purple-600 mb-1" />
                <span className="text-2xl font-bold text-purple-600">{stats.clientsFromLocations}</span>
                <span className="text-xs text-muted-foreground text-center">Clients locations</span>
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
              
              <div className="flex flex-col items-center p-3 bg-background/80 rounded-lg border">
                <Users className="h-5 w-5 text-purple-600 mb-1" />
                <span className="text-2xl font-bold text-purple-600">{stats.clientsFromSubscriptions}</span>
                <span className="text-xs text-muted-foreground text-center">Clients souscriptions</span>
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
                <span className="text-xs text-muted-foreground text-center">Locations</span>
              </div>
              
              <div className="flex flex-col items-center p-3 bg-background/80 rounded-lg border">
                <Calendar className="h-5 w-5 text-purple-600 mb-1" />
                <span className="text-2xl font-bold text-purple-600">{stats.activeSubscriptions}</span>
                <span className="text-xs text-muted-foreground text-center">Souscriptions</span>
              </div>
              
              <div className="flex flex-col items-center p-3 bg-background/80 rounded-lg border">
                <Users className="h-5 w-5 text-purple-600 mb-1" />
                <span className="text-2xl font-bold text-purple-600">{stats.totalClients}</span>
                <span className="text-xs text-muted-foreground text-center">Total clients</span>
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
        
        {/* Payment Metrics Section */}
        <div className="mt-6 border-t pt-4">
          <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Métriques de Paiements
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex flex-col items-center p-3 bg-blue-50 rounded-lg border">
              <Target className="h-4 w-4 text-blue-600 mb-1" />
              <span className="text-lg font-bold text-blue-600">{formatCurrency(stats.totalDue)}</span>
              <span className="text-xs text-muted-foreground text-center">Total à percevoir</span>
            </div>
            
            <div className="flex flex-col items-center p-3 bg-green-50 rounded-lg border">
              <DollarSign className="h-4 w-4 text-green-600 mb-1" />
              <span className="text-lg font-bold text-green-600">{formatCurrency(stats.totalPaid)}</span>
              <span className="text-xs text-muted-foreground text-center">Total payé</span>
            </div>
            
            <div className="flex flex-col items-center p-3 bg-purple-50 rounded-lg border">
              <Percent className="h-4 w-4 text-purple-600 mb-1" />
              <span className={`text-lg font-bold ${
                stats.recoveryRate >= 90 ? 'text-green-600' : 
                stats.recoveryRate >= 70 ? 'text-orange-600' : 'text-red-600'
              }`}>
                {stats.recoveryRate}%
              </span>
              <span className="text-xs text-muted-foreground text-center">Taux recouvrement</span>
            </div>
            
            <div className="flex flex-col items-center p-3 bg-red-50 rounded-lg border">
              <TrendingUp className="h-4 w-4 text-red-600 mb-1" />
              <span className="text-lg font-bold text-red-600">{formatCurrency(stats.outstanding)}</span>
              <span className="text-xs text-muted-foreground text-center">En retard</span>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Progression des paiements</span>
              <span className={
                stats.recoveryRate >= 90 ? 'text-green-600' : 
                stats.recoveryRate >= 70 ? 'text-orange-600' : 'text-red-600'
              }>
                {stats.recoveryRate}%
              </span>
            </div>
            <Progress 
              value={stats.recoveryRate} 
              className="h-2"
            />
          </div>
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