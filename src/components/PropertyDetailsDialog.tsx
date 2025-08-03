import { useState } from "react";
import { Eye, User, CreditCard, Receipt, Home, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PropertyDetailsDialogProps {
  propriete: {
    id: string;
    nom: string;
    adresse: string;
    statut: string;
    usage: string;
    surface: number;
    loyer_mensuel: number;
    montant_bail: number;
    droit_terre: number;
    zone: string;
    prix_achat: number;
  };
}

export function PropertyDetailsDialog({ propriete }: PropertyDetailsDialogProps) {
  const [open, setOpen] = useState(false);

  // Récupérer les détails complets de la propriété avec location/souscription active
  const { data: propertyDetails, isLoading } = useQuery({
    queryKey: ["property-details", propriete.id],
    queryFn: async () => {
      // Location active
      const { data: activeLocation } = await supabase
        .from("locations")
        .select(`
          *,
          client:clients(*)
        `)
        .eq("propriete_id", propriete.id)
        .eq("statut", "active")
        .single();

      // Souscription active
      const { data: activeSubscription } = await supabase
        .from("souscriptions")
        .select(`
          *,
          client:clients(*)
        `)
        .eq("propriete_id", propriete.id)
        .eq("statut", "active")
        .single();

      // Paiements de location
      const { data: locationPayments } = await supabase
        .from("paiements_locations")
        .select("*")
        .eq("location_id", activeLocation?.id || "")
        .order("date_paiement", { ascending: false });

      // Paiements de souscription
      const { data: subscriptionPayments } = await supabase
        .from("paiements_souscriptions")
        .select("*")
        .eq("souscription_id", activeSubscription?.id || "")
        .order("date_paiement", { ascending: false });

      // Reçus générés
      const { data: receipts } = await supabase
        .from("recus")
        .select(`
          *,
          client:clients(nom, prenom)
        `)
        .or(`reference_id.eq.${activeLocation?.id || ""},reference_id.eq.${activeSubscription?.id || ""}`)
        .order("date_generation", { ascending: false });

      return {
        activeLocation,
        activeSubscription,
        locationPayments: locationPayments || [],
        subscriptionPayments: subscriptionPayments || [],
        receipts: receipts || [],
      };
    },
    enabled: open,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (statut: string) => {
    const variants = {
      Libre: "secondary",
      Occupé: "destructive",
      "En rénovation": "outline",
    } as const;
    
    return (
      <Badge variant={variants[statut as keyof typeof variants] || "secondary"}>
        {statut}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Détails de {propriete.nom}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
            <TabsTrigger value="souscription">Souscription</TabsTrigger>
            <TabsTrigger value="paiements">Paiements</TabsTrigger>
            <TabsTrigger value="recus">Reçus</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Informations générales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nom</label>
                    <p className="text-base">{propriete.nom}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Statut</label>
                    <div className="mt-1">{getStatusBadge(propriete.statut)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Adresse</label>
                    <p className="text-base">{propriete.adresse || "Non renseignée"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Zone</label>
                    <p className="text-base">{propriete.zone || "Non renseignée"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Surface</label>
                    <p className="text-base">{propriete.surface ? `${propriete.surface} m²` : "Non renseignée"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Usage</label>
                    <p className="text-base">{propriete.usage}</p>
                  </div>
                </div>

                {propriete.usage === "Location" && (
                  <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Loyer mensuel</label>
                      <p className="text-base font-semibold">{formatCurrency(propriete.loyer_mensuel || 0)}</p>
                    </div>
                  </div>
                )}

                {propriete.usage === "Bail" && (
                  <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Montant du bail</label>
                      <p className="text-base font-semibold">{formatCurrency(propriete.montant_bail || 0)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Droit de terre</label>
                      <p className="text-base font-semibold">{formatCurrency(propriete.droit_terre || 0)}</p>
                    </div>
                  </div>
                )}

                {propriete.prix_achat && (
                  <div className="mt-6 pt-4 border-t">
                    <label className="text-sm font-medium text-muted-foreground">Prix d'achat</label>
                    <p className="text-base font-semibold">{formatCurrency(propriete.prix_achat)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="location" className="space-y-4">
            {isLoading ? (
              <div>Chargement...</div>
            ) : propertyDetails?.activeLocation ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Location active
                  </CardTitle>
                  <CardDescription>
                    Du {new Date(propertyDetails.activeLocation.date_debut).toLocaleDateString()} 
                    {propertyDetails.activeLocation.date_fin && ` au ${new Date(propertyDetails.activeLocation.date_fin).toLocaleDateString()}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Locataire</label>
                      <p className="text-base">
                        {propertyDetails.activeLocation.client.nom} {propertyDetails.activeLocation.client.prenom}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Téléphone</label>
                      <p className="text-base">{propertyDetails.activeLocation.client.telephone_principal || "Non renseigné"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <p className="text-base">{propertyDetails.activeLocation.client.email || "Non renseigné"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Caution</label>
                      <p className="text-base font-semibold">{formatCurrency(propertyDetails.activeLocation.caution)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Loyer mensuel</label>
                      <p className="text-base font-semibold">{formatCurrency(propertyDetails.activeLocation.loyer_mensuel)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Dette totale</label>
                      <p className="text-base font-semibold text-destructive">{formatCurrency(propertyDetails.activeLocation.dette_totale)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">Aucune location active pour cette propriété</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="souscription" className="space-y-4">
            {isLoading ? (
              <div>Chargement...</div>
            ) : propertyDetails?.activeSubscription ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Souscription active
                  </CardTitle>
                  <CardDescription>
                    Depuis le {new Date(propertyDetails.activeSubscription.date_debut).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Souscripteur</label>
                      <p className="text-base">
                        {propertyDetails.activeSubscription.client.nom} {propertyDetails.activeSubscription.client.prenom}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Prix total</label>
                      <p className="text-base font-semibold">{formatCurrency(propertyDetails.activeSubscription.prix_total)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Apport initial</label>
                      <p className="text-base font-semibold">{formatCurrency(propertyDetails.activeSubscription.apport_initial)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Montant mensuel</label>
                      <p className="text-base font-semibold">{formatCurrency(propertyDetails.activeSubscription.montant_mensuel)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Nombre de mois</label>
                      <p className="text-base">{propertyDetails.activeSubscription.nombre_mois} mois</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Solde restant</label>
                      <p className="text-base font-semibold text-destructive">{formatCurrency(propertyDetails.activeSubscription.solde_restant)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">Aucune souscription active pour cette propriété</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="paiements" className="space-y-4">
            {isLoading ? (
              <div>Chargement...</div>
            ) : (
              <div className="space-y-4">
                {propertyDetails?.locationPayments && propertyDetails.locationPayments.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Paiements de location
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {propertyDetails.locationPayments.map((payment) => (
                          <div key={payment.id} className="flex justify-between items-center p-2 border rounded">
                            <div>
                              <p className="font-medium">{formatCurrency(payment.montant)}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(payment.date_paiement).toLocaleDateString()}
                                {payment.mode_paiement && ` • ${payment.mode_paiement}`}
                              </p>
                            </div>
                            {payment.reference && (
                              <Badge variant="outline">{payment.reference}</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {propertyDetails?.subscriptionPayments && propertyDetails.subscriptionPayments.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Paiements de souscription
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {propertyDetails.subscriptionPayments.map((payment) => (
                          <div key={payment.id} className="flex justify-between items-center p-2 border rounded">
                            <div>
                              <p className="font-medium">{formatCurrency(payment.montant)}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(payment.date_paiement).toLocaleDateString()}
                                {payment.mode_paiement && ` • ${payment.mode_paiement}`}
                              </p>
                            </div>
                            {payment.reference && (
                              <Badge variant="outline">{payment.reference}</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(!propertyDetails?.locationPayments?.length && !propertyDetails?.subscriptionPayments?.length) && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <p className="text-muted-foreground">Aucun paiement enregistré pour cette propriété</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="recus" className="space-y-4">
            {isLoading ? (
              <div>Chargement...</div>
            ) : propertyDetails?.receipts && propertyDetails.receipts.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Reçus générés
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {propertyDetails.receipts.map((receipt) => (
                      <div key={receipt.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <p className="font-medium">Reçu #{receipt.numero}</p>
                          <p className="text-sm text-muted-foreground">
                            {receipt.client.nom} {receipt.client.prenom} • {formatCurrency(receipt.montant_total)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(receipt.date_generation).toLocaleDateString()} • {receipt.type_operation}
                          </p>
                        </div>
                        <Badge variant="outline">{receipt.type_operation}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">Aucun reçu généré pour cette propriété</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}