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
import { Checkbox } from '@/components/ui/checkbox';
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
  Receipt,
  MapPin
} from 'lucide-react';

interface RecouvrementRowData {
  rowIndex: number;
  agent: string;
  client: string;
  secteur: string;
  totalDuLoyers: number;
  totalDuDroitsTerre: number;
  totalDu: number;
  totalVerse: number;
  ecart: number;
  telephone?: string;
  adresse?: string;
}

interface ImportResult {
  agentsMatched: number;
  agentsCreated: number;
  clientsCreated: number;
  clientsMatched: number;
  propertiesCreated: number;
  propertiesMatched: number;
  locationsCreated: number;
  souscriptionsCreated: number;
  paymentsImported: number;
  receiptsGenerated: number;
  totalAmount: number;
  errors: string[];
}

interface ValidationResult {
  isValid: boolean;
  totalClients: number;
  totalAmount: number;
  agentStats: Array<{
    agent: string;
    clientsCount: number;
    totalDu: number;
    totalVerse: number;
    ecart: number;
  }>;
  duplicateClients: Array<{ name: string; count: number; rows: number[] }>;
  errors: string[];
}

export function ImportRecouvrementData({ inline = false }: { inline?: boolean } = {}): React.ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<RecouvrementRowData[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [simulationMode, setSimulationMode] = useState(true);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [simulationCompleted, setSimulationCompleted] = useState(false);
  const [clearExistingClients, setClearExistingClients] = useState(false);

  // Normalize string for matching
  const normalizeString = (str: string): string => {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
  };

  // Parse FCFA amounts from Excel cells
  const parseAmount = (value: any): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const str = String(value).replace(/[^\d,.-]/g, '').replace(/\s/g, '');
    const num = parseFloat(str.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

  // Validate data integrity
  function validateData(data: RecouvrementRowData[]): ValidationResult {
    const errors: string[] = [];
    const duplicateClients: ValidationResult['duplicateClients'] = [];
    const agentStats = new Map<string, { clientsCount: number; totalDu: number; totalVerse: number; ecart: number }>();

    // Check for duplicate clients
    const clientCounts = new Map<string, number[]>();
    data.forEach(row => {
      const key = normalizeString(row.client);
      if (!clientCounts.has(key)) clientCounts.set(key, []);
      clientCounts.get(key)!.push(row.rowIndex);
    });

    clientCounts.forEach((rows, name) => {
      if (rows.length > 1) {
        duplicateClients.push({ name, count: rows.length, rows });
      }
    });

    // Calculate agent statistics
    data.forEach(row => {
      const agentKey = normalizeString(row.agent);
      if (!agentStats.has(agentKey)) {
        agentStats.set(agentKey, { clientsCount: 0, totalDu: 0, totalVerse: 0, ecart: 0 });
      }
      const stats = agentStats.get(agentKey)!;
      stats.clientsCount++;
      stats.totalDu += row.totalDu;
      stats.totalVerse += row.totalVerse;
      stats.ecart += row.ecart;
    });

    // Validate data consistency
    data.forEach(row => {
      const calculatedTotal = row.totalDuLoyers + row.totalDuDroitsTerre;
      if (Math.abs(calculatedTotal - row.totalDu) > 1000) {
        errors.push(`Ligne ${row.rowIndex}: Total dû incohérent (${calculatedTotal} vs ${row.totalDu})`);
      }
      
      const calculatedEcart = row.totalDu - row.totalVerse;
      if (Math.abs(calculatedEcart - row.ecart) > 1000) {
        errors.push(`Ligne ${row.rowIndex}: Écart incohérent (${calculatedEcart} vs ${row.ecart})`);
      }
    });

    return {
      isValid: errors.length === 0,
      totalClients: data.length,
      totalAmount: data.reduce((sum, d) => sum + d.totalVerse, 0),
      agentStats: Array.from(agentStats.entries()).map(([agent, stats]) => ({
        agent,
        ...stats
      })),
      duplicateClients,
      errors
    };
  }

  // Parse Excel file for recouvrement data
  const parseExcelFile = async (file: File): Promise<RecouvrementRowData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const parsed: RecouvrementRowData[] = [];
          
          // Skip header rows and parse data
          for (let i = 2; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (row.length < 8) continue;

            const client = String(row[1] || '').trim();
            const agent = String(row[0] || '').trim();
            const secteur = String(row[2] || '').trim();
            
            if (!client || !agent) continue;

            parsed.push({
              rowIndex: i + 1,
              agent,
              client,
              secteur,
              totalDuLoyers: parseAmount(row[3]),
              totalDuDroitsTerre: parseAmount(row[4]),
              totalDu: parseAmount(row[5]),
              totalVerse: parseAmount(row[6]),
              ecart: parseAmount(row[7]),
              telephone: String(row[8] || '').trim(),
              adresse: String(row[9] || '').trim()
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
      toast({
        title: "Erreur",
        description: "Impossible de lire le fichier Excel",
        variant: "destructive"
      });
      console.error('Excel parsing error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Create or find agent by name
  const findOrCreateAgent = async (agentName: string, simulate: boolean) => {
    const { data: existingAgents } = await supabase
      .from('agents_recouvrement')
      .select('*')
      .ilike('nom', `%${agentName.split(' ')[0]}%`);

    if (existingAgents && existingAgents.length > 0) {
      return { agent: existingAgents[0], created: false };
    }

    if (simulate) {
      return { agent: null, created: false };
    }

    const nameParts = agentName.split(' ');
    const { data: newAgent, error } = await supabase
      .from('agents_recouvrement')
      .insert({
        nom: nameParts[0],
        prenom: nameParts.slice(1).join(' ') || '',
        code_agent: agentName.replace(/\s+/g, '_').toUpperCase(),
        statut: 'actif'
      })
      .select()
      .single();

    if (error) throw error;
    return { agent: newAgent, created: true };
  };

  // Create property by sector
  const createPropertyForSector = async (secteur: string, agent: any, simulate: boolean) => {
    if (simulate) return { property: null, created: false };

    const { data: existingProperty } = await supabase
      .from('proprietes')
      .select('*')
      .eq('nom', secteur)
      .single();

    if (existingProperty) {
      return { property: existingProperty, created: false };
    }

    const { data: newProperty, error } = await supabase
      .from('proprietes')
      .insert({
        nom: secteur,
        zone: secteur,
        usage: 'Mixte',
        statut: 'Occupé',
        agent_id: agent?.id
      })
      .select()
      .single();

    if (error) throw error;
    return { property: newProperty, created: true };
  };

  // Generate historical payments for a location
  const generateHistoricalPayments = async (locationId: string, totalAmount: number, simulate: boolean) => {
    if (simulate || totalAmount <= 0) return 0;

    let paymentsCount = 0;
    const monthlyPayments = Math.floor(totalAmount / 6); // Split into 6 monthly payments
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    for (let i = 0; i < 6; i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(startDate.getMonth() + i);
      
      const amount = i === 5 ? totalAmount - (monthlyPayments * 5) : monthlyPayments; // Adjust last payment
      
      if (amount > 0) {
        await supabase.rpc('pay_location_with_cash', {
          p_location_id: locationId,
          p_montant: amount,
          p_date_paiement: paymentDate.toISOString().split('T')[0],
          p_mode_paiement: 'espece',
          p_reference: `Import historique - Paiement ${i + 1}/6`,
          p_description: 'Import données recouvrement'
        });
        paymentsCount++;
      }
    }

    return paymentsCount;
  };

  // Main import function
  const importRecouvrementData = async (simulate: boolean = true) => {
    if (!file || previewData.length === 0) {
      toast({
        title: "Erreur de validation",
        description: "Aucun fichier sélectionné ou données manquantes",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setSimulationMode(simulate);

    try {
      const result: ImportResult = {
        agentsMatched: 0,
        agentsCreated: 0,
        clientsCreated: 0,
        clientsMatched: 0,
        propertiesCreated: 0,
        propertiesMatched: 0,
        locationsCreated: 0,
        souscriptionsCreated: 0,
        paymentsImported: 0,
        receiptsGenerated: 0,
        totalAmount: 0,
        errors: []
      };

      // Clear existing clients if requested
      if (clearExistingClients && !simulate) {
        await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }

      // Get existing data
      const { data: existingClients } = await supabase.from('clients').select('*');

      if (!existingClients) {
        throw new Error('Erreur lors de la récupération des clients existants');
      }

      const total = previewData.length;
      
      for (let i = 0; i < previewData.length; i++) {
        const row = previewData[i];
        setProgress((i / total) * 100);

        try {
          // Find or create agent
          const { agent, created: agentCreated } = await findOrCreateAgent(row.agent, simulate);
          if (agentCreated) result.agentsCreated++;
          else if (agent) result.agentsMatched++;

          // Find or create client
          let client = existingClients.find(c => 
            normalizeString(`${c.prenom || ''} ${c.nom}`) === normalizeString(row.client) ||
            normalizeString(c.nom) === normalizeString(row.client)
          );

          if (!client && !simulate) {
            const clientNames = row.client.split(' ');
            const { data: newClient, error: clientError } = await supabase
              .from('clients')
              .insert({
                nom: clientNames[clientNames.length - 1],
                prenom: clientNames.slice(0, -1).join(' ') || null,
                telephone_principal: row.telephone || null,
                adresse: row.adresse || null
              })
              .select()
              .single();

            if (clientError) throw clientError;
            client = newClient;
            result.clientsCreated++;
          } else if (client) {
            result.clientsMatched++;
          }

          // Create property for sector
          const { property, created: propertyCreated } = await createPropertyForSector(row.secteur, agent, simulate);
          if (propertyCreated) result.propertiesCreated++;
          else if (property) result.propertiesMatched++;

          if (!simulate && client && property) {
            // Create location if there are rental payments
            if (row.totalDuLoyers > 0) {
              const monthlyRent = Math.max(50000, row.totalDuLoyers / 12); // Estimate monthly rent
              
              const { data: newLocation, error: locationError } = await supabase
                .from('locations')
                .insert({
                  client_id: client.id,
                  propriete_id: property.id,
                  loyer_mensuel: monthlyRent,
                  caution: monthlyRent * 2,
                  date_debut: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year ago
                  statut: 'active',
                  type_contrat: 'historique'
                })
                .select()
                .single();

              if (locationError) throw locationError;
              
              result.locationsCreated++;
              
              // Generate historical rental payments
              const rentalPayments = await generateHistoricalPayments(newLocation.id, row.totalVerse * 0.7, simulate); // Assume 70% is rental
              result.paymentsImported += rentalPayments;
            }

            // Create subscription if there are land rights payments
            if (row.totalDuDroitsTerre > 0) {
              const { data: newSouscription, error: souscriptionError } = await supabase
                .from('souscriptions')
                .insert({
                  client_id: client.id,
                  propriete_id: property.id,
                  prix_total: row.totalDu,
                  apport_initial: 0,
                  montant_mensuel: Math.max(25000, row.totalDuDroitsTerre / 24),
                  nombre_mois: 24,
                  date_debut: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  solde_restant: Math.max(0, row.totalDu - row.totalVerse),
                  type_souscription: 'mise_en_garde',
                  type_bien: 'terrain',
                  statut: 'active'
                })
                .select()
                .single();

              if (souscriptionError) throw souscriptionError;
              
              result.souscriptionsCreated++;
              
              // Generate land rights payments
              const landRightsAmount = row.totalVerse * 0.3; // Assume 30% is land rights
              if (landRightsAmount > 0) {
                await supabase.rpc('pay_droit_terre_with_cash', {
                  p_souscription_id: newSouscription.id,
                  p_montant: landRightsAmount,
                  p_date_paiement: new Date().toISOString().split('T')[0],
                  p_mode_paiement: 'espece',
                  p_reference: `Import historique - ${row.client}`,
                  p_description: 'Import données recouvrement'
                });
                result.paymentsImported++;
              }
            }

            result.totalAmount += row.totalVerse;
          }
        } catch (error) {
          console.error(`Erreur ligne ${i + 1}:`, error);
          result.errors.push(`Ligne ${row.rowIndex}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
      }

      setProgress(100);
      setResults(result);
      
      if (simulate) {
        setSimulationCompleted(true);
        toast({
          title: "Simulation terminée",
          description: `${result.locationsCreated + result.souscriptionsCreated} contrats seraient créés`
        });
      } else {
        toast({
          title: "Import terminé",
          description: `${result.locationsCreated + result.souscriptionsCreated} contrats créés avec succès`
        });
      }

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Erreur d'import",
        description: "Erreur lors de l'import des données",
        variant: "destructive"
      });
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
              Étape 1: Sélection du fichier de recouvrement
            </CardTitle>
            <CardDescription>
              Importez votre fichier Excel contenant les données de situation de recouvrement
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
                <strong>Format attendu:</strong> AGENT, CLIENT, SECTEUR, TOTAL DU LOYERS, 
                TOTAL DU DROITS TERRE, TOTAL DU, TOTAL VERSE, ECART
              </AlertDescription>
            </Alert>

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
                Vérifiez vos données avant de procéder à l'import
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex flex-col items-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-primary">{validation.totalClients}</div>
                  <div className="text-sm text-muted-foreground">Clients</div>
                </div>
                <div className="flex flex-col items-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-primary">{validation.agentStats.length}</div>
                  <div className="text-sm text-muted-foreground">Agents</div>
                </div>
                <div className="flex flex-col items-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-primary">{formatCurrency(validation.totalAmount)}</div>
                  <div className="text-sm text-muted-foreground">Montant total</div>
                </div>
              </div>

              {/* Validation Errors */}
              {validation.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Erreurs détectées:</strong>
                    <ul className="list-disc ml-4 mt-2">
                      {validation.errors.slice(0, 5).map((error, idx) => (
                        <li key={idx} className="text-sm">{error}</li>
                      ))}
                      {validation.errors.length > 5 && (
                        <li className="text-sm">... et {validation.errors.length - 5} autres erreurs</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Agent Statistics */}
              <div>
                <h4 className="font-semibold mb-2">Répartition par agent:</h4>
                <ScrollArea className="h-48 border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead className="text-right">Clients</TableHead>
                        <TableHead className="text-right">Total dû</TableHead>
                        <TableHead className="text-right">Total versé</TableHead>
                        <TableHead className="text-right">Écart</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validation.agentStats.map((stat, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{stat.agent}</TableCell>
                          <TableCell className="text-right">{stat.clientsCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(stat.totalDu)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(stat.totalVerse)}</TableCell>
                          <TableCell className={`text-right ${stat.ecart > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(Math.abs(stat.ecart))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => importRecouvrementData(true)}
                  disabled={isImporting || validation.errors.length > 0}
                  variant="outline"
                >
                  {isImporting && simulationMode ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                      Simulation...
                    </>
                  ) : (
                    'Simuler l\'import'
                  )}
                </Button>
                
                {simulationCompleted && (
                  <Button
                    onClick={() => importRecouvrementData(false)}
                    disabled={isImporting}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isImporting && !simulationMode ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Import en cours...
                      </>
                    ) : (
                      'Confirmer l\'import'
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Import Progress */}
        {isImporting && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                {simulationMode ? 'Simulation en cours...' : 'Import en cours...'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2">
                Traitement: {progress.toFixed(0)}%
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Results */}
        {results && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="w-4 h-4" />
                Résultats de l'{simulationMode ? 'simulation' : 'import'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-primary">{results.agentsCreated + results.agentsMatched}</div>
                  <div className="text-sm text-muted-foreground">Agents</div>
                  <div className="text-xs text-muted-foreground">
                    {results.agentsCreated} créés, {results.agentsMatched} existants
                  </div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-primary">{results.clientsCreated + results.clientsMatched}</div>
                  <div className="text-sm text-muted-foreground">Clients</div>
                  <div className="text-xs text-muted-foreground">
                    {results.clientsCreated} créés, {results.clientsMatched} existants
                  </div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-primary">{results.locationsCreated + results.souscriptionsCreated}</div>
                  <div className="text-sm text-muted-foreground">Contrats</div>
                  <div className="text-xs text-muted-foreground">
                    {results.locationsCreated} locations, {results.souscriptionsCreated} souscriptions
                  </div>
                </div>
                <div className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold text-primary">{results.paymentsImported}</div>
                  <div className="text-sm text-muted-foreground">Paiements</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(results.totalAmount)}
                  </div>
                </div>
              </div>

              {results.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{results.errors.length} erreur(s) rencontrée(s):</strong>
                    <ScrollArea className="h-32 mt-2">
                      <ul className="list-disc ml-4">
                        {results.errors.map((error, idx) => (
                          <li key={idx} className="text-sm">{error}</li>
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
    </div>
  );

  const content = renderContent();

  if (inline) {
    return content;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          Importer données de recouvrement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import des données de recouvrement
          </DialogTitle>
          <DialogDescription>
            Importez les données de situation de recouvrement depuis votre fichier Excel
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}