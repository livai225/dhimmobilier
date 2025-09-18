import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedAction } from "./ProtectedAction";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, MapPin, CreditCard, Calendar, FileText, Printer, Coins } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { ReceiptDetailsDialog } from "./ReceiptDetailsDialog";
import { ReceiptWithDetails } from "@/hooks/useReceipts";

interface SouscriptionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  souscription: any;
  onEdit: () => void;
  onNewPayment: () => void;
  onNewDroitTerrePayment: () => void;
}

export function SouscriptionDetailsDialog({
  open,
  onOpenChange,
  souscription,
  onEdit,
  onNewPayment,
  onNewDroitTerrePayment
}: SouscriptionDetailsDialogProps) {
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptWithDetails | null>(null);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const { data: client } = useQuery({
    queryKey: ["client", souscription?.client_id],
    queryFn: async () => {
      if (!souscription?.client_id) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", souscription.client_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!souscription?.client_id,
  });

  const { data: propriete } = useQuery({
    queryKey: ["propriete", souscription?.propriete_id],
    queryFn: async () => {
      if (!souscription?.propriete_id) return null;
      const { data, error } = await supabase
        .from("proprietes")
        .select("*")
        .eq("id", souscription.propriete_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!souscription?.propriete_id,
  });

  const { data: paiements, refetch: refetchPaiements } = useQuery({
    queryKey: ["paiements_souscription", souscription?.id],
    queryFn: async () => {
      if (!souscription?.id) return [];
      console.log("Récupération des paiements pour souscription:", souscription.id);
      const { data, error } = await supabase
        .from("paiements_souscriptions")
        .select("*")
        .eq("souscription_id", souscription.id)
        .order("date_paiement", { ascending: false });
      if (error) throw error;
      console.log("Paiements récupérés:", data?.length || 0);
      return data;
    },
    enabled: !!souscription?.id,
    refetchOnWindowFocus: true,
    staleTime: 0, // Force fresh data
  });

  if (!souscription) return null;

  // Use the balance from database instead of recalculating to avoid inconsistencies with historical subscriptions
  const paiementsTotal = paiements?.reduce((sum, p) => sum + Number(p.montant), 0) || 0;
  const totalPaye = paiementsTotal;
  const soldeRestant = Number(souscription.solde_restant || 0);
  
  // Calculate work progress
  const getWorkProgress = () => {
    if (!souscription.date_debut || souscription.type_souscription !== "mise_en_garde") return 0;
    
    const startDate = new Date(souscription.date_debut);
    const endDate = new Date(startDate.getTime() + (souscription.periode_finition_mois || 9) * 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    
    if (now >= endDate) return 100;
    if (now <= startDate) return 0;
    
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsedDuration = now.getTime() - startDate.getTime();
    
    return Math.round((elapsedDuration / totalDuration) * 100);
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case "souscription": return "bg-blue-500";
      case "finition": return "bg-orange-500";
      case "droit_terre": return "bg-green-500";
      case "termine": return "bg-gray-500";
      default: return "bg-gray-400";
    }
  };

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case "souscription": return "Souscription";
      case "finition": return "En finition";
      case "droit_terre": return "Droit de terre";
      case "termine": return "Terminé";
      default: return phase;
    }
  };

  const handleViewReceipt = async (paiementId: string) => {
    try {
      const { data: receipt, error } = await supabase
        .from("recus")
        .select("*")
        .eq("reference_id", paiementId)
        .eq("type_operation", "apport_souscription")
        .single();

      if (error || !receipt) {
        console.error("Reçu non trouvé pour le paiement:", paiementId);
        return;
      }

      // Enrichir le reçu avec les détails nécessaires
      const enrichedReceipt: ReceiptWithDetails = {
        ...receipt,
        client: {
          nom: client?.nom || "",
          prenom: client?.prenom || "",
          email: client?.email || null,
          telephone_principal: client?.telephone_principal || null,
        },
        property_name: propriete?.nom || null,
        property_address: propriete?.adresse || null,
        souscription_prix_total: souscription?.prix_total || 0,
      };

      setSelectedReceipt(enrichedReceipt);
      setIsReceiptDialogOpen(true);
    } catch (error) {
      console.error("Erreur lors de la récupération du reçu:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <DialogTitle className="text-xl sm:text-2xl">Détails de la souscription</DialogTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onEdit} size="sm" className="w-full sm:w-auto">
              Modifier
            </Button>
            {soldeRestant > 0 && (
              <Button onClick={onNewPayment} size="sm" className="w-full sm:w-auto">
                <CreditCard className="mr-2 h-4 w-4" />
                Paiement souscription
              </Button>
            )}
            <ProtectedAction permission="canPayLandRights">
              <Button onClick={onNewDroitTerrePayment} size="sm" variant="outline" className="w-full sm:w-auto">
                <Coins className="mr-2 h-4 w-4" />
                Droit de terre
              </Button>
            </ProtectedAction>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column - Client & Property Info */}
          <div className="space-y-4">
            {/* Client Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5" />
                  Informations souscripteur
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Nom complet</p>
                  <p className="font-medium">{client?.prenom} {client?.nom}</p>
                </div>
                {client?.telephone_principal && (
                  <div>
                    <p className="text-sm text-muted-foreground">Téléphone</p>
                    <p className="font-medium">{client.telephone_principal}</p>
                  </div>
                )}
                {client?.email && (
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{client.email}</p>
                  </div>
                )}
                {client?.adresse && (
                  <div>
                    <p className="text-sm text-muted-foreground">Adresse</p>
                    <p className="font-medium">{client.adresse}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Property Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5" />
                  Propriété
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Nom</p>
                  <p className="font-medium">{propriete?.nom}</p>
                </div>
                {propriete?.adresse && (
                  <div>
                    <p className="text-sm text-muted-foreground">Adresse</p>
                    <p className="font-medium">{propriete.adresse}</p>
                  </div>
                )}
                {propriete?.surface && (
                  <div>
                    <p className="text-sm text-muted-foreground">Surface</p>
                    <p className="font-medium">{propriete.surface} m²</p>
                  </div>
                )}
                {propriete?.zone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Zone</p>
                    <p className="font-medium">{propriete.zone}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Financial Summary */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5" />
                  Résumé financier
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <Badge className={getPhaseColor(souscription.phase_actuelle)}>
                    {getPhaseLabel(souscription.phase_actuelle)}
                  </Badge>
                  <Badge variant="outline">
                    {souscription.type_souscription === "mise_en_garde" ? "Import historique" : 
                     souscription.type_souscription === "historique" ? "Import historique" : "Classique"}
                  </Badge>
                  {soldeRestant <= 0 && (
                    <Badge variant="default" className="bg-green-500">
                      Souscription soldée
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Montant total</p>
                    <p className="font-bold text-lg">{(souscription.prix_total || souscription.montant_souscris || 0).toLocaleString()} FCFA</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Premier paiement</p>
                    <p className="font-medium">{paiements?.[paiements.length - 1]?.montant?.toLocaleString() || '0'} FCFA</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total payé</p>
                    <p className="font-medium text-green-600">{totalPaye.toLocaleString()} FCFA</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Solde restant</p>
                    <p className="font-medium text-orange-600">{soldeRestant.toLocaleString()} FCFA</p>
                  </div>
                </div>

                {souscription.type_souscription === "mise_en_garde" && (
                  <div className="pt-4 border-t">
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Droit de terre mensuel</p>
                        <p className="font-medium">{(souscription.montant_droit_terre_mensuel || 0).toLocaleString()} FCFA</p>
                      </div>
                      {souscription.type_bien && (
                        <div>
                          <p className="text-sm text-muted-foreground">Type de bien</p>
                          <p className="font-medium">{souscription.type_bien}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Date de début</p>
                      <p className="font-medium">
                        {souscription.date_debut ? format(new Date(souscription.date_debut), "dd MMMM yyyy", { locale: fr }) : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Work Period Progress (for mise_en_garde) */}
            {souscription.type_souscription === "mise_en_garde" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5" />
                    Période de travaux
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progression</span>
                      <span>{getWorkProgress()}%</span>
                    </div>
                    <Progress value={getWorkProgress()} className="h-2" />
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Période de finition</p>
                      <p className="font-medium">{souscription.periode_finition_mois || 9} mois</p>
                    </div>
                    {souscription.date_fin_finition && (
                      <div>
                        <p className="text-muted-foreground">Fin de finition prévue</p>
                        <p className="font-medium">
                          {format(new Date(souscription.date_fin_finition), "dd MMMM yyyy", { locale: fr })}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Début droit de terre</p>
                      <p className="font-medium">
                        {souscription.date_debut_droit_terre 
                          ? format(new Date(souscription.date_debut_droit_terre), "dd MMMM yyyy", { locale: fr })
                          : "Après la fin des travaux de finition"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Droit de terre Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5" />
                  Droit de terre
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">
                    Le client devra commencer à payer le droit de terre :
                  </p>
                  <p className="font-medium mb-3">
                    À partir du {souscription.date_debut ? format(new Date(souscription.date_debut), "dd MMMM yyyy", { locale: fr }) : "-"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Période de paiement : <span className="font-medium">20 ans (240 mois)</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Montant mensuel</p>
                    <p className="font-bold text-lg">
                      {(souscription.montant_droit_terre_mensuel || 0).toLocaleString()} FCFA
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total sur 20 ans</p>
                    <p className="font-bold text-lg">
                      {((souscription.montant_droit_terre_mensuel || 0) * 240).toLocaleString()} FCFA
                    </p>
                  </div>
                </div>

                {souscription.type_bien && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground">Type de bien</p>
                    <p className="font-medium">{souscription.type_bien}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Payment History */}
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Historique des paiements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Autres paiements */}
                      {paiements?.map((paiement) => (
                        <TableRow key={paiement.id}>
                          <TableCell className="text-sm">
                            {format(new Date(paiement.date_paiement), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {Number(paiement.montant).toLocaleString()} FCFA
                          </TableCell>
                          <TableCell className="text-sm">
                            {paiement.mode_paiement || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Badge variant="outline">Paiement</Badge>
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewReceipt(paiement.id)}
                            >
                              <Printer className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Affichage si aucun paiement */}
                      {(!paiements || paiements.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Aucun paiement enregistré</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  
                  <div className="flex justify-between text-sm font-medium pt-2 border-t">
                    <span>Total payé:</span>
                    <span>{totalPaye.toLocaleString()} FCFA</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>

      <ReceiptDetailsDialog
        receipt={selectedReceipt}
        open={isReceiptDialogOpen}
        onOpenChange={setIsReceiptDialogOpen}
      />
    </Dialog>
  );
}