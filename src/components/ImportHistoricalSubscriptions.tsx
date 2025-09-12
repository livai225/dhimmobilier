import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, Users, Building, Receipt, AlertCircle, CheckCircle, Info, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { normalizeString } from '@/lib/format';

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

interface ImportResult {
  clientsMatched: number;
  clientsCreated: number;
  propertiesCreated: number;
  propertiesMatched: number;
  souscriptionsCreated: number;
  paymentsImported: number;
  receiptsGenerated: number;
  totalAmount: number;
  errors: string[];
  details: {
    clients: Array<{ nom: string; action: 'matched' | 'created'; id?: string }>;
    properties: Array<{ site: string; action: 'matched' | 'created'; id: string }>;
    souscriptions: Array<{ client: string; property: string; prix: number; solde: number }>;
    payments: Array<{ client: string; montant: number; date: string; type: string }>;
    warnings: string[];
  };
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

export function ImportHistoricalSubscriptions() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<ExcelRowData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [simulationMode, setSimulationMode] = useState(true);
  const [clearExistingClients, setClearExistingClients] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [simulationCompleted, setSimulationCompleted] = useState(false);

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
    const threshold = 3;

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

  // Parse Excel file with automatic column detection
  const parseExcelFile = (file: File): Promise<ExcelRowData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (!jsonData || jsonData.length < 2) {
            reject(new Error('Fichier Excel vide ou mal formaté'));
            return;
          }

          const headers = jsonData[0] || [];
          
          const columnMapping = {
            dateVersement: -1,
            clientName: -1,
            site: -1,
            prixAcquisition: -1,
            soldeAnterieur: -1,
            montantVerse: -1,
            resteAPayer: -1
          };

          // Auto-detect columns based on headers
          headers.forEach((header: any, index: number) => {
            const headerStr = String(header || '').toLowerCase().trim();
            
            if (headerStr.includes('date') && headerStr.includes('versement')) {
              columnMapping.dateVersement = index;
            } else if (headerStr.includes('client')) {
              columnMapping.clientName = index;
            } else if (headerStr.includes('site') || headerStr.includes('lieu')) {
              columnMapping.site = index;
            } else if (headerStr.includes('prix') && headerStr.includes('acquisition')) {
              columnMapping.prixAcquisition = index;
            } else if (headerStr.includes('solde') && headerStr.includes('anterieur')) {
              columnMapping.soldeAnterieur = index;
            } else if (headerStr.includes('montant') && headerStr.includes('verse')) {
              columnMapping.montantVerse = index;
            } else if (headerStr.includes('reste') && headerStr.includes('payer')) {
              columnMapping.resteAPayer = index;
            }
          });

          // Fallback to positional mapping if auto-detection fails
          if (columnMapping.dateVersement === -1 && headers.length >= 7) {
            columnMapping.dateVersement = 0;
            columnMapping.clientName = 1;
            columnMapping.site = 2;
            columnMapping.prixAcquisition = 3;
            columnMapping.soldeAnterieur = 4;
            columnMapping.montantVerse = 5;
            columnMapping.resteAPayer = 6;
          }

          const parsedData: ExcelRowData[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;

            const dateVersement = columnMapping.dateVersement >= 0 ? String(row[columnMapping.dateVersement] || '').trim() : '';
            const clientName = columnMapping.clientName >= 0 ? String(row[columnMapping.clientName] || '').trim() : '';
            const site = columnMapping.site >= 0 ? String(row[columnMapping.site] || '').trim() : '';
            const prixAcquisition = columnMapping.prixAcquisition >= 0 ? 
              parseFloat(String(row[columnMapping.prixAcquisition] || '0').replace(/[^\d.-]/g, '')) || 0 : 0;
            const soldeAnterieur = columnMapping.soldeAnterieur >= 0 ? 
              parseFloat(String(row[columnMapping.soldeAnterieur] || '0').replace(/[^\d.-]/g, '')) || 0 : 0;
            const montantVerse = columnMapping.montantVerse >= 0 ? 
              parseFloat(String(row[columnMapping.montantVerse] || '0').replace(/[^\d.-]/g, '')) || 0 : 0;
            const resteAPayer = columnMapping.resteAPayer >= 0 ? 
              parseFloat(String(row[columnMapping.resteAPayer] || '0').replace(/[^\d.-]/g, '')) || 0 : 0;

            if (clientName && site && prixAcquisition > 0) {
              parsedData.push({
                dateVersement,
                clientName,
                site,
                prixAcquisition,
                soldeAnterieur,
                montantVerse,
                resteAPayer,
                rowIndex: i + 1,
              });
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

  // Validate data integrity
  const validateData = (data: ExcelRowData[]): ValidationResult => {
    const inconsistencies: ValidationResult['inconsistencies'] = [];
    const duplicateClients: ValidationResult['duplicateClients'] = [];
    const missingSites: ValidationResult['missingSites'] = [];

    // Check amount consistency
    data.forEach((row) => {
      const calculatedTotal = row.soldeAnterieur + row.montantVerse + row.resteAPayer;
      const difference = Math.abs(calculatedTotal - row.prixAcquisition);
      
      if (difference > 0.01) { // Allow small rounding differences
        inconsistencies.push({
          rowIndex: row.rowIndex,
          issue: 'Montants incohérents',
          expected: row.prixAcquisition,
          actual: calculatedTotal
        });
      }
    });

    // Check for duplicate clients
    const clientCounts: { [key: string]: { count: number; rows: number[] } } = {};
    data.forEach((row) => {
      const normalizedName = normalizeString(row.clientName);
      if (!clientCounts[normalizedName]) {
        clientCounts[normalizedName] = { count: 0, rows: [] };
      }
      clientCounts[normalizedName].count++;
      clientCounts[normalizedName].rows.push(row.rowIndex);
    });

    Object.entries(clientCounts).forEach(([name, info]) => {
      if (info.count > 1) {
        duplicateClients.push({
          name: data.find(d => normalizeString(d.clientName) === name)?.clientName || name,
          count: info.count,
          rows: info.rows
        });
      }
    });

    // Check for missing site names
    const siteCounts: { [key: string]: number[] } = {};
    data.forEach((row) => {
      if (!row.site || row.site.trim().length === 0) {
        if (!siteCounts['Sites manquants']) siteCounts['Sites manquants'] = [];
        siteCounts['Sites manquants'].push(row.rowIndex);
      }
    });

    Object.entries(siteCounts).forEach(([site, rows]) => {
      if (rows.length > 0) {
        missingSites.push({ site, rows });
      }
    });

    return {
      isValid: inconsistencies.length === 0 && missingSites.length === 0,
      totalSubscriptions: data.length,
      totalPayments: data.filter(d => d.montantVerse > 0 || d.soldeAnterieur > 0).length * 2,
      totalAmount: data.reduce((sum, d) => sum + d.montantVerse + d.soldeAnterieur, 0),
      inconsistencies,
      duplicateClients,
      missingSites
    };
  };

  // Handle file selection and preview
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResults(null);
    setValidation(null);
    setSimulationCompleted(false);
    
    try {
      setIsAnalyzing(true);
      const data = await parseExcelFile(selectedFile);
      setPreviewData(data);
      setShowPreview(true);

      // Analyze data
      const validationResult = validateData(data);
      setValidation(validationResult);

      toast.success(`Fichier analysé: ${data.length} souscriptions détectées`);
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

    try {
      const result: ImportResult = {
        clientsMatched: 0,
        clientsCreated: 0,
        propertiesCreated: 0,
        propertiesMatched: 0,
        souscriptionsCreated: 0,
        paymentsImported: 0,
        receiptsGenerated: 0,
        totalAmount: 0,
        errors: [],
        details: {
          clients: [],
          properties: [],
          souscriptions: [],
          payments: [],
          warnings: []
        }
      };

      // Step 1: Clear existing clients if requested
      if (clearExistingClients && !simulate) {
        await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        toast.info('Clients existants supprimés');
      }

      // Step 2: Fetch existing clients and properties
      setProgress(10);
      const { data: existingClients } = await supabase.from('clients').select('*');
      const { data: existingProperties } = await supabase.from('proprietes').select('*');

      if (!existingClients || !existingProperties) {
        throw new Error('Erreur lors de la récupération des données existantes');
      }

      // Step 3: Process each row
      const totalRows = previewData.length;
      
      for (let i = 0; i < previewData.length; i++) {
        const row = previewData[i];
        setProgress(10 + (i / totalRows) * 80);

        try {
          // Match or create client
          let client = findBestClientMatch(row.clientName, existingClients);
          
          if (!client) {
            const nameParts = row.clientName.split(' ');
            const nom = nameParts.pop() || row.clientName;
            const prenom = nameParts.join(' ') || '';

            if (!simulate) {
              const { data: newClient, error } = await supabase
                .from('clients')
                .insert({
                  nom,
                  prenom,
                  telephone_principal: null,
                })
                .select()
                .single();

              if (error) throw error;
              client = newClient;
              existingClients.push(newClient);
            }
            
            result.clientsCreated++;
            result.details.clients.push({ nom: row.clientName, action: 'created', id: client?.id });
          } else {
            result.clientsMatched++;
            result.details.clients.push({ nom: row.clientName, action: 'matched', id: client.id });
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
                  usage: 'Souscription',
                  statut: 'Souscrit'
                })
                .select()
                .single();

              if (error) throw error;
              property = newProperty;
              existingProperties.push(newProperty);
            }
            
            result.propertiesCreated++;
            result.details.properties.push({ site: row.site, action: 'created', id: property?.id || 'simulated' });
          } else {
            result.propertiesMatched++;
            result.details.properties.push({ site: row.site, action: 'matched', id: property.id });
          }

          // Create historical subscription
          if (!simulate && client && property) {
            const soldeRestant = Math.max(0, row.resteAPayer);

            const { data: newSouscription, error: souscriptionError } = await supabase
              .from('souscriptions')
              .insert({
                client_id: client.id,
                propriete_id: property.id,
                type_souscription: 'historique',
                prix_total: row.prixAcquisition,
                apport_initial: row.soldeAnterieur,
                montant_mensuel: row.montantVerse,
                nombre_mois: soldeRestant > 0 ? Math.ceil(soldeRestant / Math.max(row.montantVerse, 1)) : 0,
                date_debut: new Date().toISOString().split('T')[0],
                solde_restant: soldeRestant,
                statut: soldeRestant > 0 ? 'active' : 'terminee',
                phase_actuelle: 'souscription'
              })
              .select()
              .single();

            if (souscriptionError) throw souscriptionError;

            // Create payments
            if (row.soldeAnterieur > 0) {
              const { error: paymentError1 } = await supabase
                .from('paiements_souscriptions')
                .insert({
                  souscription_id: newSouscription.id,
                  montant: row.soldeAnterieur,
                  date_paiement: new Date().toISOString().split('T')[0],
                  mode_paiement: 'Espèces',
                  reference: `Solde antérieur - Import ligne ${row.rowIndex}`
                });

              if (!paymentError1) {
                result.paymentsImported++;
                result.totalAmount += row.soldeAnterieur;
                result.details.payments.push({
                  client: row.clientName,
                  montant: row.soldeAnterieur,
                  date: new Date().toISOString().split('T')[0],
                  type: 'Solde antérieur'
                });
              }
            }

            if (row.montantVerse > 0) {
              const { error: paymentError2 } = await supabase
                .from('paiements_souscriptions')
                .insert({
                  souscription_id: newSouscription.id,
                  montant: row.montantVerse,
                  date_paiement: new Date().toISOString().split('T')[0],
                  mode_paiement: 'Espèces',
                  reference: `Montant versé - Import ligne ${row.rowIndex}`
                });

              if (!paymentError2) {
                result.paymentsImported++;
                result.totalAmount += row.montantVerse;
                result.details.payments.push({
                  client: row.clientName,
                  montant: row.montantVerse,
                  date: new Date().toISOString().split('T')[0],
                  type: 'Versement'
                });
              }
            }
          }

          result.souscriptionsCreated++;
          result.details.souscriptions.push({
            client: row.clientName,
            property: row.site,
            prix: row.prixAcquisition,
            solde: row.resteAPayer
          });

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
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount).replace('XOF', 'FCFA');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          Importer Souscriptions Historiques
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import des Souscriptions Historiques
          </DialogTitle>
          <DialogDescription>
            Importez vos données historiques de souscriptions à partir d'un fichier Excel
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
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

                {/* Format Info */}
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
                      <div className="text-sm text-muted-foreground">
                        {validation.isValid ? 'Valide' : 'Erreurs'}
                      </div>
                    </div>
                  </div>

                  {/* Issues Alert */}
                  {(!validation.isValid || validation.inconsistencies.length > 0 || validation.duplicateClients.length > 0) && (
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

                  {/* Import Options */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Options d'import:</h4>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="clear-clients"
                        checked={clearExistingClients}
                        onCheckedChange={(checked) => setClearExistingClients(checked === true)}
                      />
                      <Label htmlFor="clear-clients" className="text-sm">
                        Supprimer tous les clients existants avant l'import
                      </Label>
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

                  {/* Detailed Information */}
                  <Separator />
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Clients ({results.clientsCreated + results.clientsMatched} total)
                      </h4>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{results.clientsCreated} nouveaux</Badge>
                          <Badge variant="outline">{results.clientsMatched} existants</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {results.clientsCreated > 0 && `${results.clientsCreated} clients seront créés`}
                          {results.clientsCreated > 0 && results.clientsMatched > 0 && ', '}
                          {results.clientsMatched > 0 && `${results.clientsMatched} clients existants réutilisés`}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        Propriétés ({results.propertiesCreated + results.propertiesMatched} total)
                      </h4>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{results.propertiesCreated} nouvelles</Badge>
                          <Badge variant="outline">{results.propertiesMatched} existantes</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {results.propertiesCreated > 0 && `${results.propertiesCreated} propriétés seront créées`}
                          {results.propertiesCreated > 0 && results.propertiesMatched > 0 && ', '}
                          {results.propertiesMatched > 0 && `${results.propertiesMatched} propriétés existantes réutilisées`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Résumé financier
                    </h4>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-primary mb-1">
                        {formatCurrency(results.totalAmount)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Montant total des paiements historiques
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {results.paymentsImported} paiements seront enregistrés
                      </div>
                    </div>
                  </div>

                  {/* Errors */}
                  {results.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>{results.errors.length} erreur(s) détectée(s):</strong>
                        <ul className="list-disc ml-4 mt-2">
                          {results.errors.slice(0, 5).map((error, idx) => (
                            <li key={idx} className="text-sm">{error}</li>
                          ))}
                          {results.errors.length > 5 && (
                            <li className="text-sm">... et {results.errors.length - 5} autres erreurs</li>
                          )}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}