import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Building, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  Star,
  FileText,
  CreditCard,
  TrendingUp,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface FournisseurDetailsDialogProps {
  fournisseur: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FournisseurDetailsDialog({ 
  fournisseur, 
  open, 
  onOpenChange 
}: FournisseurDetailsDialogProps) {
  // Fetch supplier invoices
  const { data: factures = [] } = useQuery({
    queryKey: ["fournisseur-factures", fournisseur?.id],
    queryFn: async () => {
      const data = await apiClient.select<any[]>({
        table: "factures_fournisseurs",
        filters: [{ op: "eq", column: "fournisseur_id", value: fournisseur.id }],
        orderBy: { column: "date_facture", ascending: false }
      });
      return data || [];
    },
    enabled: !!fournisseur?.id,
  });

  // Fetch supplier payments
  const { data: paiements = [] } = useQuery({
    queryKey: ["fournisseur-paiements", fournisseur?.id],
    queryFn: async () => {
      // First get all factures for this fournisseur
      const facturesIds = factures.map(f => f.id);
      if (facturesIds.length === 0) return [];

      const data = await apiClient.select<any[]>({
        table: "paiements_factures",
        orderBy: { column: "date_paiement", ascending: false }
      });

      // Filter payments for this fournisseur's factures
      return (data || []).filter(p => facturesIds.includes(p.facture_id));
    },
    enabled: !!fournisseur?.id && factures.length > 0,
  });

  // Calculate statistics
  const stats = {
    totalFacture: factures.reduce((sum, f) => sum + Number(f.montant_total), 0),
    totalPaye: factures.reduce((sum, f) => sum + Number(f.montant_paye), 0),
    enAttente: factures.reduce((sum, f) => sum + Number(f.solde), 0),
    nombreFactures: factures.length,
    nombrePaiements: paiements.length,
  };

  const getFactureStatus = (facture: any) => {
    if (facture.montant_paye >= facture.montant_total) return "Payée";
    if (facture.montant_paye > 0) return "Partielle";
    return "Impayée";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Payée": return "default";
      case "Partielle": return "secondary";
      case "Impayée": return "destructive";
      default: return "secondary";
    }
  };

  const getPerformanceColor = (note: number) => {
    if (note >= 4) return "default";
    if (note >= 3) return "secondary";
    return "destructive";
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
  };

  if (!fournisseur) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Détails du fournisseur : {fournisseur.nom}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">Informations</TabsTrigger>
            <TabsTrigger value="factures">Factures ({factures.length})</TabsTrigger>
            <TabsTrigger value="paiements">Paiements ({paiements.length})</TabsTrigger>
            <TabsTrigger value="stats">Statistiques</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Informations générales
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Nom:</span>
                    <span>{fournisseur.nom}</span>
                  </div>
                  
                  {fournisseur.contact && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Contact:</span>
                      <span>{fournisseur.contact}</span>
                    </div>
                  )}
                  
                  {fournisseur.telephone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Téléphone:</span>
                      <span>{fournisseur.telephone}</span>
                    </div>
                  )}
                  
                  {fournisseur.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Email:</span>
                      <a href={`mailto:${fournisseur.email}`} className="text-primary hover:underline">
                        {fournisseur.email}
                      </a>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  {fournisseur.secteur && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Secteur:</span>
                      <Badge variant="outline">{fournisseur.secteur.nom}</Badge>
                    </div>
                  )}
                  
                  {fournisseur.note_performance && (
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Performance:</span>
                      <Badge variant={getPerformanceColor(fournisseur.note_performance)}>
                        {fournisseur.note_performance}/5
                      </Badge>
                    </div>
                  )}
                  
                  {fournisseur.adresse && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Adresse:</span>
                      <span>{fournisseur.adresse}</span>
                    </div>
                  )}
                  
                  {fournisseur.site_web && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Site web:</span>
                      <a href={fournisseur.site_web} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {fournisseur.site_web}
                      </a>
                    </div>
                  )}
                  
                  {fournisseur.numero_tva && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">N° TVA:</span>
                      <span>{fournisseur.numero_tva}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="factures" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Factures du fournisseur
                </CardTitle>
                <CardDescription>
                  Liste de toutes les factures émises par ce fournisseur
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Facture</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Propriété</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Payé</TableHead>
                      <TableHead>Solde</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {factures.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Aucune facture trouvée
                        </TableCell>
                      </TableRow>
                    ) : (
                      factures.map((facture) => (
                        <TableRow key={facture.id}>
                          <TableCell className="font-medium">{facture.numero}</TableCell>
                          <TableCell>
                            {format(new Date(facture.date_facture), "dd/MM/yyyy", { locale: fr })}
                          </TableCell>
                          <TableCell>{facture.propriete?.nom || "-"}</TableCell>
                          <TableCell>{formatAmount(facture.montant_total)}</TableCell>
                          <TableCell>{formatAmount(facture.montant_paye)}</TableCell>
                          <TableCell>{formatAmount(facture.solde)}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusColor(getFactureStatus(facture))}>
                              {getFactureStatus(facture)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paiements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Historique des paiements
                </CardTitle>
                <CardDescription>
                  Tous les paiements reçus de ce fournisseur
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Facture</TableHead>
                      <TableHead>Propriété</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Référence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paiements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Aucun paiement trouvé
                        </TableCell>
                      </TableRow>
                    ) : (
                      paiements.map((paiement) => (
                        <TableRow key={paiement.id}>
                          <TableCell>
                            {format(new Date(paiement.date_paiement), "dd/MM/yyyy", { locale: fr })}
                          </TableCell>
                          <TableCell className="font-medium">{paiement.facture?.numero}</TableCell>
                          <TableCell>{paiement.facture?.propriete?.nom || "-"}</TableCell>
                          <TableCell>{formatAmount(paiement.montant)}</TableCell>
                          <TableCell>
                            {paiement.mode_paiement && (
                              <Badge variant="outline">{paiement.mode_paiement}</Badge>
                            )}
                          </TableCell>
                          <TableCell>{paiement.reference || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Facturé</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatAmount(stats.totalFacture)}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.nombreFactures} facture(s)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Payé</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatAmount(stats.totalPaye)}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.nombrePaiements} paiement(s)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">En Attente</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatAmount(stats.enAttente)}</div>
                  <p className="text-xs text-muted-foreground">
                    Montant restant dû
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Résumé de l'activité
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium">Taux de paiement:</span>
                    <div className="text-lg font-bold">
                      {stats.totalFacture > 0 
                        ? Math.round((stats.totalPaye / stats.totalFacture) * 100) 
                        : 0}%
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Montant moyen par facture:</span>
                    <div className="text-lg font-bold">
                      {formatAmount(stats.nombreFactures > 0 ? stats.totalFacture / stats.nombreFactures : 0)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}