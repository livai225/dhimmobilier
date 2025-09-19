import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Loader2, Home, FileText } from "lucide-react";

interface MissingPayment {
  locationId: string;
  clientName: string;
  montant: number;
  loyer: number;
}

interface MissingDroitTerre {
  souscriptionId: string;
  clientName: string;
  propertyName: string;
  montantMensuel: number;
  moisManquants: number;
  montantTotal: number;
  dateDebutDroitTerre: string;
}

interface RecoveryResult {
  success: number;
  errors: Array<{ id: string; error: string; clientName?: string }>;
}

export const MissingReceiptsRecovery = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [activeTab, setActiveTab] = useState("locations");
  
  // États pour les locations
  const [missingPayments, setMissingPayments] = useState<MissingPayment[]>([]);
  const [locationRecoveryResult, setLocationRecoveryResult] = useState<RecoveryResult | null>(null);
  const [locationProgress, setLocationProgress] = useState(0);
  
  // États pour les droits de terre
  const [missingDroitTerre, setMissingDroitTerre] = useState<MissingDroitTerre[]>([]);
  const [droitTerreRecoveryResult, setDroitTerreRecoveryResult] = useState<RecoveryResult | null>(null);
  const [droitTerreProgress, setDroitTerreProgress] = useState(0);
  
  const { toast } = useToast();

  const analyzeMissingPayments = async () => {
    setIsAnalyzing(true);
    try {
      console.log("Analyse des paiements de locations manquants...");
      
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
        title: "Analyse terminée (Locations)",
        description: `${missing.length} locations sans paiements détectées`,
      });

    } catch (error) {
      console.error('Erreur lors de l\'analyse des locations:', error);
      toast({
        title: "Erreur d'analyse",
        description: "Impossible d'analyser les paiements de locations manquants",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeMissingDroitTerre = async () => {
    setIsAnalyzing(true);
    try {
      console.log("Analyse des droits de terre manquants...");
      
      // Récupérer les souscriptions en phase droit_terre avec dates valides
      const { data: souscriptionsData, error: souscriptionsError } = await supabase
        .from('souscriptions')
        .select(`
          id,
          montant_droit_terre_mensuel,
          date_debut_droit_terre,
          created_at,
          clients!inner(nom, prenom),
          proprietes!inner(nom)
        `)
        .eq('phase_actuelle', 'droit_terre')
        .eq('type_souscription', 'mise_en_garde')
        .not('date_debut_droit_terre', 'is', null)
        .not('montant_droit_terre_mensuel', 'is', null)
        .gt('montant_droit_terre_mensuel', 0);

      if (souscriptionsError) throw souscriptionsError;

      console.log(`${souscriptionsData?.length || 0} souscriptions en droit de terre trouvées`);

      if (!souscriptionsData?.length) {
        toast({
          title: "Aucune souscription en droit de terre",
          description: "Aucune souscription en phase droit de terre trouvée",
        });
        setMissingDroitTerre([]);
        return;
      }

      // Analyser chaque souscription pour détecter les paiements manquants
      const missing: MissingDroitTerre[] = [];
      
      for (const souscription of souscriptionsData) {
        // Calculer les mois écoulés depuis le début des droits de terre
        const dateDebut = new Date(souscription.date_debut_droit_terre);
        const maintenant = new Date();
        const moisEcoules = Math.max(0, 
          (maintenant.getFullYear() - dateDebut.getFullYear()) * 12 + 
          (maintenant.getMonth() - dateDebut.getMonth())
        );

        if (moisEcoules === 0) continue; // Pas encore de paiement dû

        // Vérifier les paiements existants
        const { data: paiements, error: paiementsError } = await supabase
          .from('paiements_droit_terre')
          .select('montant')
          .eq('souscription_id', souscription.id);

        if (paiementsError) {
          console.error(`Erreur paiements pour ${souscription.id}:`, paiementsError);
          continue;
        }

        const nombrePaiements = paiements?.length || 0;
        const moisManquants = Math.max(0, moisEcoules - nombrePaiements);

        if (moisManquants > 0) {
          missing.push({
            souscriptionId: souscription.id,
            clientName: `${souscription.clients.prenom || ''} ${souscription.clients.nom}`.trim(),
            propertyName: souscription.proprietes.nom,
            montantMensuel: souscription.montant_droit_terre_mensuel,
            moisManquants,
            montantTotal: souscription.montant_droit_terre_mensuel * moisManquants,
            dateDebutDroitTerre: souscription.date_debut_droit_terre
          });
        }
      }

      console.log(`${missing.length} souscriptions avec droits de terre manquants détectées`);
      setMissingDroitTerre(missing);

      toast({
        title: "Analyse terminée (Droits de Terre)",
        description: `${missing.length} souscriptions avec paiements manquants détectées`,
      });

    } catch (error) {
      console.error('Erreur lors de l\'analyse des droits de terre:', error);
      toast({
        title: "Erreur d'analyse",
        description: "Impossible d'analyser les droits de terre manquants",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateMissingReceipts = async () => {
    if (!missingPayments.length) return;

    setIsRecovering(true);
    setLocationProgress(0);
    
    const result: RecoveryResult = { success: 0, errors: [] };
    
    try {
      console.log(`Génération de ${missingPayments.length} paiements de locations manquants...`);

      for (let i = 0; i < missingPayments.length; i++) {
        const payment = missingPayments[i];
        setLocationProgress((i / missingPayments.length) * 100);

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
              id: payment.locationId,
              error: error.message,
              clientName: payment.clientName
            });
          } else {
            console.log(`Paiement créé avec succès pour ${payment.clientName}`);
            result.success++;
          }

        } catch (error: any) {
          console.error(`Erreur génération pour ${payment.locationId}:`, error);
          result.errors.push({
            id: payment.locationId,
            error: error.message || 'Erreur inconnue',
            clientName: payment.clientName
          });
        }

        // Petite pause pour éviter la surcharge
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setLocationProgress(100);
      setLocationRecoveryResult(result);

      toast({
        title: "Récupération terminée (Locations)",
        description: `${result.success} paiements générés, ${result.errors.length} erreurs`,
        variant: result.errors.length > 0 ? "destructive" : "default",
      });

      console.log('Résultat final (locations):', result);

    } catch (error) {
      console.error('Erreur globale de récupération (locations):', error);
      toast({
        title: "Erreur de récupération",
        description: "Erreur lors de la génération des paiements de locations",
        variant: "destructive",
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const generateMissingDroitTerreReceipts = async () => {
    if (!missingDroitTerre.length) return;

    setIsRecovering(true);
    setDroitTerreProgress(0);
    
    const result: RecoveryResult = { success: 0, errors: [] };
    
    try {
      console.log(`Génération de paiements pour ${missingDroitTerre.length} souscriptions...`);

      for (let i = 0; i < missingDroitTerre.length; i++) {
        const droitTerre = missingDroitTerre[i];
        setDroitTerreProgress((i / missingDroitTerre.length) * 100);

        try {
          console.log(`Génération ${droitTerre.moisManquants} paiements pour ${droitTerre.clientName}`);
          
          // Générer un paiement pour chaque mois manquant
          for (let j = 0; j < droitTerre.moisManquants; j++) {
            const { data, error } = await supabase.rpc('pay_droit_terre_with_cash', {
              p_souscription_id: droitTerre.souscriptionId,
              p_montant: droitTerre.montantMensuel,
              p_date_paiement: new Date().toISOString().split('T')[0],
              p_mode_paiement: 'Espèces',
              p_reference: `RECUP-DT-${Date.now()}-${j}`,
              p_description: `Récupération droit de terre mois ${j + 1} - Import recouvrement`
            });

            if (error) {
              console.error(`Erreur RPC pour ${droitTerre.souscriptionId} mois ${j + 1}:`, error);
              result.errors.push({
                id: droitTerre.souscriptionId,
                error: `Mois ${j + 1}: ${error.message}`,
                clientName: droitTerre.clientName
              });
            } else {
              result.success++;
            }

            // Pause entre les paiements
            await new Promise(resolve => setTimeout(resolve, 200));
          }

        } catch (error: any) {
          console.error(`Erreur génération pour ${droitTerre.souscriptionId}:`, error);
          result.errors.push({
            id: droitTerre.souscriptionId,
            error: error.message || 'Erreur inconnue',
            clientName: droitTerre.clientName
          });
        }
      }

      setDroitTerreProgress(100);
      setDroitTerreRecoveryResult(result);

      toast({
        title: "Récupération terminée (Droits de Terre)",
        description: `${result.success} paiements générés, ${result.errors.length} erreurs`,
        variant: result.errors.length > 0 ? "destructive" : "default",
      });

      console.log('Résultat final (droits de terre):', result);

    } catch (error) {
      console.error('Erreur globale de récupération (droits de terre):', error);
      toast({
        title: "Erreur de récupération",
        description: "Erreur lors de la génération des paiements de droits de terre",
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
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="locations" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Locations
            </TabsTrigger>
            <TabsTrigger value="droitTerre" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Droits de Terre
            </TabsTrigger>
          </TabsList>

          <TabsContent value="locations" className="space-y-6 mt-6">
            {/* Analyse Locations */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Étape 1: Analyser les paiements de locations manquants</h3>
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

            {/* Résultats Locations */}
            {missingPayments.length > 0 && (
              <>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{missingPayments.length} locations</strong> sans paiements détectées.
                    Total à récupérer: <strong>{missingPayments.reduce((sum, p) => sum + p.montant, 0).toLocaleString()} FCFA</strong>
                  </AlertDescription>
                </Alert>

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

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Étape 2: Générer les paiements et reçus</h3>
                  
                  {isRecovering && (
                    <div className="space-y-2">
                      <Progress value={locationProgress} className="w-full" />
                      <p className="text-sm text-center text-muted-foreground">
                        Génération en cours... {Math.round(locationProgress)}%
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
              </>
            )}

            {/* Résultats récupération locations */}
            {locationRecoveryResult && (
              <>
                <Alert className={locationRecoveryResult.errors.length > 0 ? "border-destructive" : "border-success"}>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Récupération terminée !</strong></p>
                      <p>✅ {locationRecoveryResult.success} paiements générés avec succès</p>
                      {locationRecoveryResult.errors.length > 0 && (
                        <p>❌ {locationRecoveryResult.errors.length} erreurs</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>

                {locationRecoveryResult.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-4 bg-destructive/5">
                    <h4 className="font-medium mb-2 text-destructive">Erreurs détectées:</h4>
                    <div className="space-y-1">
                      {locationRecoveryResult.errors.map((error, index) => (
                        <div key={index} className="text-sm text-destructive">
                          {error.clientName} ({error.id.slice(0, 8)}...): {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="droitTerre" className="space-y-6 mt-6">
            {/* Analyse Droits de Terre */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Étape 1: Analyser les droits de terre manquants</h3>
              <Button 
                onClick={analyzeMissingDroitTerre} 
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyse en cours...
                  </>
                ) : (
                  "Analyser les droits de terre sans paiements"
                )}
              </Button>
            </div>

            {/* Résultats Droits de Terre */}
            {missingDroitTerre.length > 0 && (
              <>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{missingDroitTerre.length} souscriptions</strong> avec droits de terre manquants détectées.
                    Total à récupérer: <strong>{missingDroitTerre.reduce((sum, p) => sum + p.montantTotal, 0).toLocaleString()} FCFA</strong>
                  </AlertDescription>
                </Alert>

                <div className="max-h-60 overflow-y-auto border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Paiements à générer:</h4>
                  <div className="space-y-2">
                    {missingDroitTerre.slice(0, 10).map((droitTerre, index) => (
                      <div key={droitTerre.souscriptionId} className="text-sm border-b pb-2">
                        <div className="flex justify-between">
                          <span className="font-medium">{droitTerre.clientName}</span>
                          <span className="font-medium">{droitTerre.montantTotal.toLocaleString()} FCFA</span>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {droitTerre.propertyName} • {droitTerre.moisManquants} mois × {droitTerre.montantMensuel.toLocaleString()} FCFA
                        </div>
                      </div>
                    ))}
                    {missingDroitTerre.length > 10 && (
                      <div className="text-sm text-muted-foreground">
                        ... et {missingDroitTerre.length - 10} autres
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Étape 2: Générer les paiements et reçus</h3>
                  
                  {isRecovering && (
                    <div className="space-y-2">
                      <Progress value={droitTerreProgress} className="w-full" />
                      <p className="text-sm text-center text-muted-foreground">
                        Génération en cours... {Math.round(droitTerreProgress)}%
                      </p>
                    </div>
                  )}

                  <Button 
                    onClick={generateMissingDroitTerreReceipts}
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
                      `Générer les paiements pour ${missingDroitTerre.length} souscriptions`
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Résultats récupération droits de terre */}
            {droitTerreRecoveryResult && (
              <>
                <Alert className={droitTerreRecoveryResult.errors.length > 0 ? "border-destructive" : "border-success"}>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Récupération terminée !</strong></p>
                      <p>✅ {droitTerreRecoveryResult.success} paiements générés avec succès</p>
                      {droitTerreRecoveryResult.errors.length > 0 && (
                        <p>❌ {droitTerreRecoveryResult.errors.length} erreurs</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>

                {droitTerreRecoveryResult.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-4 bg-destructive/5">
                    <h4 className="font-medium mb-2 text-destructive">Erreurs détectées:</h4>
                    <div className="space-y-1">
                      {droitTerreRecoveryResult.errors.map((error, index) => (
                        <div key={index} className="text-sm text-destructive">
                          {error.clientName} ({error.id.slice(0, 8)}...): {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};