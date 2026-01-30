import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/integrations/api/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, Loader2, Home, FileText, Calendar } from "lucide-react";

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

interface MissingDroitTerreForMonth {
  souscriptionId: string;
  clientName: string;
  propertyName: string;
  montantMensuel: number;
  moisCible: string;
  dateDebutDroitTerre: string;
  estDansLaPeriode: boolean;
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
  
  // États pour l'analyse par mois
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [missingDroitTerreForMonth, setMissingDroitTerreForMonth] = useState<MissingDroitTerreForMonth[]>([]);
  const [monthRecoveryResult, setMonthRecoveryResult] = useState<RecoveryResult | null>(null);
  
  const { toast } = useToast();

  const analyzeMissingPayments = async () => {
    setIsAnalyzing(true);
    try {
      console.log("Analyse des paiements de locations manquants...");

      // Récupérer les locations créées récemment sans paiements
      const locationsData = await apiClient.select({
        table: 'locations',
        columns: 'id, loyer_mensuel, created_at, clients!inner(nom, prenom)',
        filters: [
          { column: 'created_at', type: 'gte', value: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() }
        ],
        order: { column: 'created_at', ascending: false }
      });

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
      const existingPayments = await apiClient.select({
        table: 'paiements_locations',
        columns: 'location_id',
        filters: [{ column: 'location_id', type: 'in', value: locationIds }]
      });

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
      const souscriptionsData = await apiClient.select({
        table: 'souscriptions',
        columns: 'id, montant_droit_terre_mensuel, date_debut_droit_terre, created_at, clients!inner(nom, prenom), proprietes!inner(nom)',
        filters: [
          { column: 'phase_actuelle', type: 'eq', value: 'droit_terre' },
          { column: 'date_debut_droit_terre', type: 'not', value: null },
          { column: 'montant_droit_terre_mensuel', type: 'not', value: null },
          { column: 'montant_droit_terre_mensuel', type: 'gt', value: 0 }
        ]
      });

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
        let paiements: any[] = [];
        try {
          paiements = await apiClient.select({
            table: 'paiements_droit_terre',
            columns: 'montant',
            filters: [{ column: 'souscription_id', type: 'eq', value: souscription.id }]
          });
        } catch (paiementsError) {
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
          await apiClient.payLocationWithCash({
            locationId: payment.locationId,
            montant: payment.montant,
            datePaiement: new Date().toISOString().split('T')[0],
            modePaiement: 'Espèces',
            reference: `RECUP-AOUT-${Date.now()}`,
            description: 'Récupération paiement août - Import recouvrement'
          });

          console.log(`Paiement créé avec succès pour ${payment.clientName}`);
          result.success++;

        } catch (error: any) {
          console.error(`Erreur RPC pour ${payment.locationId}:`, error);
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
            try {
              await apiClient.payDroitTerreWithCash({
                souscriptionId: droitTerre.souscriptionId,
                montant: droitTerre.montantMensuel,
                datePaiement: new Date().toISOString().split('T')[0],
                modePaiement: 'Espèces',
                reference: `RECUP-DT-${Date.now()}-${j}`,
                description: `Récupération droit de terre mois ${j + 1} - Import recouvrement`
              });
              result.success++;
            } catch (error: any) {
              console.error(`Erreur RPC pour ${droitTerre.souscriptionId} mois ${j + 1}:`, error);
              result.errors.push({
                id: droitTerre.souscriptionId,
                error: `Mois ${j + 1}: ${error.message || 'Erreur inconnue'}`,
                clientName: droitTerre.clientName
              });
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

  // Analyser les droits de terre pour un mois spécifique
  const analyzeMissingDroitTerreForMonth = async () => {
    if (!selectedMonth) {
      toast({
        title: "Mois non sélectionné",
        description: "Veuillez sélectionner un mois avant d'analyser",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      console.log(`Analyse des droits de terre manquants pour ${selectedMonth}...`);

      // Récupérer toutes les souscriptions en phase droit_terre
      const souscriptionsData = await apiClient.select({
        table: 'souscriptions',
        columns: 'id, montant_droit_terre_mensuel, date_debut_droit_terre, clients!inner(nom, prenom), proprietes!inner(nom)',
        filters: [
          { column: 'phase_actuelle', type: 'eq', value: 'droit_terre' },
          { column: 'date_debut_droit_terre', type: 'not', value: null },
          { column: 'montant_droit_terre_mensuel', type: 'not', value: null },
          { column: 'montant_droit_terre_mensuel', type: 'gt', value: 0 }
        ]
      });

      if (!souscriptionsData?.length) {
        toast({
          title: "Aucune souscription en droit de terre",
          description: "Aucune souscription en phase droit de terre trouvée",
        });
        setMissingDroitTerreForMonth([]);
        return;
      }

      // Analyser chaque souscription pour le mois sélectionné
      const missing: MissingDroitTerreForMonth[] = [];
      const [year, month] = selectedMonth.split('-');
      const targetDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      
      for (const souscription of souscriptionsData) {
        const dateDebut = new Date(souscription.date_debut_droit_terre);
        
        // Vérifier si le mois sélectionné est dans la période active
        const estDansLaPeriode = targetDate >= dateDebut;
        
        if (!estDansLaPeriode) continue;

        // Vérifier s'il existe déjà un paiement pour ce mois
        const startOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endOfMonth = new Date(parseInt(year), parseInt(month), 0); // Dernier jour du mois

        console.log(`Période recherchée: ${startOfMonth.toISOString()} à ${endOfMonth.toISOString()}`);

        let paiements: any[] = [];
        try {
          paiements = await apiClient.select({
            table: 'paiements_droit_terre',
            columns: 'id',
            filters: [
              { column: 'souscription_id', type: 'eq', value: souscription.id },
              { column: 'date_paiement', type: 'gte', value: startOfMonth.toISOString().split('T')[0] },
              { column: 'date_paiement', type: 'lte', value: endOfMonth.toISOString().split('T')[0] }
            ]
          });
        } catch (paiementsError) {
          console.error(`Erreur paiements pour ${souscription.id}:`, paiementsError);
          continue;
        }

        // Si aucun paiement trouvé pour ce mois, l'ajouter aux manquants
        if (!paiements?.length) {
          missing.push({
            souscriptionId: souscription.id,
            clientName: `${souscription.clients.prenom || ''} ${souscription.clients.nom}`.trim(),
            propertyName: souscription.proprietes.nom,
            montantMensuel: souscription.montant_droit_terre_mensuel,
            moisCible: selectedMonth,
            dateDebutDroitTerre: souscription.date_debut_droit_terre,
            estDansLaPeriode: true
          });
        }
      }

      setMissingDroitTerreForMonth(missing);

      toast({
        title: "Analyse terminée",
        description: `${missing.length} souscriptions sans paiement pour ${getMonthName(selectedMonth)}`,
      });

    } catch (error) {
      console.error('Erreur lors de l\'analyse par mois:', error);
      toast({
        title: "Erreur d'analyse",
        description: "Impossible d'analyser les droits de terre pour ce mois",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Générer les paiements pour le mois sélectionné
  const generateMissingPaymentsForMonth = async () => {
    if (!missingDroitTerreForMonth.length) return;

    setIsRecovering(true);
    setDroitTerreProgress(0);
    
    const result: RecoveryResult = { success: 0, errors: [] };
    
    try {
      console.log(`Génération de paiements pour ${missingDroitTerreForMonth.length} souscriptions pour ${selectedMonth}...`);

      const [year, month] = selectedMonth.split('-');
      const paymentDate = new Date(parseInt(year), parseInt(month) - 1, 1);

      for (let i = 0; i < missingDroitTerreForMonth.length; i++) {
        const droitTerre = missingDroitTerreForMonth[i];
        setDroitTerreProgress(((i + 1) / missingDroitTerreForMonth.length) * 100);

        try {
          console.log(`Génération paiement pour ${droitTerre.clientName} - ${selectedMonth}`);

          await apiClient.payDroitTerreWithCash({
            souscriptionId: droitTerre.souscriptionId,
            montant: droitTerre.montantMensuel,
            datePaiement: paymentDate.toISOString().split('T')[0],
            modePaiement: 'Espèces',
            reference: `DT-${selectedMonth}-${Date.now()}`,
            description: `Paiement droit de terre ${getMonthName(selectedMonth)}`
          });

          result.success++;

        } catch (error: any) {
          console.error(`Erreur RPC pour ${droitTerre.souscriptionId}:`, error);
          result.errors.push({
            id: droitTerre.souscriptionId,
            error: error.message || 'Erreur inconnue',
            clientName: droitTerre.clientName
          });
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setDroitTerreProgress(100);
      setMonthRecoveryResult(result);

      toast({
        title: "Génération terminée",
        description: `${result.success} paiements générés pour ${getMonthName(selectedMonth)}, ${result.errors.length} erreurs`,
        variant: result.errors.length > 0 ? "destructive" : "default",
      });

    } catch (error) {
      console.error('Erreur globale de génération:', error);
      toast({
        title: "Erreur de génération",
        description: "Erreur lors de la génération des paiements",
        variant: "destructive",
      });
    } finally {
      setIsRecovering(false);
    }
  };

  // Utilitaire pour obtenir le nom du mois
  const getMonthName = (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  // Générer les options de mois (12 derniers mois)
  const generateMonthOptions = () => {
    const options = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      // Créer la date au premier jour du mois pour éviter les erreurs de date
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      console.log(`Option générée: ${value} - ${label}`);
      options.push({ value, label });
    }
    
    return options;
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
            {/* Analyse par mois spécifique */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Analyser les droits de terre par mois
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sélectionner le mois :</label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un mois..." />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMonthOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Button 
                    onClick={analyzeMissingDroitTerreForMonth} 
                    disabled={isAnalyzing || !selectedMonth}
                    className="w-full"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyse en cours...
                      </>
                    ) : (
                      "Analyser ce mois"
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Résultats analyse par mois */}
            {selectedMonth && missingDroitTerreForMonth.length > 0 && (
              <>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{missingDroitTerreForMonth.length} souscriptions</strong> sans paiement pour {getMonthName(selectedMonth)}.
                    Montant total: <strong>{missingDroitTerreForMonth.reduce((sum, p) => sum + p.montantMensuel, 0).toLocaleString()} FCFA</strong>
                  </AlertDescription>
                </Alert>

                <div className="max-h-60 overflow-y-auto border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Paiements à générer pour {getMonthName(selectedMonth)} :</h4>
                  <div className="space-y-2">
                    {missingDroitTerreForMonth.slice(0, 10).map((droitTerre, index) => (
                      <div key={droitTerre.souscriptionId} className="flex justify-between text-sm">
                        <div>
                          <span className="font-medium">{droitTerre.clientName}</span>
                          <div className="text-muted-foreground text-xs">{droitTerre.propertyName}</div>
                        </div>
                        <span className="font-medium">{droitTerre.montantMensuel.toLocaleString()} FCFA</span>
                      </div>
                    ))}
                    {missingDroitTerreForMonth.length > 10 && (
                      <div className="text-sm text-muted-foreground">
                        ... et {missingDroitTerreForMonth.length - 10} autres
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Confirmer et générer les paiements</h3>
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      Vous allez générer <strong>{missingDroitTerreForMonth.length} paiements</strong> pour le mois de <strong>{getMonthName(selectedMonth)}</strong>.
                      Montant total: <strong>{missingDroitTerreForMonth.reduce((sum, p) => sum + p.montantMensuel, 0).toLocaleString()} FCFA</strong>
                    </AlertDescription>
                  </Alert>
                  
                  {isRecovering && (
                    <div className="space-y-2">
                      <Progress value={droitTerreProgress} className="w-full" />
                      <p className="text-sm text-center text-muted-foreground">
                        Génération en cours... {Math.round(droitTerreProgress)}%
                      </p>
                    </div>
                  )}

                  <Button 
                    onClick={generateMissingPaymentsForMonth}
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
                      `Oui, générer les ${missingDroitTerreForMonth.length} paiements`
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Message si aucun paiement manquant */}
            {selectedMonth && missingDroitTerreForMonth.length === 0 && !isAnalyzing && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Aucun paiement manquant pour {getMonthName(selectedMonth)}. Tous les droits de terre sont à jour !
                </AlertDescription>
              </Alert>
            )}

            {/* Résultats génération par mois */}
            {monthRecoveryResult && (
              <>
                <Alert className={monthRecoveryResult.errors.length > 0 ? "border-destructive" : "border-green-500 bg-green-50"}>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p><strong>Génération terminée pour {getMonthName(selectedMonth)} !</strong></p>
                      <p>✅ {monthRecoveryResult.success} paiements générés avec succès</p>
                      {monthRecoveryResult.errors.length > 0 && (
                        <p>❌ {monthRecoveryResult.errors.length} erreurs</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>

                {monthRecoveryResult.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-4 bg-destructive/5">
                    <h4 className="font-medium mb-2 text-destructive">Erreurs détectées:</h4>
                    <div className="space-y-1">
                      {monthRecoveryResult.errors.map((error, index) => (
                        <div key={index} className="text-sm text-destructive">
                          {error.clientName} ({error.id.slice(0, 8)}...): {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Séparateur */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-muted-foreground">Analyse globale (ancienne méthode)</h3>
            </div>

            {/* Analyse Droits de Terre globale */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Analyser tous les droits de terre manquants</h3>
              <Button 
                onClick={analyzeMissingDroitTerre} 
                disabled={isAnalyzing}
                className="w-full"
                variant="outline"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyse en cours...
                  </>
                ) : (
                  "Analyser tous les droits de terre sans paiements"
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