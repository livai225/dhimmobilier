import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { apiClient } from '@/integrations/api/client';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface CancelImportPreview {
  total_refunded: number;
  payments_to_delete: number;
  receipts_to_delete: number;
  cash_transactions_to_delete: number;
  contracts_to_delete: number;
  properties_to_delete: number;
  clients_to_delete: number;
}

export function CancelRecouvrementImportDialog(): React.ReactElement {
  const queryClient = useQueryClient();
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [operationType, setOperationType] = useState<'loyer' | 'droit_terre'>('loyer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<CancelImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const data = await apiClient.select({
          table: 'agents_recouvrement',
          filters: [{ op: 'eq', column: 'statut', value: 'actif' }],
          orderBy: { column: 'nom', ascending: true }
        });
        setAgents(data || []);
      } catch (error) {
        console.error('Erreur chargement agents:', error);
        setAgents([]);
      }
    };

    loadAgents();
  }, []);

  const resetForm = () => {
    setSelectedAgent('');
    setSelectedMonth('');
    setSelectedYear('');
    setOperationType('loyer');
    setPreview(null);
    setPreviewError(null);
  };

  useEffect(() => {
    const hasRequiredFields = selectedAgent && selectedMonth !== '' && selectedYear !== '';
    if (!hasRequiredFields) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsPreviewLoading(true);
      setPreviewError(null);
      try {
        const data = await apiClient.previewCancelRecouvrementImport({
          agent_id: selectedAgent,
          month: parseInt(selectedMonth, 10),
          year: parseInt(selectedYear, 10),
          operation_type: operationType,
          month_base: "zero_indexed",
        });
        if (!isCancelled) {
          setPreview(data);
        }
      } catch (error) {
        if (!isCancelled) {
          setPreview(null);
          setPreviewError(error instanceof Error ? error.message : "Impossible d'analyser les données à supprimer");
        }
      } finally {
        if (!isCancelled) {
          setIsPreviewLoading(false);
        }
      }
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [selectedAgent, selectedMonth, selectedYear, operationType]);

  const handleCancelImport = async () => {
    if (!selectedAgent || selectedMonth === '' || selectedYear === '') {
      toast({
        title: 'Champs requis',
        description: "Veuillez sélectionner l'agent, le mois et l'année.",
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiClient.cancelRecouvrementImport({
        agent_id: selectedAgent,
        month: parseInt(selectedMonth, 10),
        year: parseInt(selectedYear, 10),
        operation_type: operationType,
        month_base: "zero_indexed",
      });

      toast({
        title: 'Annulation terminée',
        description: `${result.payments_deleted} paiements, ${result.receipts_deleted} reçus, ${result.contracts_deleted} contrats supprimés. Remboursé: ${result.total_refunded.toLocaleString()} FCFA.`,
      });

      queryClient.invalidateQueries({ queryKey: ['agents-recovery'] });
      queryClient.invalidateQueries({ queryKey: ['paiements_locations'] });
      queryClient.invalidateQueries({ queryKey: ['paiements_droit_terre'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['souscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['proprietes'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['cash_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recus'] });

      resetForm();
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : "Impossible d'annuler l'import",
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const monthLabels = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const selectedAgentData = agents.find((agent) => agent.id === selectedAgent);
  const selectedAgentName = selectedAgentData
    ? `${selectedAgentData.prenom || ''} ${selectedAgentData.nom || ''}`.trim()
    : 'Non sélectionné';
  const selectedMonthLabel = selectedMonth !== '' ? monthLabels[parseInt(selectedMonth, 10)] : 'Non sélectionné';
  const selectedOperationLabel = operationType === 'loyer' ? 'Loyer' : 'Droit de terre';
  const totalItemsToDelete = preview
    ? (
        preview.payments_to_delete +
        preview.receipts_to_delete +
        preview.cash_transactions_to_delete +
        preview.contracts_to_delete +
        preview.properties_to_delete +
        preview.clients_to_delete
      )
    : 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Trash2 className="w-4 h-4" />
          Annuler import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Annuler un import de recouvrement</DialogTitle>
          <DialogDescription>
            Cette action supprime uniquement les données importées pour la période sélectionnée.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Agent de recouvrement</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.prenom} {agent.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Type d'opération</Label>
            <Select value={operationType} onValueChange={(value: 'loyer' | 'droit_terre') => setOperationType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="loyer">Loyer</SelectItem>
                <SelectItem value="droit_terre">Droit de terre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Année</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Année" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Mois</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Mois" />
                </SelectTrigger>
                <SelectContent>
                  {monthLabels.map((month, idx) => (
                    <SelectItem key={month} value={idx.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Alert className="border-yellow-500 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Cette action est définitive. Seules les données importées pour la période choisie seront supprimées.
            </AlertDescription>
          </Alert>

          {(isPreviewLoading || preview || previewError) && (
            <Alert className="border-blue-300 bg-blue-50">
              <AlertDescription className="text-blue-900 space-y-1">
                {isPreviewLoading && <div>Analyse en cours des éléments à supprimer...</div>}
                {previewError && <div>{previewError}</div>}
                {preview && (
                  <>
                    <div className="font-semibold">Point avant suppression</div>
                    <div className="text-sm rounded-md border border-blue-200 bg-blue-100/40 px-3 py-2">
                      <span className="font-medium">Agent:</span> {selectedAgentName} |{" "}
                      <span className="font-medium">Mois:</span> {selectedMonthLabel} {selectedYear || ''} |{" "}
                      <span className="font-medium">Type:</span> {selectedOperationLabel}
                    </div>
                    <div className="rounded-md border border-blue-200 bg-white overflow-hidden">
                      <div className="grid grid-cols-2 text-sm">
                        <div className="px-3 py-2 border-b border-r border-blue-100 font-medium">Paiements</div>
                        <div className="px-3 py-2 border-b text-right tabular-nums">{preview.payments_to_delete}</div>

                        <div className="px-3 py-2 border-b border-r border-blue-100 font-medium">Reçus</div>
                        <div className="px-3 py-2 border-b text-right tabular-nums">{preview.receipts_to_delete}</div>

                        <div className="px-3 py-2 border-b border-r border-blue-100 font-medium">Écritures caisse</div>
                        <div className="px-3 py-2 border-b text-right tabular-nums">{preview.cash_transactions_to_delete}</div>

                        <div className="px-3 py-2 border-b border-r border-blue-100 font-medium">Contrats</div>
                        <div className="px-3 py-2 border-b text-right tabular-nums">{preview.contracts_to_delete}</div>

                        <div className="px-3 py-2 border-b border-r border-blue-100 font-medium">Propriétés</div>
                        <div className="px-3 py-2 border-b text-right tabular-nums">{preview.properties_to_delete}</div>

                        <div className="px-3 py-2 border-r border-blue-100 font-medium">Clients</div>
                        <div className="px-3 py-2 text-right tabular-nums">{preview.clients_to_delete}</div>
                      </div>
                    </div>
                    <div className="text-sm font-medium">
                      Total éléments supprimés:{" "}
                      <span className="tabular-nums">
                        {totalItemsToDelete.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm font-semibold">
                      Montant remboursé en caisse:{" "}
                      <span className="tabular-nums">{preview.total_refunded.toLocaleString()} FCFA</span>
                    </div>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={isSubmitting || isPreviewLoading || !preview || totalItemsToDelete === 0}
                className="w-full"
              >
                {isSubmitting ? 'Annulation en cours...' : "Confirmer l'annulation"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer l'annulation</AlertDialogTitle>
                <AlertDialogDescription>
                  Voulez-vous annuler cet import pour l'agent sélectionné et la période choisie ?
                  {preview ? ` ${totalItemsToDelete} élément(s) seront supprimés.` : ''}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancelImport} disabled={isSubmitting}>
                  Oui, supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
