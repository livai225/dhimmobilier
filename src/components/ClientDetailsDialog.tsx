import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Eye, 
  Phone, 
  Mail, 
  MapPin, 
  AlertTriangle, 
  Home, 
  FileText, 
  CreditCard,
  Receipt,
  Download,
  Calendar,
  DollarSign
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Client {
  id: string;
  nom: string;
  prenom?: string;
  telephone_principal?: string;
  telephone_secondaire_1?: string;
  telephone_secondaire_2?: string;
  email?: string;
  adresse?: string;
  contact_urgence_nom?: string;
  contact_urgence_telephone?: string;
  contact_urgence_relation?: string;
  created_at: string;
  updated_at: string;
}

interface ClientDetailsDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDetailsDialog({ client, open, onOpenChange }: ClientDetailsDialogProps) {
  // Fetch locations
  const { data: locations = [] } = useQuery({
    queryKey: ['client-locations', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('locations')
        .select(`
          *,
          proprietes(nom, adresse, loyer_mensuel)
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id,
  });

  // Fetch souscriptions
  const { data: souscriptions = [] } = useQuery({
    queryKey: ['client-souscriptions', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('souscriptions')
        .select(`
          *,
          proprietes(nom, adresse)
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id,
  });

  // Fetch location payments
  const { data: locationPayments = [] } = useQuery({
    queryKey: ['client-location-payments', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('paiements_locations')
        .select(`
          *,
          locations!inner(
            proprietes(nom)
          )
        `)
        .eq('locations.client_id', client.id)
        .order('date_paiement', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id,
  });

  // Fetch subscription payments
  const { data: subscriptionPayments = [] } = useQuery({
    queryKey: ['client-subscription-payments', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('paiements_souscriptions')
        .select(`
          *,
          souscriptions!inner(
            proprietes(nom)
          )
        `)
        .eq('souscriptions.client_id', client.id)
        .order('date_paiement', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id,
  });

  // Fetch land rights payments with proper structure
  const { data: landRightsPayments = [] } = useQuery({
    queryKey: ['client-land-rights-payments', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      
      // Get payments with their related subscription data
      const { data, error } = await supabase
        .from('paiements_droit_terre')
        .select(`
          id,
          montant,
          date_paiement,
          mode_paiement,
          reference,
          souscription_id,
          created_at
        `)
        .order('date_paiement', { ascending: false });
      
      if (error) throw error;
      
      // Filter by client through souscriptions
      const { data: clientSouscriptions, error: souscriptionsError } = await supabase
        .from('souscriptions')
        .select('id, propriete_id, proprietes(nom)')
        .eq('client_id', client.id);
      
      if (souscriptionsError) throw souscriptionsError;
      
      const souscriptionIds = new Set(clientSouscriptions?.map(s => s.id) || []);
      
      // Create a map for property names
      const propertyMap = new Map(
        clientSouscriptions?.map(s => [s.id, s.proprietes?.nom]) || []
      );
      
      // Filter and enrich payments
      const filteredPayments = data?.filter(payment => 
        souscriptionIds.has(payment.souscription_id)
      ).map(payment => ({
        ...payment,
        propriete_nom: propertyMap.get(payment.souscription_id) || 'Propriété inconnue'
      })) || [];
      
      return filteredPayments;
    },
    enabled: !!client?.id,
  });

  // Fetch receipts
  const { data: receipts = [] } = useQuery({
    queryKey: ['client-receipts', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('recus')
        .select('*')
        .eq('client_id', client.id)
        .order('date_generation', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount).replace('XOF', 'FCFA');
  };

  const formatDate = (date: string) => {
    return format(new Date(date), 'dd/MM/yyyy', { locale: fr });
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'active': { label: 'Actif', variant: 'default' as const },
      'suspendu': { label: 'Suspendu', variant: 'secondary' as const },
      'termine': { label: 'Terminé', variant: 'outline' as const },
      'souscription': { label: 'Souscription', variant: 'default' as const },
      'droit_terre': { label: 'Droit de terre', variant: 'secondary' as const },
    };
    
    const config = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Détails du client - {client.nom} {client.prenom}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="info">Informations</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="souscriptions">Souscriptions</TabsTrigger>
            <TabsTrigger value="paiements">Paiements</TabsTrigger>
            <TabsTrigger value="droits-terre">Droits de Terre</TabsTrigger>
            <TabsTrigger value="recus">Reçus</TabsTrigger>
          </TabsList>

          {/* Client Information */}
          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Informations personnelles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold">Nom complet</h4>
                    <p>{client.nom} {client.prenom}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">Email</h4>
                    <p className="flex items-center gap-2">
                      {client.email ? (
                        <>
                          <Mail className="h-4 w-4" />
                          {client.email}
                        </>
                      ) : '-'}
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold mb-2">Numéros de téléphone</h4>
                  <div className="space-y-1">
                    {client.telephone_principal && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="text-sm">Principal: {client.telephone_principal}</span>
                      </div>
                    )}
                    {client.telephone_secondaire_1 && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="text-sm">Secondaire 1: {client.telephone_secondaire_1}</span>
                      </div>
                    )}
                    {client.telephone_secondaire_2 && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="text-sm">Secondaire 2: {client.telephone_secondaire_2}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {client.contact_urgence_nom && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Contact d'urgence
                      </h4>
                      <div className="space-y-1">
                        <p><strong>Nom:</strong> {client.contact_urgence_nom}</p>
                        <p><strong>Téléphone:</strong> {client.contact_urgence_telephone}</p>
                        <p><strong>Relation:</strong> {client.contact_urgence_relation}</p>
                      </div>
                    </div>
                  </>
                )}
                
                {client.adresse && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Adresse
                      </h4>
                      <p>{client.adresse}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Locations */}
          <TabsContent value="locations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Locations ({locations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {locations.length === 0 ? (
                  <div className="text-center py-8">
                    <Home className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold">Aucune location</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ce client n'a aucune location enregistrée.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Propriété</TableHead>
                        <TableHead>Loyer Mensuel</TableHead>
                        <TableHead>Dette</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date Début</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {locations.map((location) => (
                        <TableRow key={location.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{location.proprietes?.nom}</div>
                              <div className="text-sm text-muted-foreground">{location.proprietes?.adresse}</div>
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(location.loyer_mensuel || 0)}</TableCell>
                          <TableCell>
                            <span className={location.dette_totale > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                              {formatCurrency(location.dette_totale || 0)}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(location.statut)}</TableCell>
                          <TableCell>{formatDate(location.date_debut)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Souscriptions */}
          <TabsContent value="souscriptions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Souscriptions ({souscriptions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {souscriptions.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold">Aucune souscription</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ce client n'a aucune souscription enregistrée.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Propriété</TableHead>
                        <TableHead>Prix Total</TableHead>
                        <TableHead>Solde Restant</TableHead>
                        <TableHead>Phase</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date Début</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {souscriptions.map((subscription) => (
                        <TableRow key={subscription.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{subscription.proprietes?.nom}</div>
                              <div className="text-sm text-muted-foreground">{subscription.proprietes?.adresse}</div>
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(subscription.prix_total || 0)}</TableCell>
                          <TableCell>
                            <span className={subscription.solde_restant > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                              {formatCurrency(subscription.solde_restant || 0)}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(subscription.phase_actuelle)}</TableCell>
                          <TableCell>{getStatusBadge(subscription.statut)}</TableCell>
                          <TableCell>{formatDate(subscription.date_debut)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Paiements */}
          <TabsContent value="paiements">
            <div className="space-y-4">
              {/* Location Payments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Paiements de Loyer ({locationPayments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {locationPayments.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">Aucun paiement de loyer</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Propriété</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Référence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {locationPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{payment.locations?.proprietes?.nom}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(payment.montant)}</TableCell>
                            <TableCell>{payment.mode_paiement || '-'}</TableCell>
                            <TableCell>{formatDate(payment.date_paiement)}</TableCell>
                            <TableCell>{payment.reference || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Subscription Payments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Paiements de Souscription ({subscriptionPayments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subscriptionPayments.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">Aucun paiement de souscription</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Propriété</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Référence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subscriptionPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{payment.souscriptions?.proprietes?.nom}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(payment.montant)}</TableCell>
                            <TableCell>{payment.mode_paiement || '-'}</TableCell>
                            <TableCell>{formatDate(payment.date_paiement)}</TableCell>
                            <TableCell>{payment.reference || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Land Rights Payments */}
          <TabsContent value="droits-terre">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Paiements Droits de Terre ({landRightsPayments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {landRightsPayments.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold">Aucun paiement</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Aucun paiement de droit de terre enregistré.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Propriété</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Référence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {landRightsPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{payment.propriete_nom}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(payment.montant)}</TableCell>
                          <TableCell>{payment.mode_paiement || '-'}</TableCell>
                          <TableCell>{formatDate(payment.date_paiement)}</TableCell>
                          <TableCell>{payment.reference || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Receipts */}
          <TabsContent value="recus">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Reçus ({receipts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {receipts.length === 0 ? (
                  <div className="text-center py-8">
                    <Receipt className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold">Aucun reçu</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Aucun reçu généré pour ce client.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numéro</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Période</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipts.map((receipt) => (
                        <TableRow key={receipt.id}>
                          <TableCell className="font-medium">{receipt.numero}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {receipt.type_operation.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(receipt.montant_total)}</TableCell>
                          <TableCell>{formatDate(receipt.date_generation)}</TableCell>
                          <TableCell>
                            {receipt.periode_debut && receipt.periode_fin 
                              ? `${formatDate(receipt.periode_debut)} - ${formatDate(receipt.periode_fin)}`
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline">
                              <Download className="h-4 w-4 mr-2" />
                              Télécharger
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}