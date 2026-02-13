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
import { apiClient } from '@/integrations/api/client';
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
  warnings?: string[];
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
  const [operationType, setOperationType] = useState<'loyer' | 'droit_terre' | 'souscription'>('loyer');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString()); // Import mensuel uniquement
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear()); // Année de l'import
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentCashBalance, setCurrentCashBalance] = useState<number | null>(null);
  const [isCheckingCash, setIsCheckingCash] = useState(false);
  const [cashCheckError, setCashCheckError] = useState<string | null>(null);
  
  // États pour la pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [previewSearch, setPreviewSearch] = useState('');

  // Load agents on component mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const data = await apiClient.select({
          table: 'agents_recouvrement',
          filters: [{ op: 'eq', column: 'statut', value: 'actif' }],
          orderBy: { column: 'nom', ascending: true }
        });
        setAgents(data || []);
      } catch (error) {
        console.error('Erreur chargement agents:', error);
        setAgents([]);
      }
    };

    loadAgents();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [previewSearch]);

  useEffect(() => {
    if (!showPreview || previewData.length === 0) {
      setCurrentCashBalance(null);
      setCashCheckError(null);
      return;
    }

    let isCancelled = false;
    const checkCash = async () => {
      setIsCheckingCash(true);
      setCashCheckError(null);
      try {
        const balance = await apiClient.getCurrentCashBalance();
        if (!isCancelled) {
          setCurrentCashBalance(balance);
        }
      } catch (error) {
        if (!isCancelled) {
          setCurrentCashBalance(null);
          setCashCheckError(error instanceof Error ? error.message : "Impossible de vérifier le solde de caisse");
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingCash(false);
        }
      }
    };

    checkCash();
    return () => {
      isCancelled = true;
    };
  }, [showPreview, previewData, selectedMonth]);

  // Normalize string for matching
  const normalizeString = (str: string): string => {
    return str.toLowerCase().trim().replace(/\s+/g, ' ');
  };

  const importTag = 'import';

  // Parse FCFA amounts from Excel cells
  const parseAmount = (value: any): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const str = String(value).replace(/[^\d,.-]/g, '').replace(/\s/g, '');
    const num = parseFloat(str.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

// Calculate monthly totals for detailed analysis - Filtré pour les mois avec paiements
  const calculateMonthlyTotals = (data: RecouvrementRowData[]) => {
    const monthNames = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 
                      'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
    
    const allMonthlyStats = monthNames.map((month, index) => {
      const totalPaid = data.reduce((sum, row) => sum + (row.paiementsMensuels[index] || 0), 0);
      const totalDue = data.reduce((sum, row) => sum + row.loyer, 0); // Total dû pour ce mois = loyer mensuel de tous les clients
      const recoveryRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;
      const clientsPaid = data.filter(row => (row.paiementsMensuels[index] || 0) > 0).length;
      
      return {
        month,
        totalDue,
        totalPaid,
        recoveryRate,
        clientsPaid
      };
    });

    // Filtrer seulement les mois qui ont au moins un paiement
    const monthlyStats = allMonthlyStats.filter(stat => stat.totalPaid > 0 || stat.clientsPaid > 0);

    return monthlyStats;
  };

  // Validate data integrity
  function validateData(data: RecouvrementRowData[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
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

    // Validate data consistency - warnings only (ne bloque pas l'import)
    data.forEach(row => {
      if (row.loyer <= 0) {
        warnings.push(`Ligne ${row.rowIndex}: Montant loyer à 0 ou vide (${row.loyer})`);
      }

      if (row.arrieres < 0) {
        warnings.push(`Ligne ${row.rowIndex}: Arriérés négatifs (${row.arrieres})`);
      }

      const calculatedTotal = row.paiementsMensuels.reduce((sum, p) => sum + p, 0);
      if (Math.abs(calculatedTotal - row.totalPaye) > 1000) {
        warnings.push(`Ligne ${row.rowIndex}: Total payé incohérent (${calculatedTotal} vs ${row.totalPaye})`);
      }
    });

    const selectedAgentName = agents.find(a => a.id === selectedAgent)?.nom || 'Agent sélectionné';
    const totalArrears = data.reduce((sum, d) => sum + d.arrieres, 0);
    const totalPaid = data.reduce((sum, d) => sum + d.totalPaye, 0);
    
    // Base mensuelle: le taux de recouvrement compare versements du mois vs du du mois
    const monthlyTotals = calculateMonthlyTotals(data);
    const totalDueForPeriod = monthlyTotals.reduce((sum, m) => sum + m.totalDue, 0);
    const totalDue = totalDueForPeriod;
    
    return {
      isValid: true, // Ne jamais bloquer l'import - les problèmes sont des warnings
      totalClients: data.length,
      totalAmount: totalPaid,
      agentStats: [{
        agent: selectedAgentName,
        clientsCount: data.length,
        totalDu: totalDue,
        totalVerse: totalPaid,
        ecart: totalDue - totalPaid
      }],
      duplicateClients,
      errors, // Toujours vide maintenant (pas de blocage)
      warnings, // Avertissements non-bloquants
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

          const normalizeHeader = (value: any) => {
            if (!value) return '';
            return String(value)
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toUpperCase()
              .trim();
          };

          // Detect header row
          let headerRowIndex = 2;
          let headerRow: any[] = [];

          for (let i = 0; i < Math.min(jsonData.length, 5); i++) {
            const row = jsonData[i] as any[];
            if (!row) continue;
            const normalizedCells = row.map(normalizeHeader);
            if (normalizedCells.includes('NOM') || normalizedCells.includes('NOM ET PRENOMS')) {
              headerRowIndex = i;
              headerRow = row;
              break;
            }
          }

          if (headerRow.length === 0) {
            headerRow = (jsonData[headerRowIndex] as any[]) || [];
          }

          const headerCells = headerRow.map(normalizeHeader);
          const findCol = (patterns: RegExp[], fallback: number) => {
            for (let i = 0; i < headerCells.length; i++) {
              const cell = headerCells[i];
              if (patterns.some((p) => p.test(cell))) return i;
            }
            return fallback;
          };

          const colNom = findCol([/NOM/, /CLIENT/], 0);
          const colLoyer = findCol([/LOYER/, /MONTANT/], 1);
          const colSite = findCol([/SITE/], 2);
          const colTel = findCol([/TEL/], 3);
          const colType = findCol([/TYPE/, /HABITATION/], 4);
          const colArrieres = findCol([/ARRIERE/, /ARREAR/], 5);

          const selectedMonthColumnIndex = 6; // Colonne G: montant du mois sélectionné

          // Parse data starting after header row
          for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length < 1) continue;

            const nomEtPrenoms = String(row[colNom] || '').trim();
            if (!nomEtPrenoms) continue; // Seul le nom est obligatoire

            const loyer = parseAmount(row[colLoyer]);
            const site = String(row[colSite] || '').trim() || 'Non spécifié';
            const numeroTelephone = String(row[colTel] || '').trim();
            const typeHabitation = String(row[colType] || '').trim();
            const arrieres = parseAmount(row[colArrieres]);

            // Paiement mensuel unique: colonne G contient le montant du mois sélectionné
            const monthIndex = parseInt(selectedMonth);
            const amount = parseAmount(row[selectedMonthColumnIndex]);
            const paiementsMensuels: number[] = new Array(12).fill(0);
            if (!isNaN(monthIndex) && monthIndex >= 0 && monthIndex < 12) {
              paiementsMensuels[monthIndex] = amount;
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
    try {
      const agents = await apiClient.select({
        table: 'agents_recouvrement',
        filters: [{ op: 'eq', column: 'id', value: selectedAgent }],
        single: true
      });
      return agents;
    } catch (error) {
      console.error('Erreur récupération agent:', error);
      return null;
    }
  };

  // Create property by site
  const createPropertyForSite = async (site: string, typeHabitation: string, agent: any, simulate: boolean) => {
    // Mapper le type d'opération vers le champ usage
    const usage = operationType === 'loyer' ? 'Location' : 'Bail';

    if (simulate) {
      // En simulation, retourner une propriété fictive avec un ID valide
      return {
        property: {
          id: `simulated-property-${Date.now()}`,
          nom: site,
          zone: site,
          usage: usage,
          statut: 'Occupé',
          agent_id: agent?.id
        },
        created: true
      };
    }

    try {
      // Chercher propriété existante
      const existingProperties = await apiClient.select({
        table: 'proprietes',
        filters: [
          { op: 'eq', column: 'nom', value: site },
          { op: 'eq', column: 'agent_id', value: agent?.id }
        ]
      });

      if (existingProperties && existingProperties.length > 0) {
        return { property: existingProperties[0], created: false };
      }

      // Créer nouvelle propriété
      await apiClient.insert({
        table: 'proprietes',
        values: {
          nom: site,
          zone: site,
          usage: usage,
          statut: 'Occupé',
          agent_id: agent?.id,
          import_tag: importTag
        }
      });

      // Récupérer la propriété créée
      const newProperties = await apiClient.select({
        table: 'proprietes',
        filters: [
          { op: 'eq', column: 'nom', value: site },
          { op: 'eq', column: 'agent_id', value: agent?.id }
        ],
        orderBy: { column: 'created_at', ascending: false },
        limit: 1
      });

      return { property: newProperties[0], created: true };
    } catch (error) {
      console.error('Erreur création propriété:', error);
      throw error;
    }
  };

  // Generate monthly payments - simplified for automatic payment generation
  const generateMonthlyPayments = async (contractId: string, contractType: 'location' | 'souscription', paiementsMensuels: number[], simulate: boolean, clientName: string = '') => {
    // En mode simulation, compter seulement le paiement du mois sélectionné
    if (simulate) {
      const monthIndex = parseInt(selectedMonth);
      return paiementsMensuels[monthIndex] > 0 ? 1 : 0;
    }

    // Skip invalid contract IDs silently
    if (!contractId || contractId.startsWith('simulated')) {
      return 0;
    }

    // Default to valid array if invalid
    if (!Array.isArray(paiementsMensuels) || paiementsMensuels.length !== 12) {
      paiementsMensuels = new Array(12).fill(0);
    }

    let paymentsCount = 0;
    const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                       'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

    const currentYear = selectedYear;

    // Process selected month only
    const monthIndex = parseInt(selectedMonth);
    const montant = paiementsMensuels[monthIndex];

    if (montant > 0) {
      const paymentDate = new Date(currentYear, monthIndex, 15).toISOString().split('T')[0];
      const moisConcerne = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}`;

      try {
        if (contractType === 'location') {
          await apiClient.payLocationWithCash({
            location_id: contractId,
            montant: montant,
            mode_paiement: 'especes',
            reference: `Import ${monthNames[monthIndex]} ${currentYear}`,
            date_paiement: paymentDate,
            mois_concerne: moisConcerne
          });
        } else {
          if (operationType === 'droit_terre') {
            await apiClient.payDroitTerreWithCash({
              souscription_id: contractId,
              montant: montant,
              mode_paiement: 'especes',
              reference: `Import ${monthNames[monthIndex]} ${currentYear}`,
              date_paiement: paymentDate
            });
          } else {
            await apiClient.paySouscriptionWithCash({
              souscription_id: contractId,
              montant: montant,
              mode_paiement: 'especes',
              reference: `Import ${monthNames[monthIndex]} ${currentYear}`,
              date_paiement: paymentDate
            });
          }
        }
        paymentsCount++;
      } catch (error) {
        // Silently continue on errors
      }
    }

    return paymentsCount;
  };

  // Process single row sequentially: Client → Propriété → Contrat → Paiement → Reçu (automatique)
  const processRowSequentially = async (
    row: RecouvrementRowData, 
    agent: any, 
    operationType: 'loyer' | 'droit_terre' | 'souscription', 
    results: ImportResult, 
    simulate: boolean
  ) => {
    try {
      // ÉTAPE 1: Créer/récupérer le client
      const client = await createOrFindClient(row, simulate);
      if (client.created) results.clientsCreated++;
      else results.clientsMatched++;

      // ÉTAPE 2: Créer/récupérer la propriété
      const { property } = await createPropertyForSite(row.site, row.typeHabitation, agent, simulate);
      if (property) {
        results.propertiesCreated++;
      }

      // ÉTAPE 3: Créer le contrat avec le montant du fichier Excel
      const contract = await createContract(client, property, row, operationType, simulate);
      if (contract) {
        if (operationType === 'loyer') {
          results.locationsCreated++;
        } else {
          results.souscriptionsCreated++;
        }
      }

      // ÉTAPE 4: Simuler ou créer les paiements avec montants du fichier Excel
      if (contract) {
        if (simulate) {
          // En simulation, compter les paiements qui seraient créés
          const paymentsCount = simulatePaymentsCount(row.paiementsMensuels);
          results.paymentsImported += paymentsCount;
          // Chaque paiement génère un reçu
          results.receiptsGenerated += paymentsCount;
        } else {
          // En mode réel, créer les paiements (les reçus sont générés par le backend)
          const paymentsCreated = await createPaymentsFromExcel(contract, operationType, row.paiementsMensuels);
          results.paymentsImported += paymentsCreated;
          results.receiptsGenerated += paymentsCreated;
        }
      }

      results.totalAmount += row.totalPaye;
    } catch (error) {
      console.error('Erreur lors du traitement de la ligne:', row.rowIndex, error);
      results.errors.push(`Ligne ${row.rowIndex}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  // Simulate payments count
  const simulatePaymentsCount = (paiementsMensuels: number[]) => {
    const monthIndex = parseInt(selectedMonth);
    return paiementsMensuels[monthIndex] > 0 ? 1 : 0;
  };

  // Create or find client
  const createOrFindClient = async (row: RecouvrementRowData, simulate: boolean) => {
    if (simulate) {
      return { id: `sim-client-${Date.now()}`, created: true };
    }

    try {
      // Séparer nom et prénom
      const nameParts = row.nomEtPrenoms.trim().split(/\s+/);
      const nom = nameParts[nameParts.length - 1];
      const prenom = nameParts.slice(0, -1).join(' ');

      // Chercher client existant par nom ET prénom (recherche exacte)
      let existingClients: any[] = [];
      if (prenom) {
        existingClients = await apiClient.select({
          table: 'clients',
          filters: [
            { op: 'eq', column: 'nom', value: nom },
            { op: 'eq', column: 'prenom', value: prenom }
          ]
        });
      }

      // Si pas trouvé par nom+prénom, chercher juste par nom exact
      if (!existingClients || existingClients.length === 0) {
        existingClients = await apiClient.select({
          table: 'clients',
          filters: [{ op: 'eq', column: 'nom', value: nom }]
        });
        // Vérifier que le prénom correspond aussi si on a un prénom
        if (prenom && existingClients && existingClients.length > 0) {
          const exactMatch = existingClients.find((c: any) =>
            normalizeString(c.prenom || '') === normalizeString(prenom)
          );
          if (exactMatch) {
            return { ...exactMatch, created: false };
          }
        } else if (existingClients && existingClients.length > 0) {
          return { ...existingClients[0], created: false };
        }
      } else {
        return { ...existingClients[0], created: false };
      }

      await apiClient.insert({
        table: 'clients',
        values: {
          nom,
          prenom,
          telephone_principal: row.numeroTelephone,
          import_tag: importTag
        }
      });

      // Récupérer le client créé
      const newClients = await apiClient.select({
        table: 'clients',
        filters: [
          { op: 'eq', column: 'nom', value: nom },
          { op: 'eq', column: 'prenom', value: prenom }
        ],
        orderBy: { column: 'created_at', ascending: false },
        limit: 1
      });

      return { ...newClients[0], created: true };
    } catch (error) {
      console.error('Erreur création client:', error);
      throw new Error(`Impossible de créer le client ${row.nomEtPrenoms}`);
    }
  };

  // Create contract (location or souscription)
  const createContract = async (client: any, property: any, row: RecouvrementRowData, operationType: 'loyer' | 'droit_terre' | 'souscription', simulate: boolean) => {
    if (simulate) {
      return { id: `sim-contract-${Date.now()}` };
    }

    const currentDate = new Date().toISOString().split('T')[0];

    try {
      if (operationType === 'loyer') {
        // Créer location
        await apiClient.insert({
          table: 'locations',
          values: {
            client_id: client.id,
            propriete_id: property.id,
            loyer_mensuel: row.loyer,
            date_debut: new Date(currentDate).toISOString(),
            statut: 'active',
            import_tag: importTag
          }
        });

        // Récupérer la location créée
        const locations = await apiClient.select({
          table: 'locations',
          filters: [
            { op: 'eq', column: 'client_id', value: client.id },
            { op: 'eq', column: 'propriete_id', value: property.id }
          ],
          orderBy: { column: 'created_at', ascending: false },
          limit: 1
        });

        return locations[0];
      } else if (operationType === 'droit_terre') {
        // Créer souscription pour droits de terre
        const isoDate = new Date(currentDate).toISOString();
        await apiClient.insert({
          table: 'souscriptions',
          values: {
            client_id: client.id,
            propriete_id: property.id,
            prix_total: row.loyer * 240,
            montant_mensuel: row.loyer,
            nombre_mois: 240,
            date_debut: isoDate,
            solde_restant: 0,
            type_souscription: 'historique',
            phase_actuelle: 'droit_terre',
            montant_droit_terre_mensuel: row.loyer,
            date_debut_droit_terre: isoDate,
            type_bien: row.typeHabitation || 'terrain',
            import_tag: importTag
          }
        });

        // Récupérer la souscription créée
        const souscriptions = await apiClient.select({
          table: 'souscriptions',
          filters: [
            { op: 'eq', column: 'client_id', value: client.id },
            { op: 'eq', column: 'propriete_id', value: property.id }
          ],
          orderBy: { column: 'created_at', ascending: false },
          limit: 1
        });

        return souscriptions[0];
      } else {
        // Créer souscription classique
        const prixTotal = row.loyer * 100;
        const isoDate = new Date(currentDate).toISOString();
        await apiClient.insert({
          table: 'souscriptions',
          values: {
            client_id: client.id,
            propriete_id: property.id,
            prix_total: prixTotal,
            montant_mensuel: row.loyer / 10,
            nombre_mois: 24,
            date_debut: isoDate,
            solde_restant: 0,
            type_souscription: 'mise_en_garde',
            phase_actuelle: 'souscription',
            montant_droit_terre_mensuel: row.loyer,
            periode_finition_mois: 9,
            type_bien: row.typeHabitation || 'terrain',
            import_tag: importTag
          }
        });

        // Récupérer la souscription créée
        const souscriptions = await apiClient.select({
          table: 'souscriptions',
          filters: [
            { op: 'eq', column: 'client_id', value: client.id },
            { op: 'eq', column: 'propriete_id', value: property.id }
          ],
          orderBy: { column: 'created_at', ascending: false },
          limit: 1
        });

        return souscriptions[0];
      }
    } catch (error) {
      console.error('Erreur création contrat:', error);
      throw error;
    }
  };

  // Create payments from Excel data using RPC functions for proper cash transaction handling
  const createPaymentsFromExcel = async (contract: any, operationType: 'loyer' | 'droit_terre' | 'souscription', paiementsMensuels: number[]) => {
    let paymentsCreated = 0;
    const currentYear = selectedYear;
    const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                       'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

    // Traiter uniquement le mois sélectionné
    const monthsToProcess = [parseInt(selectedMonth)];

    for (const monthIndex of monthsToProcess) {
      const montant = paiementsMensuels[monthIndex];
      if (montant <= 0) continue;

      try {
        const paymentDate = new Date(currentYear, monthIndex, 15).toISOString().split('T')[0];
        const moisConcerne = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}`;
        if (operationType === 'loyer') {
          // Utiliser RPC pour paiement location avec gestion de caisse
          await apiClient.payLocationWithCash({
            location_id: contract.id,
            montant,
            mode_paiement: 'especes',
            reference: `Import ${monthNames[monthIndex]} ${currentYear}`,
            date_paiement: paymentDate,
            mois_concerne: moisConcerne,
            annee_concerne: currentYear,
            import_tag: importTag
          });
        } else if (operationType === 'droit_terre') {
          // Utiliser RPC pour paiement droit de terre avec gestion de caisse
          await apiClient.payDroitTerreWithCash({
            souscription_id: contract.id,
            montant,
            mode_paiement: 'especes',
            reference: `Import ${monthNames[monthIndex]} ${currentYear}`,
            date_paiement: paymentDate,
            annee_concerne: currentYear,
            import_tag: importTag
          });
        } else {
          // Utiliser RPC pour paiement souscription avec gestion de caisse
          await apiClient.paySouscriptionWithCash({
            souscription_id: contract.id,
            montant,
            mode_paiement: 'especes',
            reference: `Import ${monthNames[monthIndex]} ${currentYear}`,
            date_paiement: paymentDate,
            import_tag: importTag
          });
        }
        paymentsCreated++;
      } catch (error) {
        // Continue même en cas d'erreur
        console.log(`Erreur création paiement ${monthNames[monthIndex]}:`, error);
      }
    }

    return paymentsCreated;
  };

  // Main import function - restructured to follow sequential process
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

    const results: ImportResult = {
      agentsMatched: 1,
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

    try {
      const agent = await getSelectedAgent();
      if (!agent) {
        throw new Error("Agent introuvable");
      }

      if (!simulate) {
        const selectedMonthIndex = parseInt(selectedMonth, 10);
        const totalToPay = previewData.reduce((sum, row) => {
          const amount = row.paiementsMensuels[selectedMonthIndex] || 0;
          return sum + amount;
        }, 0);

        const currentCashBalance = await apiClient.getCurrentCashBalance();
        if (currentCashBalance < totalToPay) {
          toast({
            title: "Solde de caisse insuffisant",
            description: `Import bloqué. Solde disponible: ${formatCurrency(currentCashBalance)} | Montant total à payer: ${formatCurrency(totalToPay)}. Veuillez approvisionner la caisse ou annuler l'import existant.`,
            variant: "destructive",
          });
          return;
        }

        const conflict = await apiClient.checkRecouvrementImportConflict({
          agent_id: selectedAgent,
          month: parseInt(selectedMonth, 10),
          year: selectedYear,
          operation_type: operationType,
          month_base: "zero_indexed",
        });

        if (conflict.has_conflict) {
          const monthLabels = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
          const monthLabel = monthLabels[parseInt(selectedMonth, 10)] || selectedMonth;
          toast({
            title: "Importation déjà existante",
            description: `Il existe déjà une importation pour ${operationType === 'loyer' ? 'Loyer' : operationType === 'droit_terre' ? 'Droit de terre' : 'Souscription'} - ${monthLabel} ${selectedYear} (${conflict.existing_count} paiement(s)). Pour la remplacer, utilisez d'abord "Annuler import".`,
            variant: "destructive",
          });
          return;
        }
      }

      console.log(`Début de l'import ${simulate ? '(simulation)' : ''} pour ${previewData.length} lignes`);

      // Traitement séquentiel : Client → Propriété → Contrat → Paiement → Reçu (automatique)
      for (let i = 0; i < previewData.length; i++) {
        const row = previewData[i];
        setProgress(((i + 1) / previewData.length) * 100);

        // Traitement robuste avec gestion d'erreur par ligne
        await processRowSequentially(row, agent, operationType, results, simulate);
      }

      // Les reçus sont comptés directement dans la boucle d'import

      setResults(results);
      
      if (simulate) {
        setSimulationCompleted(true);
        toast({
          title: "Simulation terminée avec succès",
          description: `${results.clientsCreated + results.clientsMatched} clients, ${results.paymentsImported} paiements, ${results.receiptsGenerated} reçus simulés`,
        });
      } else {
        if (results.errors.length > 0) {
          toast({
            title: "Import terminé avec erreurs",
            description: `${results.errors.length} erreur(s) détectée(s). ${results.locationsCreated + results.souscriptionsCreated} contrat(s) traité(s), ${results.paymentsImported} paiement(s).`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Import terminé avec succès",
            description: `${results.locationsCreated + results.souscriptionsCreated} contrat(s) créé(s), ${results.paymentsImported} paiement(s), ${results.receiptsGenerated} reçu(s).`,
          });
        }
      }

      console.log("Import terminé avec succès", results);
      
    } catch (error) {
      console.error("Erreur d'import:", error);
      const errorMessage = error instanceof Error ? error.message : "Une erreur critique est survenue lors de l'import";
      
      toast({
        title: "Erreur d'import",
        description: errorMessage,
        variant: "destructive"
      });

      // S'assurer que les résultats sont disponibles même en cas d'erreur
      setResults(results);
    } finally {
      setIsImporting(false);
      setProgress(100);
      if (!simulate) {
        setSimulationCompleted(false);
        if (!inline) {
          setTimeout(() => {
            setIsDialogOpen(false);
          }, 1000);
        }
      }
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
    <div className="flex-1 overflow-y-auto pr-2 md:pr-3">
      <div className="space-y-5 pb-1">
        {/* Step 1: Agent and Operation Type Selection */}
        <Card className="border-blue-100 shadow-sm">
          <CardHeader className="pb-4 bg-gradient-to-r from-blue-50/80 to-cyan-50/40 rounded-t-lg border-b">
            <CardTitle className="flex items-center gap-2 text-lg text-blue-900">
              <Users className="w-4 h-4" />
              Étape 1: Configuration de l'import
            </CardTitle>
            <CardDescription className="text-blue-800/80">
              Sélectionnez l'agent responsable et le type d'opération
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-select">Agent de recouvrement</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger className="bg-white">
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
                <Select value={operationType} onValueChange={(value: 'loyer' | 'droit_terre' | 'souscription') => setOperationType(value)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loyer">Loyer</SelectItem>
                    <SelectItem value="droit_terre">Droit de terre</SelectItem>
                    <SelectItem value="souscription">Souscription</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sélecteur d'année et de mois pour import granulaire */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="year-select">Année</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Sélectionner l'année" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="month-select">Mois à importer</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Sélectionner un mois" />
                  </SelectTrigger>
                  <SelectContent>
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
            </div>

            <Alert className="border-blue-200 bg-blue-50/70">
              <Info className="h-4 w-4" />
              <AlertDescription>
                L'agent sélectionné sera automatiquement assigné à toutes les propriétés importées.
                Le type d'opération détermine si les paiements seront traités comme des loyers ou des droits de terre.
                <br />
                <strong>Import par mois :</strong> sélectionnez un mois. Le fichier contient le paiement de ce mois en colonne G.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Step 2: File Selection */}
        <Card className="border-emerald-100 shadow-sm">
          <CardHeader className="pb-4 bg-gradient-to-r from-emerald-50/80 to-teal-50/40 rounded-t-lg border-b">
            <CardTitle className="flex items-center gap-2 text-lg text-emerald-900">
              <Upload className="w-4 h-4" />
              Étape 2: Sélection du fichier Excel
            </CardTitle>
            <CardDescription className="text-emerald-800/80">
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

            <Alert className="border-emerald-200 bg-emerald-50/70">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Format attendu:</strong> NOM ET PRENOMS, LOYER, SITES, NUMERO TELEPHONE, 
                TYPE D'HABITATION, ARRIERES, PAIEMENT DU MOIS (colonne G)
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
          <Card className="border-violet-100 shadow-sm">
            <CardHeader className="pb-4 bg-gradient-to-r from-violet-50/80 to-sky-50/40 rounded-t-lg border-b">
              <CardTitle className="flex items-center gap-2 text-lg text-violet-900">
                <CheckCircle className="w-4 h-4" />
                Étape 3: Aperçu et validation des données
              </CardTitle>
              <CardDescription className="text-violet-900/80">
                Vérifiez vos données avant de procéder à l'import - Agent: {agents.find(a => a.id === selectedAgent)?.prenom} {agents.find(a => a.id === selectedAgent)?.nom} - Type: {operationType === 'loyer' ? 'Loyer' : 'Droit de terre'} - Année: {selectedYear} - Période: {selectedMonth === 'all' ? 'Tous les mois' : ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][parseInt(selectedMonth)]}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex flex-col items-center p-3 border rounded-lg bg-white">
                  <div className="text-2xl font-bold text-primary">{validation.totalClients}</div>
                  <div className="text-sm text-muted-foreground">Clients</div>
                </div>
                <div className="flex flex-col items-center p-3 border rounded-lg bg-white">
                  <div className="text-2xl font-bold text-primary">{validation.agentStats.length}</div>
                  <div className="text-sm text-muted-foreground">Agents</div>
                </div>
                <div className="flex flex-col items-center p-3 border rounded-lg bg-white">
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

              {/* Validation Warnings (non-bloquant) */}
              {validation.warnings && validation.warnings.length > 0 && (
                <Alert className="border-yellow-500 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Avertissements ({validation.warnings.length}):</strong>
                    <ul className="list-disc ml-4 mt-2">
                      {validation.warnings.slice(0, 5).map((warning, idx) => (
                        <li key={idx} className="text-sm">{warning}</li>
                      ))}
                      {validation.warnings.length > 5 && (
                        <li className="text-sm">... et {validation.warnings.length - 5} autres avertissements</li>
                      )}
                    </ul>
                    <p className="text-xs mt-2 italic">Ces avertissements n'empêchent pas l'import.</p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Data Preview Table - Avec pagination */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">
                    Aperçu des données ({previewData.length} clients au total)
                  </h4>
                  <div className="flex items-center gap-2">
                    <Input
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      placeholder="Rechercher un nom..."
                      className="w-52 md:w-64"
                    />
                    <Label htmlFor="items-per-page" className="text-sm">Afficher:</Label>
                    <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                      setItemsPerPage(parseInt(value));
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                        <SelectItem value={previewData.length.toString()}>Tout</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Calcul de la pagination */}
                {(() => {
                  const normalizedSearch = normalizeString(previewSearch || '');
                  const filteredData = normalizedSearch
                    ? previewData.filter((row) =>
                        normalizeString(`${row.nomEtPrenoms} ${row.site} ${row.numeroTelephone}`).includes(normalizedSearch)
                      )
                    : previewData;
                  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
                  const paginatedData = filteredData.slice(startIndex, endIndex);

                  return (
                    <>
                      {/* Info pagination */}
                      <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
                        <span>
                          {filteredData.length === 0
                            ? 'Aucun résultat'
                            : `Affichage de ${startIndex + 1} à ${endIndex} sur ${filteredData.length} clients`}
                        </span>
                        <span>
                          Page {currentPage} sur {totalPages}
                        </span>
                      </div>

                      {/* Table avec hauteur augmentée */}
                      <ScrollArea className="h-[560px] border rounded-md bg-white">
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
                            {paginatedData.map((row, idx) => (
                              <TableRow key={startIndex + idx}>
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
                            {paginatedData.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                  Aucun client trouvé pour cette recherche
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>

                      {/* Contrôles de pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-4 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                          >
                            Première
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                          >
                            Précédente
                          </Button>
                          <span className="px-3 py-1 text-sm bg-muted rounded">
                            {currentPage} / {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Suivante
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                          >
                            Dernière
                          </Button>
                        </div>
                      )}
                    </>
                  );
                })()}
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
                {(() => {
                  const stats = validation.agentStats[0];
                  const totalDu = stats?.totalDu || 0;
                  const totalVerse = stats?.totalVerse || 0;
                  const arrieres = Math.abs(validation.totalArrears || 0);
                  // Ecart global attendu: ce qui devrait etre verse moins ce qui a ete verse
                  const ecartGlobal = totalDu - totalVerse;
                  const ecartLabel = ecartGlobal > 0 ? 'A recouvrer' : ecartGlobal < 0 ? 'Excédent' : 'Équilibre';
                  const ecartClass =
                    ecartGlobal > 0 ? 'text-red-600' : ecartGlobal < 0 ? 'text-emerald-600' : 'text-slate-700';
                  const taux = validation.globalRecoveryRate || 0;

                  return (
                    <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="rounded-xl border bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Clients</div>
                    <div className="mt-2 text-2xl font-bold text-primary">{stats?.clientsCount || 0}</div>
                  </div>
                  <div className="rounded-xl border bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Total dû (mois)</div>
                    <div className="mt-2 text-2xl font-bold text-blue-600">{formatCurrency(totalDu)}</div>
                  </div>
                  <div className="rounded-xl border bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Total versé (mois)</div>
                    <div className="mt-2 text-2xl font-bold text-green-600">{formatCurrency(totalVerse)}</div>
                  </div>
                  <div className="rounded-xl border bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Arriérés totaux</div>
                    <div className="mt-2 text-2xl font-bold text-amber-600">{formatCurrency(arrieres)}</div>
                  </div>
                  <div className="rounded-xl border bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Taux recouvrement</div>
                    <div className={`mt-2 text-2xl font-bold ${taux > 80 ? 'text-green-600' : taux > 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {taux.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-xl border p-4 shadow-sm bg-gradient-to-r from-white via-slate-50 to-white">
                  <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Écart global</div>
                      <div className="text-sm text-muted-foreground">{ecartLabel}</div>
                    </div>
                    <div className={`text-3xl font-bold ${ecartClass}`}>
                      {formatCurrency(Math.abs(ecartGlobal))}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Calcul: Total dû ({formatCurrency(totalDu)}) - Total versé ({formatCurrency(totalVerse)})
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Arriérés affichés séparément: {formatCurrency(arrieres)}
                  </div>
                </div>
                    </>
                  );
                })()}
                
              </div>

              {/* Action Buttons */}
              {(() => {
                const selectedMonthIndex = parseInt(selectedMonth, 10);
                const totalRequired = previewData.reduce((sum, row) => {
                  if (Number.isNaN(selectedMonthIndex) || selectedMonthIndex < 0 || selectedMonthIndex > 11) return sum;
                  return sum + (row.paiementsMensuels[selectedMonthIndex] || 0);
                }, 0);
                const isCashInsufficient =
                  currentCashBalance !== null && currentCashBalance < totalRequired;

                return (
                  <Alert className={isCashInsufficient ? "border-red-300 bg-red-50" : "border-emerald-300 bg-emerald-50"}>
                    <AlertDescription className="text-sm">
                      <div>
                        <span className="font-medium">Solde caisse versement:</span>{" "}
                        {isCheckingCash ? "Vérification..." : currentCashBalance !== null ? formatCurrency(currentCashBalance) : "N/A"}
                      </div>
                      <div>
                        <span className="font-medium">Montant requis pour l'import:</span> {formatCurrency(totalRequired)}
                      </div>
                      {cashCheckError && (
                        <div className="text-red-600 mt-1">{cashCheckError}</div>
                      )}
                      {isCashInsufficient && (
                        <div className="text-red-700 font-medium mt-1">
                          Solde insuffisant: l'import réel sera bloqué tant que la caisse n'est pas approvisionnée.
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                );
              })()}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => importRecouvrementData(true)}
                  disabled={isImporting || validation.errors.length > 0}
                  variant="outline"
                  className="min-w-40"
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
                    disabled={(() => {
                      const selectedMonthIndex = parseInt(selectedMonth, 10);
                      const totalRequired = previewData.reduce((sum, row) => {
                        if (Number.isNaN(selectedMonthIndex) || selectedMonthIndex < 0 || selectedMonthIndex > 11) return sum;
                        return sum + (row.paiementsMensuels[selectedMonthIndex] || 0);
                      }, 0);
                      return isImporting || isCheckingCash || currentCashBalance === null || currentCashBalance < totalRequired;
                    })()}
                    className="bg-primary hover:bg-primary/90 min-w-40"
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
          <Card className="border-amber-200 shadow-sm">
            <CardHeader className="pb-3 bg-gradient-to-r from-amber-50/70 to-orange-50/30 rounded-t-lg border-b">
              <CardTitle className="flex items-center gap-2 text-lg text-amber-900">
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
          <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="pb-4 bg-gradient-to-r from-indigo-50/80 to-blue-50/40 rounded-t-lg border-b">
              <CardTitle className="flex items-center gap-2 text-lg text-indigo-900">
                <Receipt className="w-4 h-4" />
                Résultats de l'{simulationMode ? 'simulation' : 'import'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 border rounded-lg bg-white">
                  <div className="text-2xl font-bold text-primary">{results.agentsCreated + results.agentsMatched}</div>
                  <div className="text-sm text-muted-foreground">Agents</div>
                  <div className="text-xs text-muted-foreground">
                    {results.agentsCreated} créés, {results.agentsMatched} existants
                  </div>
                </div>
                <div className="text-center p-3 border rounded-lg bg-white">
                  <div className="text-2xl font-bold text-primary">{results.clientsCreated + results.clientsMatched}</div>
                  <div className="text-sm text-muted-foreground">Clients</div>
                  <div className="text-xs text-muted-foreground">
                    {results.clientsCreated} créés, {results.clientsMatched} existants
                  </div>
                </div>
                <div className="text-center p-3 border rounded-lg bg-white">
                  <div className="text-2xl font-bold text-primary">{results.locationsCreated + results.souscriptionsCreated}</div>
                  <div className="text-sm text-muted-foreground">Contrats</div>
                  <div className="text-xs text-muted-foreground">
                    {results.locationsCreated} locations, {results.souscriptionsCreated} souscriptions
                  </div>
                </div>
                <div className="text-center p-3 border rounded-lg bg-white">
                  <div className="text-2xl font-bold text-primary">{results.paymentsImported}</div>
                  <div className="text-sm text-muted-foreground">Paiements</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(results.totalAmount)}
                  </div>
                </div>
                <div className="text-center p-3 border rounded-lg bg-white">
                  <div className="text-2xl font-bold text-primary">{results.receiptsGenerated}</div>
                  <div className="text-sm text-muted-foreground">Reçus</div>
                  <div className="text-xs text-muted-foreground">
                    {simulationMode ? "Simulés" : "Générés"}
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
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
          <Upload className="w-4 h-4" />
          Importer données de recouvrement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col border-indigo-200 shadow-2xl">
        <DialogHeader className="pb-3 border-b bg-gradient-to-r from-indigo-50/80 via-blue-50/40 to-cyan-50/70 -mx-6 px-6 -mt-6 pt-6 rounded-t-lg">
          <DialogTitle className="flex items-center gap-2 text-indigo-950">
            <FileSpreadsheet className="w-5 h-5" />
            Import des données de recouvrement
          </DialogTitle>
          <DialogDescription className="text-indigo-900/80">
            Importez les données de situation de recouvrement depuis votre fichier Excel
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
