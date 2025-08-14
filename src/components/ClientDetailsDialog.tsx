import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { User, Building, CreditCard, Receipt, Calendar, Eye, MapPin, Phone, Mail } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  useClientSubscriptions,
  useClientLocations,
  useClientPayments,
  useClientReceipts,
  useClientStats
} from "@/hooks/useClientDetails";

interface ClientDetailsDialogProps {
  client: any;
  isOpen: boolean;
  onClose: () => void;
  onViewSubscription?: (subscription: any) => void;
  onViewLocation?: (location: any) => void;
}

export default function ClientDetailsDialog({
  client,
  isOpen,
  onClose,
  onViewSubscription,
  onViewLocation
}: ClientDetailsDialogProps) {
  const { data: subscriptions, isLoading: loadingSubscriptions } = useClientSubscriptions(client?.id);
  const { data: locations, isLoading: loadingLocations } = useClientLocations(client?.id);
  const { data: payments, isLoading: loadingPayments } = useClientPayments(client?.id);
  const { data: receipts, isLoading: loadingReceipts } = useClientReceipts(client?.id);
  const { data: stats, isLoading: loadingStats } = useClientStats(client?.id);

  if (!client) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "Non renseigné";
    return phone.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case "souscription": return "Souscription";
      case "location": return "Location";
      case "droit_terre": return "Droit de terre";
      default: return type;
    }
  };

  const getStatutBadge = (statut: string) => {
    const variants = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-red-100 text-red-800",
      en_cours: "bg-blue-100 text-blue-800",
      termine: "bg-gray-100 text-gray-800"
    };
    return variants[statut as keyof typeof variants] || "bg-gray-100 text-gray-800";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Fiche détaillée - {client.prenom} {client.nom}
          </DialogTitle>
        </DialogHeader>

        {/* Statistics Overview */}
        {!loadingStats && stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Souscriptions</p>
                    <p className="text-2xl font-bold">{stats.subscriptionsCount}</p>
                  </div>
                  <Building className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Locations actives</p>
                    <p className="text-2xl font-bold">{stats.locationsCount}</p>
                  </div>
                  <MapPin className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total payé</p>
                    <p className="text-2xl font-bold">{formatCurrency(stats.totalPaid)}</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Dernière activité</p>
                    <p className="text-sm font-medium">
                      {stats.lastActivity 
                        ? format(new Date(stats.lastActivity), "dd/MM/yyyy", { locale: fr })
                        : "Aucune"
                      }
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="informations" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="informations">Informations</TabsTrigger>
            <TabsTrigger value="souscriptions">Souscriptions</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="recus">Reçus</TabsTrigger>
          </TabsList>

          <TabsContent value="informations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Informations personnelles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nom complet</label>
                    <p className="text-lg font-semibold">{client.prenom} {client.nom}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {client.email || "Non renseigné"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Téléphone principal</label>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {formatPhone(client.telephone_principal)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Téléphone secondaire 1</label>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {formatPhone(client.telephone_secondaire_1)}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Adresse</label>
                    <p>{client.adresse || "Non renseignée"}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-3">Contact d'urgence</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Nom</label>
                      <p>{client.contact_urgence_nom || "Non renseigné"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Relation</label>
                      <p>{client.contact_urgence_relation || "Non renseignée"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Téléphone</label>
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {formatPhone(client.contact_urgence_telephone)}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Client créé le: {format(new Date(client.created_at), "dd/MM/yyyy à HH:mm", { locale: fr })}</span>
                  <span>Dernière modification: {format(new Date(client.updated_at), "dd/MM/yyyy à HH:mm", { locale: fr })}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="souscriptions" className="space-y-4">
            {loadingSubscriptions ? (
              <p>Chargement des souscriptions...</p>
            ) : subscriptions?.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">Aucune souscription trouvée pour ce client.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {subscriptions?.map((subscription) => (
                  <Card key={subscription.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{subscription.proprietes?.nom}</h4>
                            <Badge className={getStatutBadge(subscription.statut)}>
                              {subscription.statut}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{subscription.proprietes?.adresse}</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Type:</span>
                              <p className="font-medium">{subscription.type_souscription}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Prix total:</span>
                              <p className="font-medium">{formatCurrency(subscription.prix_total)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Solde restant:</span>
                              <p className="font-medium">{formatCurrency(subscription.solde_restant)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Phase:</span>
                              <p className="font-medium">{subscription.phase_actuelle}</p>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewSubscription?.(subscription)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Voir détails
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="locations" className="space-y-4">
            {loadingLocations ? (
              <p>Chargement des locations...</p>
            ) : locations?.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">Aucune location trouvée pour ce client.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {locations?.map((location) => (
                  <Card key={location.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{location.proprietes?.nom}</h4>
                            <Badge className={getStatutBadge(location.statut)}>
                              {location.statut}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{location.proprietes?.adresse}</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Loyer mensuel:</span>
                              <p className="font-medium">{formatCurrency(location.loyer_mensuel)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Dette totale:</span>
                              <p className="font-medium">{formatCurrency(location.dette_totale)}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Début:</span>
                              <p className="font-medium">{format(new Date(location.date_debut), "dd/MM/yyyy", { locale: fr })}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Fin:</span>
                              <p className="font-medium">
                                {location.date_fin ? format(new Date(location.date_fin), "dd/MM/yyyy", { locale: fr }) : "En cours"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewLocation?.(location)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Voir détails
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>


          <TabsContent value="recus" className="space-y-4">
            {loadingReceipts ? (
              <p>Chargement des reçus...</p>
            ) : receipts?.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">Aucun reçu trouvé pour ce client.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {receipts?.map((receipt) => (
                  <Card key={receipt.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Reçu N° {receipt.numero}</span>
                            <Badge variant="outline">{receipt.type_operation}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span>Montant: {formatCurrency(receipt.montant_total)}</span>
                            <span className="ml-4">Généré le: {format(new Date(receipt.date_generation), "dd/MM/yyyy", { locale: fr })}</span>
                          </div>
                          {receipt.periode_debut && receipt.periode_fin && (
                            <div className="text-sm text-muted-foreground">
                              Période: {format(new Date(receipt.periode_debut), "dd/MM/yyyy", { locale: fr })} au {format(new Date(receipt.periode_fin), "dd/MM/yyyy", { locale: fr })}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Receipt className="h-4 w-4 mr-2" />
                            Voir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}