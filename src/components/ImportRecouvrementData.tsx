import React, { useState, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  nomEtPrenoms: string;
  loyer: number;
  site: string;
  numeroTelephone: string;
  typeHabitation: string;
  arrieres: number;
  paiementsMensuels: number[];
  totalPaye: number;
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
  monthlyStats?: Array<{
    month: string;
    totalDue: number;
    totalPaid: number;
    recoveryRate: number;
    clientsPaid: number;
  }>;
  totalArrears?: number;
  globalRecoveryRate?: number;
}

export function ImportRecouvrementData({ inline = false }: { inline?: boolean } = {}): React.ReactElement {
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [operationType, setOperationType] = useState<'loyer' | 'droit_terre'>('loyer');
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // Nouveau: sélection du mois
  const [agents, setAgents] = useState<any[]>([]);
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

  // Load agents on component mount
  useEffect(() => {
    const loadAgents = async () => {
      const { data } = await supabase
        .from('agents_recouvrement')
        .select('*')
        .eq('statut', 'actif')
        .order('nom');
      
      setAgents(data || []);
    };
    
    loadAgents();
  }, []);

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

// Calculate monthly totals for detailed analysis - Amélioré
  const calculateMonthlyTotals = (data: RecouvrementRowData[]) => {
    const monthNames = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 
                      'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
    
    const monthlyStats = monthNames.map((month, index) => {
      const totalPaid = data.reduce((sum, row) => sum + (row.paiementsMensuels[index] || 0), 0);
      const totalDue = data.reduce((sum, row) => sum + row.loyer, 0); // Total dû pour ce mois = loyer mensuel de tous les clients
      const recoveryRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;
      
      return {
        month,
        totalDue,
        totalPaid,
        recoveryRate,
        clientsPaid: data.filter(row => (row.paiementsMensuels[index] || 0) > 0).length
      };
    });

    return monthlyStats;
  };

  // Validate data integrity
  function validateData(data: RecouvrementRowData[]): ValidationResult {
    const errors: string[] = [];
    const duplicateClients: ValidationResult['duplicateClients'] = [];

    // Check for duplicate clients
    const clientCounts = new Map<string, number[]>();
    data.forEach(row => {
      const key = normalizeString(row.nomEtPrenoms);
      if (!clientCounts.has(key)) clientCounts.set(key, []);
      clientCounts.get(key)!.push(row.rowIndex);
    });

    clientCounts.forEach((rows, name) => {
      if (rows.length > 1) {
        duplicateClients.push({ name, count: rows.length, rows });
      }
    });

    // Validate data consistency
    data.forEach(row => {
      if (row.loyer <= 0) {
        errors.push(`Ligne ${row.rowIndex}: Montant loyer invalide (${row.loyer})`);
      }
      
      if (row.arrieres < 0) {
        errors.push(`Ligne ${row.rowIndex}: Arriérés négatifs (${row.arrieres})`);
      }

      const calculatedTotal = row.paiementsMensuels.reduce((sum, p) => sum + p, 0);
      if (Math.abs(calculatedTotal - row.totalPaye) > 1000) {
        errors.push(`Ligne ${row.rowIndex}: Total payé incohérent (${calculatedTotal} vs ${row.totalPaye})`);
      }
    });

    const selectedAgentName = agents.find(a => a.id === selectedAgent)?.nom || 'Agent sélectionné';
    const totalArrears = data.reduce((sum, d) => sum + d.arrieres, 0);
    const totalPaid = data.reduce((sum, d) => sum + d.totalPaye, 0);
    
    // Calcul amélioré du total dû : arriérés + loyers pour la période
    const monthlyTotals = calculateMonthlyTotals(data);
    const totalDueForPeriod = monthlyTotals.reduce((sum, m) => sum + m.totalDue, 0);
    const totalDue = totalArrears + totalDueForPeriod;
    
    return {
      isValid: errors.length === 0,
      totalClients: data.length,
      totalAmount: totalPaid,
      agentStats: [{
        agent: selectedAgentName,
        clientsCount: data.length,
        totalDu: totalDue,
        totalVerse: totalPaid,
        ecart: totalArrears // Arriérés seulement
      }],
      duplicateClients,
      errors,
      monthlyStats: monthlyTotals,
      totalArrears,
      globalRecoveryRate: totalDue > 0 ? (totalPaid / totalDue) * 100 : 0
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
          
          // Skip header rows and parse data starting from row 3 (index 2)
          for (let i = 2; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (row.length < 6) continue;

            const nomEtPrenoms = String(row[0] || '').trim();
            const loyer = parseAmount(row[1]);
            const site = String(row[2] || '').trim();
            const numeroTelephone = String(row[3] || '').trim();
            const typeHabitation = String(row[4] || '').trim();
            const arrieres = parseAmount(row[5]);
            
            if (!nomEtPrenoms || !site) continue;

            // Parse monthly payments (columns 6-17: JANVIER to DÉCEMBRE)
            const paiementsMensuels: number[] = [];
            for (let j = 6; j < 18; j++) {
              paiementsMensuels.push(parseAmount(row[j]));
            }

            const totalPaye = paiementsMensuels.reduce((sum, p) => sum + p, 0);

            parsed.push({
              rowIndex: i + 1,
              nomEtPrenoms,
              loyer,
              site,
              numeroTelephone,
              typeHabitation,
              arrieres,
              paiementsMensuels,
              totalPaye
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

    if (!selectedAgent) {
      toast({
        title: "Agent requis",
        description: "Veuillez sélectionner un agent avant d'importer le fichier",
        variant: "destructive"
      });
      return;
    }

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

  // Get selected agent
  const getSelectedAgent = async () => {
    const { data: agent } = await supabase
      .from('agents_recouvrement')
      .select('*')
      .eq('id', selectedAgent)
      .single();
    
    return agent;
  };

  // Create property by site
  const createPropertyForSite = async (site: string, typeHabitation: string, agent: any, simulate: boolean) => {
    if (simulate) return { property: null, created: false };

    const { data: existingProperty } = await supabase
      .from('proprietes')
      .select('*')
      .eq('nom', site)
      .eq('agent_id', agent?.id)
      .maybeSingle();

    if (existingProperty) {
      return { property: existingProperty, created: false };
    }

    const { data: newProperty, error } = await supabase
      .from('proprietes')
      .insert({
        nom: site,
        zone: site,
        usage: typeHabitation || 'Habitation',
        statut: 'Occupé',
        agent_id: agent?.id
      })
      .select()
      .single();

    if (error) throw error;
    return { property: newProperty, created: true };
  };

  // Generate monthly payments from Excel data - Amélioré pour support import par mois
  const generateMonthlyPayments = async (contractId: string, contractType: 'location' | 'souscription', paiementsMensuels: number[], simulate: boolean) => {
    // En mode simulation, compter seulement les paiements qui seraient importés
    if (simulate) {
      if (selectedMonth === 'all') {
        return paiementsMensuels.filter(p => p > 0).length;
      } else {
        const monthIndex = parseInt(selectedMonth);
        return paiementsMensuels[monthIndex] > 0 ? 1 : 0;
      }
    }

    let paymentsCount = 0;
    const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                       'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    
    const currentYear = new Date().getFullYear();
    
    // Si un mois spécifique est sélectionné, importer seulement ce mois
    if (selectedMonth !== 'all') {
      const monthIndex = parseInt(selectedMonth);
      const montant = paiementsMensuels[monthIndex];
      
      if (montant > 0) {
        const paymentDate = new Date(currentYear, monthIndex, 15).toISOString().split('T')[0];
        
        try {
          if (contractType === 'location') {
            await supabase.rpc('pay_location_with_cash', {
              p_location_id: contractId,
              p_montant: montant,
              p_date_paiement: paymentDate,
              p_mode_paiement: 'espece',
              p_reference: `Import ${monthNames[monthIndex]} ${currentYear}`,
              p_description: `Import données recouvrement - ${monthNames[monthIndex]}`
            });
          } else {
            if (operationType === 'droit_terre') {
              await supabase.rpc('pay_droit_terre_with_cash', {
                p_souscription_id: contractId,
                p_montant: montant,
                p_date_paiement: paymentDate,
                p_mode_paiement: 'espece',
                p_reference: `Import ${monthNames[monthIndex]} ${currentYear}`,
                p_description: `Import données recouvrement - ${monthNames[monthIndex]}`
              });
            } else {
              await supabase.rpc('pay_souscription_with_cash', {
                p_souscription_id: contractId,
                p_montant: montant,
                p_date_paiement: paymentDate,
                p_mode_paiement: 'espece',
                p_reference: `Import ${monthNames[monthIndex]} ${currentYear}`,
                p_description: `Import données recouvrement - ${monthNames[monthIndex]}`
              });
            }
          }
          paymentsCount++;
        } catch (error) {
          console.error(`Erreur paiement ${monthNames[monthIndex]}:`, error);
        }
      }
    } else {
      // Import de tous les mois
      for (let i = 0; i < paiementsMensuels.length; i++) {
        const montant = paiementsMensuels[i];
        if (montant <= 0) continue;

        const paymentDate = new Date(currentYear, i, 15).toISOString().split('T')[0];
        
        try {
          if (contractType === 'location') {
            await supabase.rpc('pay_location_with_cash', {
              p_location_id: contractId,
              p_montant: montant,
              p_date_paiement: paymentDate,
              p_mode_paiement: 'espece',
              p_reference: `Import ${monthNames[i]} ${currentYear}`,
              p_description: 'Import données recouvrement'
            });
          } else {
            if (operationType === 'droit_terre') {
              await supabase.rpc('pay_droit_terre_with_cash', {
                p_souscription_id: contractId,
                p_montant: montant,
                p_date_paiement: paymentDate,
                p_mode_paiement: 'espece',
                p_reference: `Import ${monthNames[i]} ${currentYear}`,
                p_description: 'Import données recouvrement'
              });
            } else {
              await supabase.rpc('pay_souscription_with_cash', {
                p_souscription_id: contractId,
                p_montant: montant,
                p_date_paiement: paymentDate,
                p_mode_paiement: 'espece',
                p_reference: `Import ${monthNames[i]} ${currentYear}`,
                p_description: 'Import données recouvrement'
              });
            }
          }
          paymentsCount++;
        } catch (error) {
          console.error(`Erreur paiement ${monthNames[i]}:`, error);
        }
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

      // Clear existing clients if requested (uniquement en mode réel)
      if (clearExistingClients && !simulate) {
        await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }

      // Get agent and existing data
      const agent = await getSelectedAgent();
      
      // En mode simulation, on évite les appels DB coûteux
      const { data: existingClients } = simulate ? 
        { data: [] } : 
        await supabase.from('clients').select('*');

      if (!existingClients) {
        throw new Error('Erreur lors de la récupération des clients existants');
      }

      if (!agent) {
        throw new Error('Agent sélectionné introuvable');
      }

      result.agentsMatched = 1; // Agent déjà sélectionné

      const total = previewData.length;
      
      for (let i = 0; i < previewData.length; i++) {
        const row = previewData[i];
        setProgress((i / total) * 100);

        try {
          // Find or create client
          let client = null;
          
          if (simulate) {
            // En simulation, simuler la création sans faire les appels DB
            result.clientsCreated++;
            client = { id: 'simulated-client', nom: 'Client simulé' };
          } else {
            client = existingClients.find(c => 
              normalizeString(`${c.prenom || ''} ${c.nom}`) === normalizeString(row.nomEtPrenoms) ||
              normalizeString(c.nom) === normalizeString(row.nomEtPrenoms)
            );

            if (!client) {
              const clientNames = row.nomEtPrenoms.split(' ');
              const { data: newClient, error: clientError } = await supabase
                .from('clients')
                .insert({
                  nom: clientNames[clientNames.length - 1],
                  prenom: clientNames.slice(0, -1).join(' ') || null,
                  telephone_principal: row.numeroTelephone || null
                })
                .select()
                .single();

              if (clientError) throw clientError;
              client = newClient;
              result.clientsCreated++;
            } else {
              result.clientsMatched++;
            }
          }

          // Create property for site
          const { property, created: propertyCreated } = await createPropertyForSite(row.site, row.typeHabitation, agent, simulate);
          if (simulate) {
            result.propertiesCreated++;
          } else {
            if (propertyCreated) result.propertiesCreated++;
            else if (property) result.propertiesMatched++;
          }

          if (client && (property || simulate)) {
            if (operationType === 'loyer') {
              // Create location
              const { data: newLocation, error: locationError } = await supabase
                .from('locations')
                .insert({
                  client_id: client.id,
                  propriete_id: property.id,
                  loyer_mensuel: row.loyer,
                  caution: row.loyer * 2,
                  date_debut: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  statut: 'active',
                  type_contrat: 'historique'
                })
                .select()
                .single();

              if (locationError) throw locationError;
              
              result.locationsCreated++;
              
              // Generate monthly payments
              const paymentsCount = await generateMonthlyPayments(newLocation.id, 'location', row.paiementsMensuels, simulate);
              result.paymentsImported += paymentsCount;
            } else {
              // Create subscription for droit de terre
              const totalDu = row.arrieres + (row.loyer * 12); // Arriérés + montant annuel
              
              const { data: newSouscription, error: souscriptionError } = await supabase
                .from('souscriptions')
                .insert({
                  client_id: client.id,
                  propriete_id: property.id,
                  prix_total: totalDu,
                  apport_initial: 0,
                  montant_mensuel: row.loyer,
                  nombre_mois: 240, // 20 ans pour droit de terre
                  date_debut: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  solde_restant: Math.max(0, totalDu - row.totalPaye),
                  type_souscription: 'mise_en_garde',
                  type_bien: 'terrain',
                  statut: 'active',
                  montant_droit_terre_mensuel: row.loyer
                })
                .select()
                .single();

              if (souscriptionError) throw souscriptionError;
              
              result.souscriptionsCreated++;
              
              // Generate monthly payments
              const paymentsCount = await generateMonthlyPayments(newSouscription.id, 'souscription', row.paiementsMensuels, simulate);
              result.paymentsImported += paymentsCount;
            }

            result.totalAmount += row.totalPaye;
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
        const monthInfo = selectedMonth === 'all' ? 'tous les mois' : ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][parseInt(selectedMonth)];
        toast({
          title: "Simulation terminée",
          description: `${result.locationsCreated + result.souscriptionsCreated} contrats seraient créés, ${result.paymentsImported} paiements pour ${monthInfo}`
        });
      } else {
        const monthInfo = selectedMonth === 'all' ? 'tous les mois' : ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][parseInt(selectedMonth)];
        toast({
          title: "Import terminé",
          description: `${result.locationsCreated + result.souscriptionsCreated} contrats créés, ${result.paymentsImported} paiements importés pour ${monthInfo}`
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
        {/* Step 1: Agent and Operation Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-4 h-4" />
              Étape 1: Configuration de l'import
            </CardTitle>
            <CardDescription>
              Sélectionnez l'agent responsable et le type d'opération
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-select">Agent de recouvrement</Label>
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
                <Label htmlFor="operation-type">Type d'opération</Label>
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
            </div>

            {/* Sélecteur de mois pour import granulaire */}
            <div className="space-y-2">
              <Label htmlFor="month-select">Mois à importer</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un mois ou tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les mois (Janvier à Décembre)</SelectItem>
                  <SelectItem value="0">Janvier</SelectItem>
                  <SelectItem value="1">Février</SelectItem>
                  <SelectItem value="2">Mars</SelectItem>
                  <SelectItem value="3">Avril</SelectItem>
                  <SelectItem value="4">Mai</SelectItem>
                  <SelectItem value="5">Juin</SelectItem>
                  <SelectItem value="6">Juillet</SelectItem>
                  <SelectItem value="7">Août</SelectItem>
                  <SelectItem value="8">Septembre</SelectItem>
                  <SelectItem value="9">Octobre</SelectItem>
                  <SelectItem value="10">Novembre</SelectItem>
                  <SelectItem value="11">Décembre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                L'agent sélectionné sera automatiquement assigné à toutes les propriétés importées.
                Le type d'opération détermine si les paiements seront traités comme des loyers ou des droits de terre.
                <br />
                <strong>Import par mois :</strong> Sélectionnez un mois spécifique pour importer uniquement les paiements de ce mois, 
                ou choisissez "Tous les mois" pour un import complet.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Step 2: File Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="w-4 h-4" />
              Étape 2: Sélection du fichier Excel
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
                disabled={isAnalyzing || isImporting || !selectedAgent}
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
                <strong>Format attendu:</strong> NOM ET PRENOMS, LOYER, SITES, NUMERO TELEPHONE, 
                TYPE D'HABITATION, ARRIERES, JANVIER à DÉCEMBRE (paiements mensuels)
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

        {/* Step 3: Data Preview & Validation */}
        {showPreview && validation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="w-4 h-4" />
                Étape 3: Aperçu et validation des données
              </CardTitle>
              <CardDescription>
                Vérifiez vos données avant de procéder à l'import - Agent: {agents.find(a => a.id === selectedAgent)?.prenom} {agents.find(a => a.id === selectedAgent)?.nom} - Type: {operationType === 'loyer' ? 'Loyer' : 'Droit de terre'} - Période: {selectedMonth === 'all' ? 'Tous les mois' : ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][parseInt(selectedMonth)]}
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

              {/* Data Preview Table - Afficher TOUS les clients */}
              <div>
                <h4 className="font-semibold mb-2">Aperçu des données ({previewData.length} clients au total):</h4>
                <ScrollArea className="h-96 border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom et Prénoms</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead>Loyer/Mois</TableHead>
                        <TableHead>Téléphone</TableHead>
                        <TableHead>Arriérés</TableHead>
                        <TableHead>Total Payé</TableHead>
                        <TableHead>Paiements mensuels</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{row.nomEtPrenoms}</TableCell>
                          <TableCell>{row.site}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.loyer)}</TableCell>
                          <TableCell>{row.numeroTelephone}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(row.arrieres)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(row.totalPaye)}</TableCell>
                          <TableCell className="text-xs">
                            {row.paiementsMensuels.map((montant, mIdx) => (
                              montant > 0 ? (
                                <Badge key={mIdx} variant="secondary" className="mr-1 mb-1 text-xs">
                                  {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][mIdx]}: {formatCurrency(montant)}
                                </Badge>
                              ) : null
                            ))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Tableau de synthèse mensuelle */}
              {validation.monthlyStats && (
                <div>
                  <h4 className="font-semibold mb-2">Synthèse mensuelle des paiements:</h4>
                  <ScrollArea className="h-48 border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mois</TableHead>
                          <TableHead>Total dû</TableHead>
                          <TableHead>Total payé</TableHead>
                          <TableHead>Clients payeurs</TableHead>
                          <TableHead>Taux recouvrement</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {validation.monthlyStats.map((month, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{month.month}</TableCell>
                            <TableCell className="text-right">{formatCurrency(month.totalDue)}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(month.totalPaid)}</TableCell>
                            <TableCell className="text-center">{month.clientsPaid}/{previewData.length}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={month.recoveryRate > 80 ? "default" : month.recoveryRate > 50 ? "secondary" : "destructive"}>
                                {month.recoveryRate.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}

              {/* Summary Statistics - Amélioration avec plus de détails */}
              <div>
                <h4 className="font-semibold mb-2">Résumé financier pour l'agent sélectionné:</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-2xl font-bold text-primary">{validation.agentStats[0]?.clientsCount || 0}</div>
                    <div className="text-sm text-muted-foreground">Clients</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(validation.agentStats[0]?.totalDu || 0)}</div>
                    <div className="text-sm text-muted-foreground">Total dû</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(validation.agentStats[0]?.totalVerse || 0)}</div>
                    <div className="text-sm text-muted-foreground">Total versé</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className={`text-2xl font-bold ${(validation.agentStats[0]?.ecart || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(validation.agentStats[0]?.ecart || 0))}
                    </div>
                    <div className="text-sm text-muted-foreground">Arriérés totaux</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className={`text-2xl font-bold ${(validation.globalRecoveryRate || 0) > 80 ? 'text-green-600' : (validation.globalRecoveryRate || 0) > 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {(validation.globalRecoveryRate || 0).toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Taux recouvrement</div>
                  </div>
                </div>
                
                {/* Totaux mensuels agrégés */}
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h5 className="font-medium mb-2">Totaux par période (Janvier à Décembre):</h5>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Total loyers mensuels dûs:</span>
                      <div className="text-lg font-bold text-blue-600">
                        {formatCurrency(validation.monthlyStats?.reduce((sum, m) => sum + m.totalDue, 0) || 0)}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Total paiements reçus:</span>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency(validation.monthlyStats?.reduce((sum, m) => sum + m.totalPaid, 0) || 0)}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Moyenne mensuelle:</span>
                      <div className="text-lg font-bold">
                        {formatCurrency((validation.monthlyStats?.reduce((sum, m) => sum + m.totalPaid, 0) || 0) / 12)}
                      </div>
                    </div>
                  </div>
                </div>
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