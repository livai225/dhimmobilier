import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

interface MissingPayment {
  locationId: string;
  clientName: string;
  montant: number;
  loyer: number;
}

interface RecoveryResult {
  success: number;
  errors: Array<{ locationId: string; error: string }>;
}

export const MissingReceiptsRecovery = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [missingPayments, setMissingPayments] = useState<MissingPayment[]>([]);
  const [recoveryResult, setRecoveryResult] = useState<RecoveryResult | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const analyzeMissingPayments = async () => {
    setIsAnalyzing(true);
    try {
      console.log("Analyse des paiements manquants...");
      
      // Récupérer les locations créées récemment sans paiements
      const { data: locationsData, error: locationsError } = await supabase
        .from('locations')
        .select(`
          id,
          loyer_mensuel,
          created_at,
          clients!inner(nom, prenom)
        `)
        .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()) // 6 heures
        .order('created_at', { ascending: false });

      if (locationsError) throw locationsError;

      console.log(`${locationsData?.length || 0} locations trouvées`);

      if (!locationsData?.length) {
        toast({
          title: "Aucune location récente",
          description: "Aucune location créée dans les 6 dernières heures",
        });
        return;
      }

      // Vérifier quelles locations n'ont pas de paiements
      const locationIds = locationsData.map(l => l.id);
      const { data: existingPayments, error: paymentsError } = await supabase
        .from('paiements_locations')
        .select('location_id')
        .in('location_id', locationIds);

      if (paymentsError) throw paymentsError;

      const paidLocationIds = new Set(existingPayments?.map(p => p.location_id) || []);
      
      const missing = locationsData
        .filter(location => !paidLocationIds.has(location.id))
        .map(location => ({
          locationId: location.id,
          clientName: `${location.clients.prenom || ''} ${location.clients.nom}`.trim(),
          montant: location.loyer_mensuel,
          loyer: location.loyer_mensuel
        }));

      console.log(`${missing.length} locations sans paiements détectées`);
      setMissingPayments(missing);

      toast({
        title: "Analyse terminée",
        description: `${missing.length} locations sans paiements détectées`,
      });

    } catch (error) {
      console.error('Erreur lors de l\'analyse:', error);
      toast({
        title: "Erreur d'analyse",
        description: "Impossible d'analyser les paiements manquants",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateMissingReceipts = async () => {
    if (!missingPayments.length) return;

    setIsRecovering(true);
    setProgress(0);
    
    const result: RecoveryResult = { success: 0, errors: [] };
    
    try {
      console.log(`Génération de ${missingPayments.length} paiements manquants...`);

      for (let i = 0; i < missingPayments.length; i++) {
        const payment = missingPayments[i];
        setProgress((i / missingPayments.length) * 100);

        try {
          console.log(`Génération paiement pour location ${payment.locationId} - ${payment.clientName}`);
          
          // Utiliser la fonction RPC pour créer le paiement avec la caisse
          const { data, error } = await supabase.rpc('pay_location_with_cash', {
            p_location_id: payment.locationId,
            p_montant: payment.montant,
            p_date_paiement: new Date().toISOString().split('T')[0],
            p_mode_paiement: 'Espèces',
            p_reference: `RECUP-AOUT-${Date.now()}`,
            p_description: 'Récupération paiement août - Import recouvrement'
          });

          if (error) {
            console.error(`Erreur RPC pour ${payment.locationId}:`, error);
            result.errors.push({
              locationId: payment.locationId,
              error: error.message
            });
          } else {
            console.log(`Paiement créé avec succès pour ${payment.clientName}`);
            result.success++;
          }

        } catch (error: any) {
          console.error(`Erreur génération pour ${payment.locationId}:`, error);
          result.errors.push({
            locationId: payment.locationId,
            error: error.message || 'Erreur inconnue'
          });
        }

        // Petite pause pour éviter la surcharge
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setProgress(100);
      setRecoveryResult(result);

      toast({
        title: "Récupération terminée",
        description: `${result.success} paiements générés, ${result.errors.length} erreurs`,
        variant: result.errors.length > 0 ? "destructive" : "default",
      });

      console.log('Résultat final:', result);

    } catch (error) {
      console.error('Erreur globale de récupération:', error);
      toast({
        title: "Erreur de récupération",
        description: "Erreur lors de la génération des paiements",
        variant: "destructive",
      });
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Récupération des Reçus Manquants
        </CardTitle>
        <CardDescription>
          Outil pour générer automatiquement les paiements et reçus manqués lors de l'import de recouvrement
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Étape 1: Analyse */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Étape 1: Analyser les paiements manquants</h3>
          <Button 
            onClick={analyzeMissingPayments} 
            disabled={isAnalyzing}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              "Analyser les locations sans paiements"
            )}
          </Button>
        </div>

        {/* Résultats de l'analyse */}
        {missingPayments.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{missingPayments.length} locations</strong> sans paiements détectées.
              Total à récupérer: <strong>{missingPayments.reduce((sum, p) => sum + p.montant, 0).toLocaleString()} FCFA</strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Liste des paiements manquants */}
        {missingPayments.length > 0 && (
          <div className="max-h-60 overflow-y-auto border rounded-lg p-4">
            <h4 className="font-medium mb-2">Paiements à générer:</h4>
            <div className="space-y-2">
              {missingPayments.slice(0, 10).map((payment, index) => (
                <div key={payment.locationId} className="flex justify-between text-sm">
                  <span>{payment.clientName}</span>
                  <span className="font-medium">{payment.montant.toLocaleString()} FCFA</span>
                </div>
              ))}
              {missingPayments.length > 10 && (
                <div className="text-sm text-muted-foreground">
                  ... et {missingPayments.length - 10} autres
                </div>
              )}
            </div>
          </div>
        )}

        {/* Étape 2: Récupération */}
        {missingPayments.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Étape 2: Générer les paiements et reçus</h3>
            
            {isRecovering && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-center text-muted-foreground">
                  Génération en cours... {Math.round(progress)}%
                </p>
              </div>
            )}

            <Button 
              onClick={generateMissingReceipts}
              disabled={isRecovering}
              variant="destructive"
              className="w-full"
            >
              {isRecovering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                `Générer les ${missingPayments.length} paiements manquants`
              )}
            </Button>
          </div>
        )}

        {/* Résultats de la récupération */}
        {recoveryResult && (
          <Alert className={recoveryResult.errors.length > 0 ? "border-destructive" : "border-success"}>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>Récupération terminée !</strong></p>
                <p>✅ {recoveryResult.success} paiements générés avec succès</p>
                {recoveryResult.errors.length > 0 && (
                  <p>❌ {recoveryResult.errors.length} erreurs</p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Détails des erreurs */}
        {recoveryResult?.errors.length > 0 && (
          <div className="max-h-40 overflow-y-auto border rounded-lg p-4 bg-destructive/5">
            <h4 className="font-medium mb-2 text-destructive">Erreurs détectées:</h4>
            <div className="space-y-1">
              {recoveryResult.errors.map((error, index) => (
                <div key={index} className="text-sm text-destructive">
                  Location {error.locationId.slice(0, 8)}...: {error.error}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};