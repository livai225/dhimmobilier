import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Combobox } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";
import { useAuditLog } from "@/hooks/useAuditLog";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  Calculator, 
  CreditCard, 
  Users, 
  DollarSign, 
  AlertCircle,
  CheckCircle,
  Loader2
} from "lucide-react";

interface ClientRecoveryStatus {
  client_id: string;
  client_nom: string;
  client_prenom: string;
  client_telephone?: string;
  contract_types: ('location' | 'souscription')[];
  montant_du_locations: number;
  montant_du_droits_terre: number;
  total_du: number;
  montant_paye_locations: number;
  montant_paye_droits_terre: number;
  total_paye: number;
  statut: 'paye' | 'partiel' | 'impaye';
  last_payment_date?: string;
  locations: Array<{ id: string; propriete_nom: string; loyer_mensuel: number }>;
  souscriptions: Array<{ id: string; propriete_nom: string; montant_mensuel: number }>;
}

interface GroupedPaymentDialogProps {
  agentId: string;
  selectedMonth: string;
  paymentType: 'location' | 'souscription' | 'droit_terre';
  clients: ClientRecoveryStatus[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SelectedClient {
  client_id: string;
  client_nom: string;
  client_prenom: string;
  montant_du: number;
  montant_paye: number;
  montant_restant: number;
  montant_saisi: number;
  contracts: Array<{
    id: string;
    type: 'location' | 'souscription';
    propriete_nom: string;
    montant: number;
  }>;
}

export function GroupedPaymentDialog({
  agentId,
  selectedMonth,
  paymentType,
  clients,
  isOpen,
  onClose,
  onSuccess
}: GroupedPaymentDialogProps) {
  const [selectedClients, setSelectedClients] = useState<SelectedClient[]>([]);
  const [datePaiement, setDatePaiement] = useState<string>(new Date().toISOString().split('T')[0]);
  const [periodePaiement, setPeriodePaiement] = useState<string>(selectedMonth);
  const [modePaiement, setModePaiement] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  
  const { toast } = useToast();
  const { logCreate } = useAuditLog();
  const queryClient = useQueryClient();

  // Filtrer les clients selon le type de paiement
  const filteredClients = clients.filter(client => {
    if (paymentType === 'location') {
      return client.contract_types.includes('location') && client.montant_du_locations > client.montant_paye_locations;
    } else if (paymentType === 'souscription') {
      return client.contract_types.includes('souscription') && client.montant_du_droits_terre > client.montant_paye_droits_terre;
    }
    return false;
  });

  // Réinitialiser la sélection quand le dialog s'ouvre
  useEffect(() => {
    if (isOpen) {
      setSelectedClients([]);
      setDatePaiement(new Date().toISOString().split('T')[0]);
      setPeriodePaiement(selectedMonth);
      setModePaiement("");
      setReference("");
    }
  }, [isOpen, paymentType, selectedMonth]);

  const handleClientToggle = (client: ClientRecoveryStatus, checked: boolean) => {
    if (checked) {
      const contracts = [];
      
      if (paymentType === 'location') {
        client.locations.forEach(loc => {
          contracts.push({
            id: loc.id,
            type: 'location' as const,
            propriete_nom: loc.propriete_nom,
            montant: loc.loyer_mensuel
          });
        });
      } else if (paymentType === 'souscription') {
        client.souscriptions.forEach(sub => {
          contracts.push({
            id: sub.id,
            type: 'souscription' as const,
            propriete_nom: sub.propriete_nom,
            montant: sub.montant_mensuel
          });
        });
      }

      const montantDu = paymentType === 'location' ? client.montant_du_locations : client.montant_du_droits_terre;
      const montantPaye = paymentType === 'location' ? client.montant_paye_locations : client.montant_paye_droits_terre;
      const montantRestant = montantDu - montantPaye;

      const newSelectedClient: SelectedClient = {
        client_id: client.client_id,
        client_nom: client.client_nom,
        client_prenom: client.client_prenom,
        montant_du: montantDu,
        montant_paye: montantPaye,
        montant_restant: montantRestant,
        montant_saisi: montantRestant, // Par défaut, payer le montant restant
        contracts
      };

      setSelectedClients(prev => [...prev, newSelectedClient]);
    } else {
      setSelectedClients(prev => prev.filter(c => c.client_id !== client.client_id));
    }
  };

  const handleAmountChange = (clientId: string, amount: number) => {
    setSelectedClients(prev => prev.map(client => 
      client.client_id === clientId 
        ? { ...client, montant_saisi: amount }
        : client
    ));
  };

  const isClientSelected = (clientId: string) => {
    return selectedClients.some(c => c.client_id === clientId);
  };

  const getSelectedClient = (clientId: string) => {
    return selectedClients.find(c => c.client_id === clientId);
  };

  const totalAmount = selectedClients.reduce((sum, client) => sum + client.montant_saisi, 0);
  const totalRestant = selectedClients.reduce((sum, client) => sum + client.montant_restant, 0);

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!modePaiement) {
        throw new Error("Veuillez sélectionner un mode de paiement");
      }

      if (selectedClients.length === 0) {
        throw new Error("Veuillez sélectionner au moins un client");
      }

      const results = {
        success: 0,
        errors: [] as string[]
      };

      setIsProcessing(true);

      for (let i = 0; i < selectedClients.length; i++) {
        const client = selectedClients[i];
        setProcessingStep(`Traitement de ${client.client_prenom} ${client.client_nom}...`);

        try {
          // Traiter chaque contrat du client
          for (const contract of client.contracts) {
            const description = `${paymentType === 'location' ? 'Loyer' : 'Droit de terre'} ${format(new Date(`${periodePaiement}-01`), 'MMMM yyyy', { locale: fr })} - ${contract.propriete_nom}`;
            
            if (contract.type === 'location') {
              // Vérifier s'il existe déjà un paiement pour ce mois
              const { data: existingPayment } = await supabase
                .from('paiements_locations')
                .select('id')
                .eq('location_id', contract.id)
                .eq('periode_paiement', `${periodePaiement}-01`)
                .maybeSingle();

              if (existingPayment) {
                results.errors.push(`${client.client_prenom} ${client.client_nom} (Location ${contract.propriete_nom}): Paiement déjà effectué pour ${format(new Date(`${periodePaiement}-01`), 'MMMM yyyy', { locale: fr })}`);
                continue;
              }

              await supabase.rpc("pay_location_with_cash", {
                p_location_id: contract.id,
                p_montant: contract.montant,
                p_date_paiement: datePaiement,
                p_mode_paiement: modePaiement,
                p_reference: reference || null,
                p_description: description,
                p_periode_paiement: `${periodePaiement}-01`
              });
            } else if (contract.type === 'souscription') {
              // Vérifier s'il existe déjà un paiement pour ce mois
              const { data: existingPayment } = await supabase
                .from('paiements_droit_terre')
                .select('id')
                .eq('souscription_id', contract.id)
                .eq('periode_paiement', `${periodePaiement}-01`)
                .maybeSingle();

              if (existingPayment) {
                results.errors.push(`${client.client_prenom} ${client.client_nom} (Droit de terre ${contract.propriete_nom}): Paiement déjà effectué pour ${format(new Date(`${periodePaiement}-01`), 'MMMM yyyy', { locale: fr })}`);
                continue;
              }

              await supabase.rpc("pay_droit_terre_with_cash", {
                p_souscription_id: contract.id,
                p_montant: contract.montant,
                p_date_paiement: datePaiement,
                p_mode_paiement: modePaiement,
                p_reference: reference || null,
                p_description: description,
                p_periode_paiement: `${periodePaiement}-01`
              });
            }
          }

          results.success++;
          
          // Log audit
          await logCreate(
            'paiements_groupes',
            client.client_id,
            {
              client_id: client.client_id,
              montant: client.montant_saisi,
              type: paymentType,
              mois: periodePaiement
            },
            `Paiement groupé ${paymentType} pour ${client.client_prenom} ${client.client_nom} - ${format(new Date(`${periodePaiement}-01`), 'MMMM yyyy', { locale: fr })}`
          );

        } catch (error) {
          console.error(`Erreur pour ${client.client_prenom} ${client.client_nom}:`, error);
          results.errors.push(`${client.client_prenom} ${client.client_nom}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setIsProcessing(false);
      setProcessingStep("");
      
      if (results.errors.length === 0) {
        toast({
          title: "Paiements groupés effectués",
          description: `${results.success} paiement(s) traité(s) avec succès`,
        });
        
        // Attendre que les transactions soient commitées puis invalider les caches
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['agent-clients-status', agentId, selectedMonth] });
          queryClient.invalidateQueries({ queryKey: ['agents-recovery'] });
          queryClient.invalidateQueries({ queryKey: ['agent-performance', agentId] });
          queryClient.invalidateQueries({ queryKey: ['agent-properties', agentId] });
          queryClient.invalidateQueries({ queryKey: ['agent-stats'] });
          queryClient.invalidateQueries({ queryKey: ['paiements_locations'] });
          queryClient.invalidateQueries({ queryKey: ['paiements_droit_terre'] });
          queryClient.invalidateQueries({ queryKey: ['paiements_souscriptions'] });
          queryClient.invalidateQueries({ queryKey: ['recus'] });
        }, 100);
        
        onSuccess();
        onClose();
      } else {
        toast({
          title: "Paiements partiellement effectués",
          description: `${results.success} succès, ${results.errors.length} erreur(s). ${results.errors.join(', ')}`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      setIsProcessing(false);
      setProcessingStep("");
      toast({
        title: "Erreur lors des paiements groupés",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    paymentMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Paiement groupé - {paymentType === 'location' ? 'Locations' : 'Droits de terre'}
          </DialogTitle>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Recouvrement du mois: {format(new Date(`${selectedMonth}-01`), 'MMMM yyyy', { locale: fr })}
            </p>
            <p className="text-sm font-semibold text-primary">
              Période de paiement: {format(new Date(`${periodePaiement}-01`), 'MMMM yyyy', { locale: fr })}
            </p>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations générales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-4 w-4" />
                Informations générales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="periode-paiement" className="text-primary font-semibold">
                    Période de paiement *
                  </Label>
                  <Input
                    id="periode-paiement"
                    type="month"
                    value={periodePaiement}
                    onChange={(e) => setPeriodePaiement(e.target.value)}
                    className="font-medium"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Mois pour lequel le paiement est effectué
                  </p>
                </div>
                <div>
                  <Label htmlFor="date-paiement">Date de paiement</Label>
                  <Input
                    id="date-paiement"
                    type="date"
                    value={datePaiement}
                    onChange={(e) => setDatePaiement(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="mode-paiement">Mode de paiement *</Label>
                  <Combobox
                    options={[
                      { value: "especes", label: "Espèces" },
                      { value: "virement", label: "Virement" },
                      { value: "cheque", label: "Chèque" },
                      { value: "mobile_money", label: "Mobile Money" }
                    ]}
                    value={modePaiement}
                    onChange={setModePaiement}
                    placeholder="Sélectionner un mode"
                  />
                </div>
                <div>
                  <Label htmlFor="reference">Référence</Label>
                  <Input
                    id="reference"
                    placeholder="Référence du paiement"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Résumé des montants */}
          {selectedClients.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Résumé des paiements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedClients.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Clients sélectionnés</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {totalAmount.toLocaleString()} FCFA
                    </div>
                    <div className="text-sm text-muted-foreground">Montant total à payer</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {totalRestant.toLocaleString()} FCFA
                    </div>
                    <div className="text-sm text-muted-foreground">Montant restant total</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Liste des clients */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-4 w-4" />
                Sélection des clients ({filteredClients.length} disponibles)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Sélection</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead className="text-right">Montant dû</TableHead>
                      <TableHead className="text-right">Montant payé</TableHead>
                      <TableHead className="text-right">Montant restant</TableHead>
                      <TableHead className="text-right">Montant à payer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => {
                      const isSelected = isClientSelected(client.client_id);
                      const selectedClient = getSelectedClient(client.client_id);
                      const montantDu = paymentType === 'location' ? client.montant_du_locations : client.montant_du_droits_terre;
                      const montantPaye = paymentType === 'location' ? client.montant_paye_locations : client.montant_paye_droits_terre;
                      const montantRestant = montantDu - montantPaye;

                      return (
                        <TableRow key={client.client_id}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleClientToggle(client, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div>
                              <div>{client.client_prenom} {client.client_nom}</div>
                              <div className="text-xs text-muted-foreground">
                                {paymentType === 'location' ? `${client.locations.length} location(s)` : `${client.souscriptions.length} souscription(s)`}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {client.client_telephone && (
                              <div className="text-sm">{client.client_telephone}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {montantDu.toLocaleString()} FCFA
                          </TableCell>
                          <TableCell className="text-right">
                            {montantPaye.toLocaleString()} FCFA
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {montantRestant.toLocaleString()} FCFA
                          </TableCell>
                          <TableCell className="text-right">
                            {isSelected && selectedClient ? (
                              <Input
                                type="number"
                                value={selectedClient.montant_saisi}
                                onChange={(e) => handleAmountChange(client.client_id, Number(e.target.value))}
                                className="w-24 text-right"
                                min="0"
                                max={montantRestant}
                              />
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {filteredClients.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucun client disponible pour ce type de paiement
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {isProcessing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {processingStep}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                Annuler
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={selectedClients.length === 0 || !modePaiement || isProcessing}
                className="flex items-center gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Effectuer les paiements ({selectedClients.length})
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
