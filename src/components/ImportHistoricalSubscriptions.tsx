import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  Info,
  Users,
  Building,
  CreditCard,
  Receipt
} from 'lucide-react';

interface ExcelRowData {
  rowIndex: number;
  dateVersement: string;
  clientName: string;
  site: string;
  prixAcquisition: number;
  soldeAnterieur: number;
  montantVerse: number;
  resteAPayer: number;
}

interface ImportResult {
  clientsCreated: number;
  clientsMatched: number;
  propertiesCreated: number;
  propertiesMatched: number;
  souscriptionsCreated: number;
  paymentsImported: number;
  receiptsGenerated: number;
  totalAmount: number;
  errors: string[];
}

interface ValidationResult {
  isValid: boolean;
  totalSubscriptions: number;
  totalPayments: number;
  totalAmount: number;
  inconsistencies: Array<{
    rowIndex: number;
    issue: string;
    expected: number;
    actual: number;
  }>;
  duplicateClients: Array<{ name: string; count: number; rows: number[] }>;
  missingSites: Array<{ site: string; rows: number[] }>;
}

export function ImportHistoricalSubscriptions({ inline = false }: { inline?: boolean } = {}): React.ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<ExcelRowData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [simulationMode, setSimulationMode] = useState(true);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [simulationCompleted, setSimulationCompleted] = useState(false);

  // Normalize string for matching
  const normalizeString = (str: string): string => {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
  };

  // Parse FCFA amounts from Excel cells
  const parseAmount = (value: any): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const str = String(value).replace(/[^\d,.-]/g, '').replace(/\s/g, '');
    const num = parseFloat(str.replace(',', '.'));
    return isNaN(num) ? 0 : num;
  };

  // Validate data integrity
  function validateData(data: ExcelRowData[]): ValidationResult {
    const inconsistencies: ValidationResult['inconsistencies'] = [];
    const duplicateClients: ValidationResult['duplicateClients'] = [];
    const missingSites: ValidationResult['missingSites'] = [];

    // Check amount consistency (with tolerance)
    const tolerance = 1000;
    data.forEach(row => {
      const calculated = row.montantVerse + row.resteAPayer;
      const expected = row.prixAcquisition;
      if (Math.abs(calculated - expected) > tolerance) {
        inconsistencies.push({
          rowIndex: row.rowIndex,
          issue: 'Montant versé + Reste à payer ≠ Prix acquisition',
          expected,
          actual: calculated
        });
      }
    });

    // Check for duplicate clients
    const clientCounts = new Map<string, number[]>();
    data.forEach(row => {
      const key = normalizeString(row.clientName);
      if (!clientCounts.has(key)) clientCounts.set(key, []);
      clientCounts.get(key)!.push(row.rowIndex);
    });

    clientCounts.forEach((rows, name) => {
      if (rows.length > 1) {
        duplicateClients.push({ name, count: rows.length, rows });
      }
    });

    // Check for missing sites
    const missingSiteRows = new Map<string, number[]>();
    data.forEach(row => {
      if (!row.site || row.site.trim() === '') {
        const key = row.site || 'Site vide';
        if (!missingSiteRows.has(key)) missingSiteRows.set(key, []);
        missingSiteRows.get(key)!.push(row.rowIndex);
      }
    });

    missingSiteRows.forEach((rows, site) => {
      missingSites.push({ site, rows });
    });

    return {
      isValid: inconsistencies.length === 0 && missingSites.length === 0,
      totalSubscriptions: data.length,
      totalPayments: data.reduce((sum, d) => sum + (d.soldeAnterieur > 0 ? 1 : 0) + (d.montantVerse > 0 ? 1 : 0), 0),
      totalAmount: data.reduce((sum, d) => sum + d.montantVerse + d.soldeAnterieur, 0),
      inconsistencies,
      duplicateClients,
      missingSites
    };
  }

  // Parse Excel file
  const parseExcelFile = async (file: File): Promise<ExcelRowData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const parsed: ExcelRowData[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (row.length < 7) continue;

            parsed.push({
              rowIndex: i + 1,
              dateVersement: row[0] || '',
              clientName: row[1] || '',
              site: row[2] || '',
              prixAcquisition: parseAmount(row[3]),
              soldeAnterieur: parseAmount(row[4]),
              montantVerse: parseAmount(row[5]),
              resteAPayer: parseAmount(row[6])
            });
          }

          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Handle file selection
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResults(null);
    setValidation(null);
    setSimulationCompleted(false);
    setIsAnalyzing(true);

    try {
      const data = await parseExcelFile(selectedFile);
      setPreviewData(data);
      setValidation(validateData(data));
      setShowPreview(true);
    } catch (error) {
      toast.error('Erreur lors de la lecture du fichier Excel');
      console.error('Excel parsing error:', error);
    } finally {
      setIsAnalyzing(false);
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
    setSimulationMode(simulate);

    try {
      const result: ImportResult = {
        clientsCreated: 0,
        clientsMatched: 0,
        propertiesCreated: 0,
        propertiesMatched: 0,
        souscriptionsCreated: 0,
        paymentsImported: 0,
        receiptsGenerated: 0,
        totalAmount: 0,
        errors: []
      };

      // Get existing data
      const { data: existingClients } = await supabase.from('clients').select('*');
      const { data: existingProperties } = await supabase.from('proprietes').select('*');

      if (!existingClients || !existingProperties) {
        throw new Error('Erreur lors de la récupération des données existantes');
      }

      const total = previewData.length;
      
      for (let i = 0; i < previewData.length; i++) {
        const row = previewData[i];
        setProgress((i / total) * 100);

        try {
          // Find or create client
          let client = existingClients.find(c => 
            normalizeString(c.nom) === normalizeString(row.clientName)
          );

          if (!client && !simulate) {
            const { data: newClient, error: clientError } = await supabase
              .from('clients')
              .insert({ nom: row.clientName })
              .select()
              .single();

            if (clientError) throw clientError;
            client = newClient;
            result.clientsCreated++;
          } else if (client) {
            result.clientsMatched++;
          }

          // Find or create property
          let property = existingProperties.find(p => 
            normalizeString(p.nom) === normalizeString(row.site)
          );

          if (!property && !simulate) {
            const { data: newProperty, error: propertyError } = await supabase
              .from('proprietes')
              .insert({
                nom: row.site,
                type: 'terrain',
                statut: 'disponible',
                prix: row.prixAcquisition
              })
              .select()
              .single();

            if (propertyError) throw propertyError;
            property = newProperty;
            result.propertiesCreated++;
          } else if (property) {
            result.propertiesMatched++;
          }

          // Create subscription and payments
          if (!simulate && client && property) {
            const { data: newSouscription, error: souscriptionError } = await supabase
              .from('souscriptions')
              .insert({
                client_id: client.id,
                propriete_id: property.id,
                prix_acquisition: row.prixAcquisition,
                solde: row.resteAPayer,
                statut: 'active'
              })
              .select()
              .single();

            if (souscriptionError) throw souscriptionError;

            // Create payments using RPC
            if (row.soldeAnterieur > 0) {
              await supabase.rpc('pay_souscription_with_cash', {
                p_souscription_id: newSouscription.id,
                p_montant: row.soldeAnterieur,
                p_date_paiement: new Date().toISOString().split('T')[0],
                p_mode_paiement: 'espece',
                p_reference: `Solde antérieur - Import ligne ${row.rowIndex}`,
                p_description: 'Import historique souscriptions'
              });
              result.paymentsImported++;
              result.receiptsGenerated++;
            }

            if (row.montantVerse > 0) {
              await supabase.rpc('pay_souscription_with_cash', {
                p_souscription_id: newSouscription.id,
                p_montant: row.montantVerse,
                p_date_paiement: new Date().toISOString().split('T')[0],
                p_mode_paiement: 'espece',
                p_reference: `Montant versé - Import ligne ${row.rowIndex}`,
                p_description: 'Import historique souscriptions'
              });
              result.paymentsImported++;
              result.receiptsGenerated++;
            }

            result.totalAmount += row.soldeAnterieur + row.montantVerse;
          }

          result.souscriptionsCreated++;
        } catch (error) {
          console.error(`Erreur ligne ${i + 1}:`, error);
          result.errors.push(`Ligne ${row.rowIndex}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
      }

      setProgress(100);
      setResults(result);
      
      if (simulate) {
        setSimulationCompleted(true);
        toast.success(`Simulation terminée: ${result.souscriptionsCreated} souscriptions seraient créées`);
      } else {
        toast.success(`Import terminé: ${result.souscriptionsCreated} souscriptions créées`);
      }

    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erreur lors de l\'import des données');
    } finally {
      setIsImporting(false);
      setProgress(0);
      setSimulationMode(true);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount).replace('XOF', 'FCFA');
  };

  const renderContent = () => (
    <div className="flex-1 overflow-y-auto pr-4">
      <div className="space-y-6">
        {/* Step 1: File Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="w-4 h-4" />
              Étape 1: Sélection du fichier
            </CardTitle>
            <CardDescription>
              Sélectionnez votre fichier Excel contenant les données historiques de souscriptions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="excel-file">Fichier Excel</Label>
              <Input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={isAnalyzing || isImporting}
              />
            </div>
            
            {isAnalyzing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                Analyse du fichier en cours...
              </div>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Format attendu:</strong> DATE DE VERSEMENT, CLIENT, SITES, PRIX ACQUISITION, 
                SOLDE ANTERIEUR, MONTANT VERSE, RESTE A PAYER
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Step 2: Data Preview & Validation */}
        {showPreview && validation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="w-4 h-4" />
                Étape 2: Aperçu et validation des données
              </CardTitle>
              <CardDescription>
                Vérifiez vos données avant de procéder à la simulation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Validation Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col items-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-primary">{validation.totalSubscriptions}</div>
                  <div className="text-sm text-muted-foreground">Souscriptions</div>
                </div>
                <div className="flex flex-col items-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-primary">{validation.totalPayments}</div>
                  <div className="text-sm text-muted-foreground">Paiements</div>
                </div>
                <div className="flex flex-col items-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-primary">{formatCurrency(validation.totalAmount)}</div>
                  <div className="text-sm text-muted-foreground">Montant total</div>
                </div>
                <div className="flex flex-col items-center p-3 border rounded-lg">
                  <div className={`text-2xl font-bold ${validation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                    {validation.isValid ? '✓' : '⚠'}
                  </div>
                  <div className="text-sm text-muted-foreground">{validation.isValid ? 'Valide' : 'Erreurs'}</div>
                </div>
              </div>

              {/* Issues Alert */}
              {(!validation.isValid || validation.inconsistencies.length > 0) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Problèmes détectés:</strong>
                    <ul className="list-disc ml-4 mt-2">
                      {validation.inconsistencies.map((inc, idx) => (
                        <li key={idx}>
                          Ligne {inc.rowIndex}: {inc.issue} (attendu: {formatCurrency(inc.expected)}, 
                          calculé: {formatCurrency(inc.actual)})
                        </li>
                      ))}
                      {validation.duplicateClients.map((dup, idx) => (
                        <li key={idx}>
                          Client dupliqué "{dup.name}" ({dup.count} fois, lignes: {dup.rows.join(', ')})
                        </li>
                      ))}
                      {validation.missingSites.map((miss, idx) => (
                        <li key={idx}>
                          {miss.site} (lignes: {miss.rows.join(', ')})
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Sample Data Table */}
              <div>
                <h4 className="font-medium mb-2">Aperçu des données (5 premières lignes):</h4>
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
                      {previewData.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{row.clientName}</TableCell>
                          <TableCell>{row.site}</TableCell>
                          <TableCell>{formatCurrency(row.prixAcquisition)}</TableCell>
                          <TableCell>{formatCurrency(row.soldeAnterieur)}</TableCell>
                          <TableCell>{formatCurrency(row.montantVerse)}</TableCell>
                          <TableCell>{formatCurrency(row.resteAPayer)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Simulate Button */}
              <Button
                onClick={() => importHistoricalData(true)}
                disabled={isImporting || !validation.isValid}
                className="w-full"
                size="lg"
              >
                {isImporting ? 'Simulation en cours...' : 'Simuler l\'import'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Simulation Progress */}
        {isImporting && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                {simulationMode ? 'Simulation' : 'Import'} en cours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2">
                Progression: {Math.round(progress)}%
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Simulation Results */}
        {results && simulationCompleted && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Étape 3: Résultats de la simulation
              </CardTitle>
              <CardDescription>
                Voici ce qui sera créé lors de l'import définitif
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-4">
                    <Users className="w-8 h-8 text-blue-500 mb-2" />
                    <div className="text-2xl font-bold">{results.clientsCreated}</div>
                    <div className="text-sm text-muted-foreground">Nouveaux clients</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-4">
                    <Building className="w-8 h-8 text-green-500 mb-2" />
                    <div className="text-2xl font-bold">{results.propertiesCreated}</div>
                    <div className="text-sm text-muted-foreground">Nouvelles propriétés</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-4">
                    <FileSpreadsheet className="w-8 h-8 text-purple-500 mb-2" />
                    <div className="text-2xl font-bold">{results.souscriptionsCreated}</div>
                    <div className="text-sm text-muted-foreground">Souscriptions</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-4">
                    <CreditCard className="w-8 h-8 text-orange-500 mb-2" />
                    <div className="text-2xl font-bold">{results.paymentsImported}</div>
                    <div className="text-sm text-muted-foreground">Paiements</div>
                  </CardContent>
                </Card>
              </div>

              {/* Final Import Button */}
              <div className="pt-4">
                <Button
                  onClick={() => importHistoricalData(false)}
                  disabled={isImporting || results.errors.length > 0}
                  className="w-full"
                  size="lg"
                  variant="default"
                >
                  Procéder à l'import définitif
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  ⚠️ Cette action est irréversible. Toutes les données seront créées dans la base.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Final Results */}
        {results && !simulationCompleted && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-green-600">
                <CheckCircle className="w-5 h-5" />
                Import terminé avec succès!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {results.souscriptionsCreated}
                  </div>
                  <div className="text-lg text-green-800">
                    Souscriptions historiques importées
                  </div>
                  <div className="text-sm text-green-600 mt-2">
                    {formatCurrency(results.totalAmount)} de paiements enregistrés
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-xl font-bold">{results.clientsCreated}</div>
                    <div className="text-sm text-muted-foreground">Nouveaux clients</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold">{results.propertiesCreated}</div>
                    <div className="text-sm text-muted-foreground">Nouvelles propriétés</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold">{results.paymentsImported}</div>
                    <div className="text-sm text-muted-foreground">Paiements</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold">{results.receiptsGenerated}</div>
                    <div className="text-sm text-muted-foreground">Reçus générés</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="max-w-7xl mx-auto w-full py-4">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6" />
            Import des Souscriptions Historiques
          </h1>
          <p className="text-sm text-muted-foreground">
            Importez vos données historiques de souscriptions à partir d'un fichier Excel
          </p>
        </div>
        {renderContent()}
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          Importer Souscriptions Historiques
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import des Souscriptions Historiques
          </DialogTitle>
          <DialogDescription>
            Importez vos données historiques de souscriptions à partir d'un fichier Excel
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
