import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Settings, FileText } from "lucide-react";

interface ReconstructionResult {
  souscription_id: string;
  ancien_montant: number;
  nouveau_montant: number;
  date_debut_droit_terre: string;
  phase_mise_a_jour: string;
}

interface AugustPaymentResult {
  souscription_id: string;
  client_nom: string;
  montant_cree: number;
  date_paiement: string;
}

export function LandRightsReconstruction() {
  const [isReconstructing, setIsReconstructing] = useState(false);
  const [isCreatingPayments, setIsCreatingPayments] = useState(false);
  const [reconstructionResults, setReconstructionResults] = useState<ReconstructionResult[]>([]);
  const [paymentResults, setPaymentResults] = useState<AugustPaymentResult[]>([]);
  const [step, setStep] = useState<'ready' | 'config' | 'payments' | 'complete'>('ready');
  const { toast } = useToast();

  const handleReconstruction = async () => {
    setIsReconstructing(true);
    setStep('config');
    
    try {
      const { data, error } = await supabase.rpc('reconstruct_land_rights_config');
      
      if (error) throw error;
      
      setReconstructionResults(data || []);
      
      toast({
        title: "Configuration reconstituée",
        description: `${data?.length || 0} souscriptions mises à jour avec succès.`,
      });
      
      setStep('payments');
    } catch (error) {
      console.error('Erreur lors de la reconstruction:', error);
      toast({
        title: "Erreur",
        description: "Impossible de reconstituer la configuration des droits de terre.",
        variant: "destructive",
      });
      setStep('ready');
    } finally {
      setIsReconstructing(false);
    }
  };

  const handleCreateAugustPayments = async () => {
    setIsCreatingPayments(true);
    
    try {
      const { data, error } = await supabase.rpc('create_missing_august_payments');
      
      if (error) throw error;
      
      setPaymentResults(data || []);
      
      toast({
        title: "Paiements d'août créés",
        description: `${data?.length || 0} paiements manquants créés avec succès.`,
      });
      
      setStep('complete');
    } catch (error) {
      console.error('Erreur lors de la création des paiements:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer les paiements manquants d'août.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingPayments(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Reconstruction des Droits de Terre
        </CardTitle>
        <CardDescription>
          Reconstituer la configuration des droits de terre à partir des données d'import Excel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 'ready' && (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Cette opération va reconstituer automatiquement les montants mensuels et dates de début des droits de terre 
                pour toutes les souscriptions historiques, puis créer les paiements manquants d'août 2024.
              </AlertDescription>
            </Alert>
            
            <div className="flex flex-col gap-2">
              <h4 className="font-medium">Étapes de reconstruction :</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Configuration des montants mensuels selon le barème des droits de terre</li>
                <li>• Calcul des dates de début des droits de terre</li>
                <li>• Mise à jour de la phase des souscriptions historiques</li>
                <li>• Création des paiements manquants d'août 2024</li>
              </ul>
            </div>

            <Button 
              onClick={handleReconstruction} 
              disabled={isReconstructing}
              className="w-full"
            >
              {isReconstructing ? "Reconstruction en cours..." : "Commencer la reconstruction"}
            </Button>
          </div>
        )}

        {step === 'config' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Progress value={33} className="flex-1" />
              <Badge variant="secondary">1/3</Badge>
            </div>
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                Configuration des souscriptions en cours...
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === 'payments' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Progress value={66} className="flex-1" />
              <Badge variant="secondary">2/3</Badge>
            </div>
            
            {reconstructionResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Résultats de la configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {reconstructionResults.length} souscriptions configurées
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {reconstructionResults.slice(0, 5).map((result, index) => (
                        <div key={index} className="text-sm flex justify-between items-center">
                          <span>Souscription {result.souscription_id.slice(0, 8)}...</span>
                          <div className="flex items-center gap-2">
                            <span>{formatCurrency(result.nouveau_montant)}/mois</span>
                            <Badge variant="outline">{result.phase_mise_a_jour}</Badge>
                          </div>
                        </div>
                      ))}
                      {reconstructionResults.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          ... et {reconstructionResults.length - 5} autres
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button 
              onClick={handleCreateAugustPayments} 
              disabled={isCreatingPayments}
              className="w-full"
            >
              {isCreatingPayments ? "Création des paiements..." : "Créer les paiements d'août"}
            </Button>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Progress value={100} className="flex-1" />
              <Badge variant="default">Terminé</Badge>
            </div>
            
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Reconstruction terminée avec succès ! Les droits de terre sont maintenant correctement configurés.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Souscriptions configurées
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{reconstructionResults.length}</p>
                  <p className="text-sm text-muted-foreground">
                    Montants et dates configurés
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Paiements créés
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{paymentResults.length}</p>
                  <p className="text-sm text-muted-foreground">
                    Paiements d'août 2024
                  </p>
                </CardContent>
              </Card>
            </div>

            {paymentResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Paiements créés</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {paymentResults.slice(0, 5).map((payment, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span>{payment.client_nom}</span>
                        <span className="font-medium">{formatCurrency(payment.montant_cree)}</span>
                      </div>
                    ))}
                    {paymentResults.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        ... et {paymentResults.length - 5} autres
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Alert>
              <AlertDescription>
                Vous pouvez maintenant utiliser l'analyse des droits de terre pour détecter les paiements manquants.
                Les données sont correctement configurées dans la base de données.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}