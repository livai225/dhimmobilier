import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, Users, Home, Receipt, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ExcelRowData {
  nom: string;
  site: string;
  montantVerse: number;
  moisVersement: string;
  loyerMensuel: number;
  soldeRestant: number;
}

interface ImportResult {
  clientsMatched: number;
  clientsCreated: number;
  propertiesCreated: number;
  locationsCreated: number;
  paymentsImported: number;
  receiptsGenerated: number;
  totalAmount: number;
  errors: string[];
  details: {
    clients: Array<{ nom: string; action: 'matched' | 'created'; id?: string }>;
    properties: Array<{ site: string; id: string }>;
    locations: Array<{ client: string; property: string; loyer: number }>;
    payments: Array<{ client: string; montant: number; date: string }>;
  };
}

export function ImportHistoricalRentals() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<ExcelRowData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [simulationMode, setSimulationMode] = useState(true);

  // Normalize string for fuzzy matching
  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  };

  // Calculate Levenshtein distance for fuzzy matching
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + substitutionCost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // Find best client match
  const findBestClientMatch = (excelName: string, existingClients: any[]): any | null => {
    const normalizedExcelName = normalizeString(excelName);
    let bestMatch: any = null;
    let bestScore = Infinity;
    const threshold = 3; // Maximum allowed distance

    for (const client of existingClients) {
      const fullName = `${client.prenom || ''} ${client.nom}`.trim();
      const normalizedClientName = normalizeString(fullName);
      
      const distance = levenshteinDistance(normalizedExcelName, normalizedClientName);
      
      if (distance < bestScore && distance <= threshold) {
        bestScore = distance;
        bestMatch = client;
      }
    }

    return bestMatch;
  };

  // Parse Excel file
  const parseExcelFile = (file: File): Promise<ExcelRowData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const parsedData: ExcelRowData[] = [];
          
          // Skip header row, process data rows
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (row && row.length > 0 && row[0]) {
              // Adjust column indices based on your Excel structure
              parsedData.push({
                nom: String(row[0] || '').trim(),
                site: String(row[1] || '').trim(),
                montantVerse: parseFloat(String(row[2] || '0').replace(/[^\d.-]/g, '')) || 0,
                moisVersement: String(row[3] || '').trim(),
                loyerMensuel: parseFloat(String(row[4] || '0').replace(/[^\d.-]/g, '')) || 0,
                soldeRestant: parseFloat(String(row[5] || '0').replace(/[^\d.-]/g, '')) || 0,
              });
            }
          }

          resolve(parsedData.filter(row => row.nom && row.site));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Handle file selection and preview
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    try {
      const data = await parseExcelFile(selectedFile);
      setPreviewData(data);
      setShowPreview(true);
    } catch (error) {
      toast.error('Erreur lors de la lecture du fichier Excel');
      console.error('Excel parsing error:', error);
    }
  };

  // Main import function
  const importHistoricalData = async (simulate: boolean = true) => {
    if (!file || previewData.length === 0) {
      toast.error('Aucun fichier sélectionné ou données manquantes');
      return;
    }

    setIsImporting(true);
    setProgress(0);

    try {
      const result: ImportResult = {
        clientsMatched: 0,
        clientsCreated: 0,
        propertiesCreated: 0,
        locationsCreated: 0,
        paymentsImported: 0,
        receiptsGenerated: 0,
        totalAmount: 0,
        errors: [],
        details: {
          clients: [],
          properties: [],
          locations: [],
          payments: []
        }
      };

      // Step 1: Fetch existing clients and properties
      setProgress(10);
      const { data: existingClients } = await supabase.from('clients').select('*');
      const { data: existingProperties } = await supabase.from('proprietes').select('*');

      if (!existingClients || !existingProperties) {
        throw new Error('Erreur lors de la récupération des données existantes');
      }

      // Step 2: Process each row
      const totalRows = previewData.length;
      
      for (let i = 0; i < previewData.length; i++) {
        const row = previewData[i];
        setProgress(10 + (i / totalRows) * 80);

        try {
          // Match or create client
          let client = findBestClientMatch(row.nom, existingClients);
          
          if (!client) {
            const nameParts = row.nom.split(' ');
            const prenom = nameParts.length > 1 ? nameParts[0] : '';
            const nom = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];
            
            if (!simulate) {
              const { data: newClient, error } = await supabase
                .from('clients')
                .insert({
                  nom,
                  prenom,
                  telephone_principal: '',
                })
                .select()
                .single();

              if (error) throw error;
              client = newClient;
              existingClients.push(newClient);
            }
            
            result.clientsCreated++;
            result.details.clients.push({ nom: row.nom, action: 'created', id: client?.id });
          } else {
            result.clientsMatched++;
            result.details.clients.push({ nom: row.nom, action: 'matched', id: client.id });
          }

          // Match or create property
          let property = existingProperties.find(p => 
            normalizeString(p.nom || '').includes(normalizeString(row.site)) ||
            normalizeString(row.site).includes(normalizeString(p.nom || ''))
          );

          if (!property) {
            if (!simulate) {
              const { data: newProperty, error } = await supabase
                .from('proprietes')
                .insert({
                  nom: row.site,
                  loyer_mensuel: row.loyerMensuel,
                  statut: 'Occupé',
                  usage: 'Location'
                })
                .select()
                .single();

              if (error) throw error;
              property = newProperty;
              existingProperties.push(newProperty);
            }
            
            result.propertiesCreated++;
            result.details.properties.push({ site: row.site, id: property?.id || 'simulated' });
          }

          // Create location if not exists
          if (!simulate && client && property) {
            const { data: existingLocation } = await supabase
              .from('locations')
              .select('id')
              .eq('client_id', client.id)
              .eq('propriete_id', property.id)
              .single();

            if (!existingLocation) {
              const cautionTotale = row.loyerMensuel * 5; // 5 mois de caution

              const { error: locationError } = await supabase
                .from('locations')
                .insert({
                  client_id: client.id,
                  propriete_id: property.id,
                  loyer_mensuel: row.loyerMensuel,
                  caution_totale: cautionTotale,
                  date_debut: new Date().toISOString().split('T')[0],
                  statut: row.soldeRestant > 0 ? 'active' : 'en_retard'
                });

              if (locationError) throw locationError;
              result.locationsCreated++;
              result.details.locations.push({
                client: row.nom,
                property: row.site,
                loyer: row.loyerMensuel
              });
            }
          }

          // Import payment if amount > 0
          if (row.montantVerse > 0) {
            if (!simulate && client && property) {
              // Create payment record
              const { error: paymentError } = await supabase
                .from('paiements_locations')
                .insert({
                  location_id: (await supabase
                    .from('locations')
                    .select('id')
                    .eq('client_id', client.id)
                    .eq('propriete_id', property.id)
                    .single()).data?.id,
                  montant: row.montantVerse,
                  date_paiement: new Date().toISOString().split('T')[0],
                  mode_paiement: 'cash',
                  reference: 'Import historique'
                });

              if (paymentError) throw paymentError;

              // Record cash transaction
              await supabase.rpc('record_cash_transaction', {
                p_type_transaction: 'sortie',
                p_montant: row.montantVerse,
                p_type_operation: 'paiement_loyer',
                p_beneficiaire: row.nom,
                p_description: `Paiement historique - ${row.site}`
              });
            }

            result.paymentsImported++;
            result.totalAmount += row.montantVerse;
            result.details.payments.push({
              client: row.nom,
              montant: row.montantVerse,
              date: row.moisVersement
            });
          }

        } catch (error) {
          result.errors.push(`Ligne ${i + 1} (${row.nom}): ${error.message}`);
        }
      }

      setProgress(100);
      setResults(result);
      
      if (!simulate) {
        toast.success(`Import terminé! ${result.paymentsImported} paiements importés pour ${result.totalAmount.toLocaleString()} FCFA`);
      } else {
        toast.info('Simulation terminée - Vérifiez les résultats avant l\'import définitif');
      }

    } catch (error) {
      toast.error('Erreur lors de l\'import');
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Import Données Historiques
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import des Données de Location Historiques
          </DialogTitle>
          <DialogDescription>
            Importez vos données de location existantes depuis Excel. Le système va automatiquement
            faire correspondre les clients, créer les propriétés manquantes et intégrer les paiements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">1. Sélectionner le fichier Excel</CardTitle>
            </CardHeader>
            <CardContent>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="w-full p-2 border rounded-md"
              />
              {file && (
                <p className="text-sm text-muted-foreground mt-2">
                  Fichier sélectionné: {file.name} ({previewData.length} lignes détectées)
                </p>
              )}
            </CardContent>
          </Card>

          {/* Preview Data */}
          {showPreview && previewData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">2. Aperçu des données</CardTitle>
                <CardDescription>
                  Vérifiez que les données sont correctement lues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48 w-full border rounded-md p-4">
                  <div className="space-y-2">
                    {previewData.slice(0, 5).map((row, index) => (
                      <div key={index} className="text-xs bg-muted p-2 rounded">
                        <strong>{row.nom}</strong> - {row.site} - Loyer: {row.loyerMensuel?.toLocaleString()} FCFA
                        {row.montantVerse > 0 && (
                          <span className="text-green-600 ml-2">
                            Versé: {row.montantVerse.toLocaleString()} FCFA
                          </span>
                        )}
                      </div>
                    ))}
                    {previewData.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        ... et {previewData.length - 5} autres lignes
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Import Controls */}
          {showPreview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">3. Options d'import</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => importHistoricalData(true)}
                    disabled={isImporting}
                    variant="outline"
                    className="gap-2"
                  >
                    <Info className="h-4 w-4" />
                    Simuler l'import
                  </Button>
                  
                  <Button
                    onClick={() => importHistoricalData(false)}
                    disabled={isImporting || !results}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Import définitif
                  </Button>
                </div>

                {isImporting && (
                  <div className="space-y-2">
                    <Progress value={progress} className="w-full" />
                    <p className="text-sm text-muted-foreground">
                      Import en cours... {progress.toFixed(0)}%
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {results && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  {simulationMode ? <Info className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                  Résultats {simulationMode ? 'de simulation' : 'd\'import'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{results.clientsMatched}</div>
                    <div className="text-xs text-muted-foreground">Clients trouvés</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{results.clientsCreated}</div>
                    <div className="text-xs text-muted-foreground">Clients créés</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{results.propertiesCreated}</div>
                    <div className="text-xs text-muted-foreground">Propriétés créées</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{results.paymentsImported}</div>
                    <div className="text-xs text-muted-foreground">Paiements importés</div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Montant total des paiements</h4>
                    <div className="text-xl font-bold text-green-600">
                      {results.totalAmount.toLocaleString()} FCFA
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-2">Locations créées</h4>
                    <div className="text-xl font-bold">
                      {results.locationsCreated}
                    </div>
                  </div>
                </div>

                {results.errors.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Erreurs détectées ({results.errors.length}):</strong>
                      <ScrollArea className="h-32 mt-2">
                        <ul className="text-xs space-y-1">
                          {results.errors.map((error, index) => (
                            <li key={index} className="text-red-600">• {error}</li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}