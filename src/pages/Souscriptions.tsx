import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { SouscriptionForm } from "@/components/SouscriptionForm";
import { SouscriptionDetailsDialog } from "@/components/SouscriptionDetailsDialog";
import { PaiementSouscriptionEcheanceDialog } from "@/components/PaiementSouscriptionEcheanceDialog";
import { PaiementDroitTerreDialog } from "@/components/PaiementDroitTerreDialog";
import { SouscriptionsDashboard } from "@/components/SouscriptionsDashboard";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Eye, CreditCard, Calendar, Trash2, Coins, BarChart3 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ExportSouscriptionsButton } from "@/components/ExportSouscriptionsButton";
import { ProtectedAction } from "@/components/ProtectedAction";
import { AgentSummaryCard } from "@/components/AgentSummaryCard";
import { useAgentStats } from "@/hooks/useAgentStats";

export default function Souscriptions() {
  const { canAccessDashboard } = useUserPermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedSouscription, setSelectedSouscription] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isDroitTerreDialogOpen, setIsDroitTerreDialogOpen] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);

  const { data: souscriptions, isLoading, refetch } = useQuery({
    queryKey: ["souscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("souscriptions")
        .select(`
          *,
          clients(nom, prenom),
          proprietes!inner(nom, adresse, agent_id, agents_recouvrement(nom, prenom))
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents_recouvrement")
        .select("id, nom, prenom")
        .eq("statut", "actif")
        .order("nom");

      if (error) throw error;
      return data;
    },
  });

  const { data: baremes } = useQuery({
    queryKey: ["bareme_droits_terre"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bareme_droits_terre")
        .select("*")
        .order("montant_mensuel");

      if (error) throw error;
      return data;
    },
  });

  const { data: agentStats } = useAgentStats(agentFilter !== "all" ? agentFilter : null, "souscriptions", selectedMonth);
  
  const selectedAgent = agents?.find(agent => agent.id === agentFilter);
  const shouldShowAgentSummary = agentFilter !== "all" && selectedAgent && agentStats;

  const deleteSouscription = async (souscriptionId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette souscription ?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("souscriptions")
        .delete()
        .eq("id", souscriptionId);

      if (error) throw error;

      toast({
        title: "Succès",
        description: "La souscription a été supprimée.",
      });

      refetch();
    } catch (error) {
      console.error("Error deleting souscription:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la souscription.",
        variant: "destructive",
      });
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case "souscription":
        return "bg-blue-500";
      case "finition":
        return "bg-orange-500";
      case "droit_terre":
        return "bg-green-500";
      case "termine":
        return "bg-gray-500";
      default:
        return "bg-gray-400";
    }
  };

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case "souscription":
        return "Souscription";
      case "finition":
        return "En finition";
      case "droit_terre":
        return "Droit de terre";
      case "termine":
        return "Terminé";
      default:
        return phase;
    }
  };

  const filteredSouscriptions = souscriptions?.filter((sub) => {
    const matchesSearch = 
      sub.clients?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.clients?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.proprietes?.nom?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPhase = phaseFilter === "all" || sub.phase_actuelle === phaseFilter;
    
    const matchesAgent = agentFilter === "all" || 
      (sub.proprietes?.agent_id && sub.proprietes.agent_id === agentFilter);
    
    return matchesSearch && matchesPhase && matchesAgent;
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Chargement...</div>;
  }

  return (
    <div className="container mx-auto p-4 lg:p-6">
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Gestion des Souscriptions</h1>
        <div className="flex items-center gap-2">
          {canAccessDashboard && (
            <Button
              variant="outline"
              onClick={() => setShowDashboard(!showDashboard)}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              {showDashboard ? "Masquer" : "Afficher"} le tableau de bord
            </Button>
          )}
          <ExportSouscriptionsButton />
          <ProtectedAction permission="canCreateSubscriptions">
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Nouvelle souscription
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>
                    {selectedSouscription ? "Modifier la souscription" : "Nouvelle souscription"}
                  </DialogTitle>
                </DialogHeader>
                <SouscriptionForm
                  souscription={selectedSouscription}
                  onSuccess={() => {
                    setIsFormOpen(false);
                    setSelectedSouscription(null);
                    refetch();
                  }}
                  baremes={baremes || []}
                />
              </DialogContent>
            </Dialog>
          </ProtectedAction>
        </div>
      </div>

      {/* Dashboard */}
      {showDashboard && canAccessDashboard && <SouscriptionsDashboard />}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Input
          placeholder="Rechercher par client ou propriété..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Combobox
          options={[
            { value: "all", label: "Toutes les phases" },
            { value: "souscription", label: "Souscription" },
            { value: "finition", label: "En finition" },
            { value: "droit_terre", label: "Droit de terre" },
            { value: "termine", label: "Terminé" }
          ]}
          value={phaseFilter}
          onChange={setPhaseFilter}
          placeholder="Filtrer par phase"
          buttonClassName="w-48 justify-start"
        />
        <Combobox
          options={[
            { value: "all", label: "Tous les agents" },
            ...(agents?.map(agent => ({
              value: agent.id,
              label: `${agent.prenom} ${agent.nom}`
            })) || [])
          ]}
          value={agentFilter}
          onChange={setAgentFilter}
          placeholder="Filtrer par agent"
          buttonClassName="w-48 justify-start"
        />
      </div>

      {/* Agent Summary */}
      {shouldShowAgentSummary && (
        <AgentSummaryCard
          agentId={agentFilter}
          agentName={`${selectedAgent.prenom} ${selectedAgent.nom}`}
          mode="souscriptions"
          stats={agentStats}
          onMonthChange={setSelectedMonth}
        />
      )}

      {/* Souscriptions List */}
      <div className="grid gap-4">
        {filteredSouscriptions?.map((souscription) => (
          <Card key={souscription.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h3 className="text-lg font-semibold">
                      {souscription.clients?.prenom} {souscription.clients?.nom}
                    </h3>
                    <Badge className={getPhaseColor(souscription.phase_actuelle)}>
                      {getPhaseLabel(souscription.phase_actuelle)}
                    </Badge>
                    <Badge variant="outline">
                      {souscription.type_souscription === "mise_en_garde" ? "Import historique" : 
                       souscription.type_souscription === "historique" ? "Import historique" : "Classique"}
                    </Badge>
                    {souscription.solde_restant === 0 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                        ✓ Souscription payée
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Propriété</p>
                      <p className="font-medium">{souscription.proprietes?.nom}</p>
                      {souscription.proprietes?.agents_recouvrement && (
                        <p className="text-xs text-blue-600 font-medium">
                          Agent: {souscription.proprietes.agents_recouvrement.prenom} {souscription.proprietes.agents_recouvrement.nom}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Prix total</p>
                      <p className="font-medium">{souscription.prix_total?.toLocaleString()} FCFA</p>
                    </div>
                    {souscription.type_souscription === "mise_en_garde" && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Type de bien</p>
                          <p className="font-medium">{souscription.type_bien}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Droit de terre</p>
                          <p className="font-medium">{souscription.montant_droit_terre_mensuel?.toLocaleString()} FCFA/mois</p>
                        </div>
                      </>
                    )}
                  </div>

                  {souscription.type_souscription === "mise_en_garde" && souscription.date_fin_finition && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Fin de finition</p>
                          <p className="font-medium">
                            {format(new Date(souscription.date_fin_finition), "dd MMMM yyyy", { locale: fr })}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Début droit de terre</p>
                          <p className="font-medium">
                            {souscription.date_debut_droit_terre 
                              ? format(new Date(souscription.date_debut_droit_terre), "dd MMMM yyyy", { locale: fr })
                              : "À définir"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Période de finition</p>
                          <p className="font-medium">{souscription.periode_finition_mois} mois</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedSouscription(souscription);
                      setIsDetailsOpen(true);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Détails
                  </Button>


                  {/* Bouton pour paiement de souscription */}
                  {souscription.solde_restant > 0 && (
                    <ProtectedAction permission="canPayRents">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedSouscription(souscription);
                          setIsPaymentDialogOpen(true);
                        }}
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Paiement souscription
                      </Button>
                    </ProtectedAction>
                  )}

                   {/* Bouton pour paiement de droit de terre */}
                   <ProtectedAction permission="canPayLandRights">
                     <Button
                       variant="outline"
                       size="sm"
                       disabled={souscription.solde_restant > 0 || (souscription.montant_droit_terre_mensuel ?? 0) <= 0}
                       onClick={() => {
                         setSelectedSouscription(souscription);
                         setIsDroitTerreDialogOpen(true);
                       }}
                       title={
                         souscription.solde_restant > 0
                           ? "Disponible après solde de la souscription"
                         : (souscription.montant_droit_terre_mensuel ?? 0) <= 0
                           ? "Droit de terre non applicable"
                           : undefined
                     }
                   >
                     <Coins className="mr-2 h-4 w-4" />
                     Droit de terre
                   </Button>
                   </ProtectedAction>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteSouscription(souscription.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Details Dialog */}
      <SouscriptionDetailsDialog
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        souscription={selectedSouscription}
        onEdit={() => {
          setIsDetailsOpen(false);
          setIsFormOpen(true);
        }}
        onNewPayment={() => {
          setIsDetailsOpen(false);
          setIsPaymentDialogOpen(true);
        }}
        onNewDroitTerrePayment={() => {
          setIsDetailsOpen(false);
          setIsDroitTerreDialogOpen(true);
        }}
      />

      {/* Payment Dialog */}
      <PaiementSouscriptionEcheanceDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        souscription={selectedSouscription}
        onSuccess={() => {
          setIsPaymentDialogOpen(false);
          refetch();
        }}
      />

      {/* Droit de Terre Payment Dialog */}
      <PaiementDroitTerreDialog
        open={isDroitTerreDialogOpen}
        onOpenChange={setIsDroitTerreDialogOpen}
        souscription={selectedSouscription}
        onSuccess={() => {
          setIsDroitTerreDialogOpen(false);
          refetch();
        }}
      />
    </div>
  );
}