import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  CreditCard, 
  FileText, 
  Edit, 
  XCircle,
  Calendar,
  Home,
  User,
  DollarSign
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { PaiementLocationDialog } from "@/components/PaiementLocationDialog";

interface LocationDetailsDialogProps {
  location: any;
  onClose: () => void;
  onUpdate: () => void;
}

export function LocationDetailsDialog({ location, onClose, onUpdate }: LocationDetailsDialogProps) {
  const [showPaiementDialog, setShowPaiementDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch payments for this location
  const { data: paiements } = useQuery({
    queryKey: ["paiements_locations", location.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paiements_locations")
        .select("*")
        .eq("location_id", location.id)
        .order("date_paiement", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch receipts for this location
  const { data: recus } = useQuery({
    queryKey: ["recus", location.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recus")
        .select("*")
        .eq("reference_id", location.id)
        .eq("type_operation", "location")
        .order("date_generation", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const terminateLocationMutation = useMutation({
    mutationFn: async () => {
      // Update location status
      const { error: locationError } = await supabase
        .from("locations")
        .update({ statut: "termine" })
        .eq("id", location.id);

      if (locationError) throw locationError;

      // Update property status back to 'Libre'
      const { error: propertyError } = await supabase
        .from("proprietes")
        .update({ statut: "Libre" })
        .eq("id", location.propriete_id);

      if (propertyError) throw propertyError;
    },
    onSuccess: () => {
      toast({
        title: "Location terminée",
        description: "La location a été terminée et la propriété est maintenant libre.",
      });
      onUpdate();
      onClose();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de terminer la location.",
        variant: "destructive",
      });
    },
  });

  const calculateProgress = () => {
    const totalPaye = paiements?.reduce((sum, p) => sum + Number(p.montant), 0) || 0;
    const totalDu = location.loyer_mensuel * 12; // Assuming yearly calculation
    return Math.min((totalPaye / totalDu) * 100, 100);
  };

  const getStatusBadge = (statut: string) => {
    const variants: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      active: "default",
      termine: "secondary",
      suspendu: "destructive",
    };
    return variants[statut] || "default";
  };

  const handleTerminateLocation = () => {
    if (confirm("Êtes-vous sûr de vouloir terminer cette location ? Cette action libérera la propriété.")) {
      terminateLocationMutation.mutate();
    }
  };

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="w-5 h-5" />
              Détails de la Location
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Informations Générales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Propriété</p>
                  <p className="text-lg">{location.proprietes?.nom}</p>
                  <p className="text-sm text-muted-foreground">{location.proprietes?.adresse}</p>
                </div>

                <div>
                  <p className="text-sm font-medium">Locataire</p>
                  <p className="text-lg">{location.clients?.prenom} {location.clients?.nom}</p>
                  <p className="text-sm text-muted-foreground">{location.clients?.telephone_principal}</p>
                </div>

                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium">Statut</p>
                    <Badge variant={getStatusBadge(location.statut)}>
                      {location.statut === 'active' ? 'Active' : 
                       location.statut === 'termine' ? 'Terminée' : 'Suspendue'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Date de début</p>
                    <p className="text-sm">{format(new Date(location.date_debut), "PPP", { locale: fr })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Informations Financières
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Loyer Mensuel</p>
                  <p className="text-2xl font-bold text-primary">
                    {location.loyer_mensuel?.toLocaleString()} FCFA
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-medium">Détail de la Caution (5 mois)</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>2 mois de garantie:</span>
                      <span>{location.garantie_2_mois?.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>2 mois de loyer d'avance:</span>
                      <span>{location.loyer_avance_2_mois?.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between">
                      <span>1 mois d'agence:</span>
                      <span>{location.frais_agence_1_mois?.toLocaleString()} FCFA</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total versé:</span>
                      <span className="text-green-600">{location.caution_totale?.toLocaleString()} FCFA</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium">Dette Restante</p>
                  <p className={`text-xl font-bold ${
                    location.dette_totale > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {location.dette_totale?.toLocaleString()} FCFA
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Progression des Paiements</p>
                  <Progress value={calculateProgress()} className="w-full" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {calculateProgress().toFixed(1)}% des paiements annuels
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payments History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Historique des Paiements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paiements && paiements.length > 0 ? (
                <div className="space-y-2">
                  {paiements.map((paiement) => (
                    <div key={paiement.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{paiement.montant?.toLocaleString()} FCFA</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(paiement.date_paiement), "PPP", { locale: fr })}
                        </p>
                        {paiement.reference && (
                          <p className="text-xs text-muted-foreground">Réf: {paiement.reference}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{paiement.mode_paiement}</p>
                        <Button variant="ghost" size="sm">
                          <FileText className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  Aucun paiement enregistré
                </p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <div className="flex gap-2">
              {location.statut === 'active' && (
                <>
                  <Button
                    onClick={() => setShowPaiementDialog(true)}
                    className="flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Nouveau Paiement
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleTerminateLocation}
                    className="flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Terminer Location
                  </Button>
                </>
              )}
            </div>
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      {showPaiementDialog && (
        <PaiementLocationDialog
          location={location}
          onClose={() => setShowPaiementDialog(false)}
          onSuccess={() => {
            setShowPaiementDialog(false);
            onUpdate();
            queryClient.invalidateQueries({ queryKey: ["paiements_locations", location.id] });
            queryClient.invalidateQueries({ queryKey: ["recus", location.id] });
          }}
        />
      )}
    </>
  );
}