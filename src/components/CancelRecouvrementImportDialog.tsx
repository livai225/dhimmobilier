import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { apiClient } from '@/integrations/api/client';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, Trash2 } from 'lucide-react';

export function CancelRecouvrementImportDialog(): React.ReactElement {
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [operationType, setOperationType] = useState<'loyer' | 'droit_terre'>('loyer');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  };

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
      });

      toast({
        title: 'Annulation terminée',
        description: `${result.payments_deleted} paiements, ${result.receipts_deleted} reçus, ${result.contracts_deleted} contrats supprimés. Remboursé: ${result.total_refunded.toLocaleString()} FCFA.`,
      });

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

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Annulation en cours...' : "Confirmer l'annulation"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer l'annulation</AlertDialogTitle>
                <AlertDialogDescription>
                  Voulez-vous annuler cet import pour l'agent sélectionné et la période choisie ?
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
