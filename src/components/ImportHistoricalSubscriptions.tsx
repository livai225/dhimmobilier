import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Users, Building, Receipt, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

// Structure des données Excel pour les souscriptions historiques
interface ExcelRowData {
  dateVersement: string;
  clientName: string;
  site: string;
  prixAcquisition: number;
  soldeAnterieur: number;
  montantVerse: number;
  resteAPayer: number;
  rowIndex: number;
}

// Structure du résultat d'import
interface ImportResult {
  clientsCreated: number;
  clientsMatched: number;
  propertiesCreated: number;
  propertiesMatched: number;
  souscriptionsCreated: number;
  paymentsCreated: number;
  receiptsGenerated: number;
  totalAmount: number;
  errors: string[];
}

export function ImportHistoricalSubscriptions() {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ExcelRowData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [simulationMode, setSimulationMode] = useState(true);
  const [clearExistingClients, setClearExistingClients] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  // Normaliser les chaînes pour comparaison (supprime accents, espaces, casse)
  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  // Distance de Levenshtein pour matching approximatif
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };

  // Trouver le meilleur client correspondant
  const findBestClientMatch = (excelName: string, existingClients: any[]): any | null => {
    if (!excelName || existingClients.length === 0) return null;

    const normalized = normalizeString(excelName);
    let bestMatch = null;
    let bestScore = Infinity;

    for (const client of existingClients) {
      const clientFullName = `${client.prenom || ''} ${client.nom}`.trim();
      const clientNormalized = normalizeString(clientFullName);
      
      // Vérification exacte
      if (clientNormalized === normalized) {
        return client;
      }

      // Matching approximatif
      const distance = levenshteinDistance(normalized, clientNormalized);
      const maxLength = Math.max(normalized.length, clientNormalized.length);
      const similarity = 1 - (distance / maxLength);

      if (similarity > 0.8 && distance < bestScore) {
        bestMatch = client;
        bestScore = distance;
      }
    }

    return bestScore < 3 ? bestMatch : null;
  };

  // Parser le fichier Excel
  const parseExcelFile = async (file: File): Promise<ExcelRowData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          // Détection automatique des colonnes
          const headerRow = jsonData[0] as string[];
          const columnMapping = {
            dateVersement: -1,
            clientName: -1,
            site: -1,
            prixAcquisition: -1,
            soldeAnterieur: -1,
            montantVerse: -1,
            resteAPayer: -1,
          };

          // Mapping des colonnes basé sur des mots-clés
          headerRow.forEach((header, index) => {
            const normalized = normalizeString(header || '');
            
            if (normalized.includes('date') && normalized.includes('versement')) {
              columnMapping.dateVersement = index;
            } else if (normalized.includes('client')) {
              columnMapping.clientName = index;
            } else if (normalized.includes('site') || normalized.includes('propriete') || normalized.includes('lieu')) {
              columnMapping.site = index;
            } else if (normalized.includes('prix') && normalized.includes('acquisition')) {
              columnMapping.prixAcquisition = index;
            } else if (normalized.includes('solde') && normalized.includes('anterieur')) {
              columnMapping.soldeAnterieur = index;
            } else if (normalized.includes('montant') && normalized.includes('verse')) {
              columnMapping.montantVerse = index;
            } else if (normalized.includes('reste') && normalized.includes('payer')) {
              columnMapping.resteAPayer = index;
            }
          });

          // Validation des colonnes trouvées
          const missingColumns = Object.entries(columnMapping)
            .filter(([_, index]) => index === -1)
            .map(([key, _]) => key);

          if (missingColumns.length > 0) {
            throw new Error(`Colonnes manquantes: ${missingColumns.join(', ')}`);
          }

          const parsedData: ExcelRowData[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;

            try {
              const rowData: ExcelRowData = {
                dateVersement: row[columnMapping.dateVersement]?.toString() || '',
                clientName: row[columnMapping.clientName]?.toString().trim() || '',
                site: row[columnMapping.site]?.toString().trim() || '',
                prixAcquisition: parseFloat(row[columnMapping.prixAcquisition]) || 0,
                soldeAnterieur: parseFloat(row[columnMapping.soldeAnterieur]) || 0,
                montantVerse: parseFloat(row[columnMapping.montantVerse]) || 0,
                resteAPayer: parseFloat(row[columnMapping.resteAPayer]) || 0,
                rowIndex: i + 1,
              };

              if (rowData.clientName && rowData.site && rowData.prixAcquisition > 0) {
                parsedData.push(rowData);
              }
            } catch (error) {
              console.warn(`Erreur ligne ${i + 1}:`, error);
            }
          }

          resolve(parsedData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Gérer la sélection de fichier
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast({
        title: "Format de fichier incorrect",
        description: "Veuillez sélectionner un fichier Excel (.xlsx ou .xls)",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setImportResult(null);
    
    try {
      setIsProcessing(true);
      const data = await parseExcelFile(selectedFile);
      setPreviewData(data);
      
      toast({
        title: "Fichier analysé avec succès",
        description: `${data.length} souscriptions historiques détectées`,
      });
    } catch (error) {
      console.error('Erreur parsing Excel:', error);
      toast({
        title: "Erreur d'analyse",
        description: error instanceof Error ? error.message : "Impossible d'analyser le fichier",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Logique d'import principal
  const importHistoricalData = async (simulate: boolean = true) => {
    if (previewData.length === 0) return;
    
    setIsProcessing(true);
    setImportProgress(0);
    
    const result: ImportResult = {
      clientsCreated: 0,
      clientsMatched: 0,
      propertiesCreated: 0,
      propertiesMatched: 0,
      souscriptionsCreated: 0,
      paymentsCreated: 0,
      receiptsGenerated: 0,
      totalAmount: 0,
      errors: [],
    };

    try {
      // Optionnel: Supprimer les clients existants
      if (clearExistingClients && !simulate) {
        await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }

      // Récupérer les clients et propriétés existants
      const { data: existingClients } = await supabase
        .from('clients')
        .select('id, nom, prenom, telephone_principal');

      const { data: existingProperties } = await supabase
        .from('proprietes')
        .select('id, nom, adresse');

      const clientsData = existingClients || [];
      const propertiesData = existingProperties || [];

      // Traiter chaque ligne
      for (let i = 0; i < previewData.length; i++) {
        const row = previewData[i];
        setImportProgress((i / previewData.length) * 100);

        try {
          // 1. Matching/Création du client
          let clientId = null;
          const matchedClient = findBestClientMatch(row.clientName, clientsData);
          
          if (matchedClient) {
            clientId = matchedClient.id;
            result.clientsMatched++;
          } else {
            // Créer nouveau client
            const nameParts = row.clientName.split(' ');
            const nom = nameParts.pop() || row.clientName;
            const prenom = nameParts.join(' ') || '';

            if (!simulate) {
              const { data: newClient, error } = await supabase
                .from('clients')
                .insert({
                  nom: nom,
                  prenom: prenom,
                })
                .select('id')
                .single();

              if (error) throw error;
              clientId = newClient.id;
              clientsData.push({ id: clientId, nom, prenom, telephone_principal: null });
            }
            result.clientsCreated++;
          }

          // 2. Matching/Création de la propriété
          let proprieteId = null;
          const matchedProperty = propertiesData.find(p => 
            normalizeString(p.nom) === normalizeString(row.site) ||
            normalizeString(p.adresse || '') === normalizeString(row.site)
          );

          if (matchedProperty) {
            proprieteId = matchedProperty.id;
            result.propertiesMatched++;
          } else {
            // Créer nouvelle propriété
            if (!simulate && clientId) {
              const { data: newProperty, error } = await supabase
                .from('proprietes')
                .insert({
                  nom: row.site,
                  adresse: row.site,
                  usage: 'Souscription',
                  statut: 'Souscrit'
                })
                .select('id')
                .single();

              if (error) throw error;
              proprieteId = newProperty.id;
              propertiesData.push({ id: proprieteId, nom: row.site, adresse: row.site });
            }
            result.propertiesCreated++;
          }

          // 3. Créer la souscription historique
          if (!simulate && clientId && proprieteId) {
            // Calculer le solde restant
            const soldeRestant = Math.max(0, row.prixAcquisition - (row.soldeAnterieur + row.montantVerse));

            const { data: newSouscription, error: souscriptionError } = await supabase
              .from('souscriptions')
              .insert({
                client_id: clientId,
                propriete_id: proprieteId,
                type_souscription: 'historique',
                prix_total: row.prixAcquisition,
                apport_initial: row.soldeAnterieur,
                montant_mensuel: row.montantVerse,
                nombre_mois: soldeRestant > 0 ? Math.ceil(soldeRestant / Math.max(row.montantVerse, 1)) : 0,
                date_debut: new Date(row.dateVersement || Date.now()).toISOString().split('T')[0],
                solde_restant: soldeRestant,
                statut: soldeRestant > 0 ? 'active' : 'terminee',
                phase_actuelle: 'souscription'
              })
              .select('id')
              .single();

            if (souscriptionError) throw souscriptionError;

            // 4. Créer les paiements si montant verse > 0
            if (row.montantVerse > 0) {
              const { error: paymentError } = await supabase
                .from('paiements_souscriptions')
                .insert({
                  souscription_id: newSouscription.id,
                  montant: row.montantVerse,
                  date_paiement: new Date(row.dateVersement || Date.now()).toISOString().split('T')[0],
                  mode_paiement: 'Espèces',
                  reference: `Import historique - Ligne ${row.rowIndex}`
                });

              if (!paymentError) {
                result.paymentsCreated++;
                result.totalAmount += row.montantVerse;
              }
            }

            // 5. Créer paiement initial si solde antérieur > 0
            if (row.soldeAnterieur > 0) {
              const initialDate = new Date(row.dateVersement || Date.now());
              initialDate.setMonth(initialDate.getMonth() - 1); // Date antérieure

              const { error: initialPaymentError } = await supabase
                .from('paiements_souscriptions')
                .insert({
                  souscription_id: newSouscription.id,
                  montant: row.soldeAnterieur,
                  date_paiement: initialDate.toISOString().split('T')[0],
                  mode_paiement: 'Espèces',
                  reference: `Solde antérieur - Ligne ${row.rowIndex}`
                });

              if (!initialPaymentError) {
                result.paymentsCreated++;
                result.totalAmount += row.soldeAnterieur;
              }
            }
          }
          result.souscriptionsCreated++;

        } catch (error) {
          console.error(`Erreur ligne ${row.rowIndex}:`, error);
          result.errors.push(`Ligne ${row.rowIndex}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
      }

      setImportResult(result);
      
      toast({
        title: simulate ? "Simulation terminée" : "Import terminé",
        description: `${result.souscriptionsCreated} souscriptions ${simulate ? 'seraient' : ''} créées`,
      });

    } catch (error) {
      console.error('Erreur import:', error);
      toast({
        title: "Erreur d'import",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setImportProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          Importer Souscriptions Historiques
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import des Souscriptions Historiques
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Section Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Sélection du fichier Excel
              </CardTitle>
              <CardDescription>
                Fichier attendu avec colonnes: DATE DE VERSEMENT, CLIENT_L, SITES, PRIX ACQUISITION, SOLDE ANTERIEUR, MONTANT VERSE, RESTE A PAYER
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="excel-file">Fichier Excel (.xlsx, .xls)</Label>
                  <Input
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview des données */}
          {previewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Aperçu des données ({previewData.length} lignes)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Statistiques */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium">Clients uniques</p>
                            <p className="text-2xl font-bold">{new Set(previewData.map(d => d.clientName)).size}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="text-sm font-medium">Sites uniques</p>
                            <p className="text-2xl font-bold">{new Set(previewData.map(d => d.site)).size}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center space-x-2">
                          <CreditCard className="w-4 h-4 text-orange-600" />
                          <div>
                            <p className="text-sm font-medium">Montant total</p>
                            <p className="text-2xl font-bold">
                              {new Intl.NumberFormat('fr-FR').format(
                                previewData.reduce((sum, d) => sum + d.prixAcquisition, 0)
                              )} FCFA
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center space-x-2">
                          <Receipt className="w-4 h-4 text-purple-600" />
                          <div>
                            <p className="text-sm font-medium">Paiements totaux</p>
                            <p className="text-2xl font-bold">
                              {new Intl.NumberFormat('fr-FR').format(
                                previewData.reduce((sum, d) => sum + d.montantVerse + d.soldeAnterieur, 0)
                              )} FCFA
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Table preview (première 10 lignes) */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead>Site</TableHead>
                          <TableHead>Prix Acquisition</TableHead>
                          <TableHead>Solde Antérieur</TableHead>
                          <TableHead>Montant Versé</TableHead>
                          <TableHead>Reste à Payer</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.slice(0, 10).map((row, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{row.clientName}</TableCell>
                            <TableCell>{row.site}</TableCell>
                            <TableCell>{new Intl.NumberFormat('fr-FR').format(row.prixAcquisition)} FCFA</TableCell>
                            <TableCell>{new Intl.NumberFormat('fr-FR').format(row.soldeAnterieur)} FCFA</TableCell>
                            <TableCell>{new Intl.NumberFormat('fr-FR').format(row.montantVerse)} FCFA</TableCell>
                            <TableCell>{new Intl.NumberFormat('fr-FR').format(row.resteAPayer)} FCFA</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {previewData.length > 10 && (
                      <div className="p-2 text-sm text-gray-500 text-center">
                        ... et {previewData.length - 10} autres lignes
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Options d'import */}
          {previewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Options d'import</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="simulation"
                      checked={simulationMode}
                      onCheckedChange={(checked) => setSimulationMode(checked === true)}
                    />
                    <Label htmlFor="simulation">Mode simulation (aucune donnée ne sera enregistrée)</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="clear-clients"
                      checked={clearExistingClients}
                      onCheckedChange={(checked) => setClearExistingClients(checked === true)}
                    />
                    <Label htmlFor="clear-clients">Supprimer tous les clients existants avant l'import</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Barre de progression */}
          {isProcessing && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Import en cours...</span>
                    <span className="text-sm text-gray-500">{Math.round(importProgress)}%</span>
                  </div>
                  <Progress value={importProgress} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Résultats d'import */}
          {importResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Résultats de l'import
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Clients créés</p>
                    <p className="text-2xl font-bold text-green-600">{importResult.clientsCreated}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Clients trouvés</p>
                    <p className="text-2xl font-bold text-blue-600">{importResult.clientsMatched}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Propriétés créées</p>
                    <p className="text-2xl font-bold text-green-600">{importResult.propertiesCreated}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Souscriptions créées</p>
                    <p className="text-2xl font-bold text-purple-600">{importResult.souscriptionsCreated}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Paiements créés</p>
                    <p className="text-2xl font-bold text-orange-600">{importResult.paymentsCreated}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Montant total</p>
                    <p className="text-2xl font-bold text-green-600">
                      {new Intl.NumberFormat('fr-FR').format(importResult.totalAmount)} FCFA
                    </p>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-semibold">{importResult.errors.length} erreurs détectées:</p>
                        <div className="max-h-32 overflow-y-auto">
                          {importResult.errors.slice(0, 10).map((error, index) => (
                            <p key={index} className="text-sm text-red-600">• {error}</p>
                          ))}
                          {importResult.errors.length > 10 && (
                            <p className="text-sm text-gray-500">... et {importResult.errors.length - 10} autres erreurs</p>
                          )}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Boutons d'action */}
          {previewData.length > 0 && (
            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => importHistoricalData(true)}
                disabled={isProcessing}
                variant="outline"
              >
                Simuler l'import
              </Button>
              <Button
                onClick={() => importHistoricalData(false)}
                disabled={isProcessing || simulationMode}
              >
                Lancer l'import réel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}