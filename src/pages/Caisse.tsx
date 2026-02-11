import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import * as XLSX from 'xlsx';
import { ReceiptDetailsDialog } from "@/components/ReceiptDetailsDialog";
import { ReceiptWithDetails } from "@/hooks/useReceipts";
import { ArticleForm } from "@/components/ArticleForm";
import { ProtectedAction } from "@/components/ProtectedAction";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AlertCircle, CheckCircle2, RefreshCw, Search } from "lucide-react";
import React from "react";
import { getInsufficientFundsMessage } from "@/utils/errorMessages";

export default function Caisse() {
  const permissions = useUserPermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [tab, setTab] = useState<"entree" | "depense">("entree");
  const [file, setFile] = useState<File | null>(null);
  const [typeOperationFilter, setTypeOperationFilter] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [journalTab, setJournalTab] = useState<"versement" | "entreprise">("versement");
  
  // Force secretary users to stay on versement tab
  React.useEffect(() => {
    if (!permissions.canAccessDashboard && journalTab === "entreprise") {
      setJournalTab("versement");
    }
  }, [permissions.canAccessDashboard, journalTab]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [entryType, setEntryType] = useState<"versement" | "vente">("versement");
  
  // Receipt dialog state
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptWithDetails | null>(null);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  
  // Diagnostic dialog state
  const [isDiagnosticDialogOpen, setIsDiagnosticDialogOpen] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    document.title = "Caisse - Solde et opérations";
  }, []);

  // Solde caisse versement (pour les versements agents)
  const { data: soldeCaisseVersement = 0 } = useQuery({
    queryKey: ["cash_balance"],
    queryFn: async () => {
      const data = await apiClient.rpc("get_current_cash_balance");
      return Number(data || 0);
    },
  });

  // Solde de caisse entreprise (revenus - dépenses)
  const { data: soldeCaisseEntreprise = 0 } = useQuery({
    queryKey: ["solde_caisse_entreprise"],
    queryFn: async () => {
      const data = await apiClient.rpc("get_solde_caisse_entreprise");
      return Number(data || 0);
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents_recouvrement"],
    queryFn: async () => {
      const data = await apiClient.select({ table: 'agents_recouvrement', orderBy: { column: 'nom', ascending: true } });
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: articles = [] } = useQuery({
    queryKey: ["articles"],
    queryFn: async () => {
      const data = await apiClient.select({ table: 'articles', orderBy: { column: 'nom', ascending: true } });
      return Array.isArray(data) ? data : [];
    },
  });

  const periodRange = useMemo(() => {
    const now = new Date();
    const start = new Date();
    if (period === "day") {
      // today
    } else if (period === "week") {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day; // Monday as start
      start.setDate(now.getDate() + diffToMonday);
    } else if (period === "month") {
      start.setDate(1);
    } else if (period === "year") {
      start.setMonth(0, 1);
    }
    const end = new Date(now);
    
    // Si des dates personnalisées sont fournies, les utiliser
    let startDate: Date;
    let endDate: Date;
    
    if (customStart) {
      startDate = new Date(customStart);
      startDate.setHours(0, 0, 0, 0); // Début de journée
    } else {
      startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0); // Début de journée
    }
    
    if (customEnd) {
      endDate = new Date(customEnd);
      endDate.setHours(23, 59, 59, 999); // Fin de journée
    } else {
      endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999); // Fin de journée
    }
    
    // Convertir en format ISO pour Prisma/MySQL
    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();
    
    return { start: startStr, end: endStr };
  }, [period, customStart, customEnd]);

  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ["cash_transactions", periodRange],
    queryFn: async () => {
      console.log("🔍 Récupération des transactions avec filtres:", {
        start: periodRange.start,
        end: periodRange.end,
        period,
        customStart,
        customEnd
      });
      
      const data = await apiClient.select({
        table: 'cash_transactions',
        filters: [
          { op: 'gte', column: 'date_transaction', value: periodRange.start },
          { op: 'lte', column: 'date_transaction', value: periodRange.end }
        ],
        orderBy: { column: 'date_transaction', ascending: false }
      });
      
      const transactions = Array.isArray(data) ? data : [];
      console.log(`✅ ${transactions.length} transaction(s) récupérée(s)`);
      
      return transactions;
    },
  });

  // Filter transactions based on current journal tab
  const transactions = useMemo(() => {
    if (!allTransactions) return [];
    
    let filtered = allTransactions;
    
    if (journalTab === "versement") {
      // Caisse versement: opérations de la caisse physique
      // ENTREES: versement_agent (agent dépose l'argent)
      // SORTIES: paiement_loyer, paiement_souscription, paiement_droit_terre, paiement_caution (argent sort de la caisse)
      filtered = allTransactions.filter((t: any) => 
        t.type_operation === "versement_agent" ||
        t.type_operation === "paiement_souscription" ||
        t.type_operation === "paiement_loyer" ||
        t.type_operation === "paiement_droit_terre" ||
        t.type_operation === "paiement_caution"
      );
    } else {
      // Caisse entreprise: transactions comptables de l'entreprise
      // REVENUS: paiement_loyer, paiement_souscription, paiement_droit_terre, paiement_caution, vente
      // DEPENSES: depense_entreprise, autre
      filtered = allTransactions.filter((t: any) => 
        t.type_operation === "paiement_loyer" ||
        t.type_operation === "paiement_souscription" ||
        t.type_operation === "paiement_droit_terre" ||
        t.type_operation === "paiement_caution" ||
        t.type_operation === "vente" ||
        t.type_operation === "depense_entreprise" ||
        t.type_operation === "autre"
      );
    }
    
    // Apply type operation filter if set
    if (typeOperationFilter) {
      filtered = filtered.filter((t: any) => t.type_operation === typeOperationFilter);
    }
    
    return filtered;
  }, [allTransactions, journalTab, typeOperationFilter]);

  // Reset page when key filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [journalTab, periodRange.start, periodRange.end, typeOperationFilter]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(transactions.length / itemsPerPage));
  const offset = (currentPage - 1) * itemsPerPage;
  const pageTransactions = transactions.slice(offset, offset + itemsPerPage);

  const totals = useMemo(() => {
    if (journalTab === "versement") {
      // Caisse versement: calculer entrées et sorties
      const entrees = transactions
        .filter((t: any) => t.type_transaction === "entree")
        .reduce((s: number, t: any) => s + Number(t.montant), 0);
      const sorties = transactions
        .filter((t: any) => t.type_transaction === "sortie")
        .reduce((s: number, t: any) => s + Number(t.montant), 0);
      const net = entrees - sorties;
      const ouverture = soldeCaisseVersement - net;
      const cloture = soldeCaisseVersement;
      return { entrees, sorties, net, ouverture, cloture };
    } else {
      // Caisse entreprise: calculer revenus et dépenses
      const revenus = transactions
        .filter((t: any) => 
          t.type_operation === "paiement_loyer" ||
          t.type_operation === "paiement_souscription" ||
          t.type_operation === "paiement_droit_terre" ||
          t.type_operation === "paiement_caution" ||
          t.type_operation === "vente"
        )
        .reduce((s: number, t: any) => s + Number(t.montant), 0);
      const depenses = transactions
        .filter((t: any) => 
          t.type_operation === "depense_entreprise" ||
          t.type_operation === "autre"
        )
        .reduce((s: number, t: any) => s + Number(t.montant), 0);
      const net = revenus - depenses;
      return { entrees: revenus, sorties: depenses, net, ouverture: 0, cloture: 0 };
    }
  }, [transactions, soldeCaisseVersement, journalTab]);

  const [form, setForm] = useState({
    agent_id: "",
    article_id: "",
    montant: "",
    quantite: "1",
    date_transaction: format(new Date(), "yyyy-MM-dd"),
    type_operation: "versement_agent" as "versement_agent" | "depense_entreprise" | "autre",
    beneficiaire: "",
    description: "",
    mois_concerne: String(new Date().getMonth() + 1).padStart(2, '0'), // Mois actuel (01-12)
    annee_concerne: new Date().getFullYear().toString(), // Année actuelle
  });

  // Auto-fill beneficiaire when agent is selected for versement
  useEffect(() => {
    if (tab === "entree" && entryType === "versement" && form.agent_id) {
      const selectedAgent = agents.find((a: any) => a.id === form.agent_id);
      if (selectedAgent) {
        setForm(f => ({ ...f, beneficiaire: `${selectedAgent.prenom} ${selectedAgent.nom}` }));
      }
    }
  }, [form.agent_id, tab, entryType, agents]);

  const createTransaction = useMutation({
    mutationFn: async () => {
      const montantNum = Number(form.montant || 0);
      if (!montantNum || montantNum <= 0) throw new Error("Le montant doit être supérieur à 0");

      // Validation spécifique pour les ventes
      if (tab === "entree" && entryType === "vente") {
        if (!form.article_id) throw new Error("Veuillez sélectionner un article pour la vente");
      }

      let uploadedPath: string | null = null;
      // Note: File upload would need a separate endpoint - skipping for now
      // if (file) { ... }

      // Handle sales differently
      if (tab === "entree" && entryType === "vente") {
        return await apiClient.rpc("record_sale_with_cash", {
          article_id: form.article_id,
          montant: montantNum,
          quantite: 1,
          date_vente: form.date_transaction,
          agent_id: form.agent_id || null,
          description: form.description || "Vente",
        });
      }

      // Regular transaction
      // Calculer mois_concerne au format YYYY-MM pour les versements
      let moisConcerne: string | null = null;
      let anneeConcerne: number | null = null;
      
      if (tab === "entree" && entryType === "versement" && form.mois_concerne && form.annee_concerne) {
        moisConcerne = `${form.annee_concerne}-${form.mois_concerne}`;
        anneeConcerne = parseInt(form.annee_concerne);
      }

      return await apiClient.rpc("record_cash_transaction", {
        type_transaction: tab === "entree" ? "entree" : "sortie",
        montant: montantNum,
        type_operation: tab === "entree" ? "versement_agent" : form.type_operation,
        agent_id: tab === "entree" ? form.agent_id || null : null,
        beneficiaire: form.beneficiaire || null,
        reference_operation: null,
        description: form.description || null,
        piece_justificative: uploadedPath,
        mois_concerne: moisConcerne,
        annee_concerne: anneeConcerne,
      });
    },
    onSuccess: async (transactionId) => {
      setForm({
        agent_id: "",
        article_id: "",
        montant: "",
        quantite: "1",
        date_transaction: format(new Date(), "yyyy-MM-dd"),
        type_operation: "versement_agent",
        beneficiaire: "",
        description: "",
        mois_concerne: String(new Date().getMonth() + 1).padStart(2, '0'),
        annee_concerne: new Date().getFullYear().toString(),
      });
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cash_balance"] });
      queryClient.invalidateQueries({ queryKey: ["solde_caisse_entreprise"] });
      toast({ 
        title: "Opération enregistrée", 
        description: entryType === "vente" ? "La vente a été enregistrée avec succès." : "La transaction a été ajoutée à la caisse." 
      });
    },
    onError: (e: any) => {
      const insufficientMessage = getInsufficientFundsMessage(e);
      if (insufficientMessage) {
        toast({
          title: "Montant insuffisant",
          description: insufficientMessage,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Erreur", description: e.message || "Impossible d'enregistrer", variant: "destructive" });
    },
  });

  const exportToExcel = () => {
    if (isExporting || transactions.length === 0) return;
    
    setIsExporting(true);
    
    try {
      // Préparer les données pour l'export selon l'onglet actif
      const dataToExport = transactions.map((t: any) => {
        const baseData = {
          'Date': format(new Date(t.date_transaction), 'dd/MM/yyyy'),
          'Heure': t.heure_transaction?.toString().slice(0,5) || '',
          'Type': t.type_transaction === 'entree' ? 'Entrée' : 'Sortie',
          'Opération': t.type_operation,
          'Montant (FCFA)': Number(t.montant).toLocaleString(),
          'Bénéficiaire': t.beneficiaire || '',
          'Description': t.description || '',
          'Agent': t.agent_nom || ''
        };

        // Add balance columns only for versement tab
        if (journalTab === "versement") {
          return {
            ...baseData,
            'Solde avant': Number(t.solde_avant).toLocaleString(),
            'Solde après': Number(t.solde_apres).toLocaleString(),
          };
        }
        
        return baseData;
      });

      // Créer un nouveau classeur et une feuille
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // Définir la largeur des colonnes selon l'onglet
      const wscols = journalTab === "versement" ? [
        { wch: 12 }, // Date
        { wch: 8 },  // Heure
        { wch: 10 }, // Type
        { wch: 20 }, // Opération
        { wch: 15 }, // Montant
        { wch: 20 }, // Bénéficiaire
        { wch: 30 }, // Description
        { wch: 25 }, // Agent
        { wch: 15 }, // Solde avant
        { wch: 15 }, // Solde après
      ] : [
        { wch: 12 }, // Date
        { wch: 8 },  // Heure
        { wch: 10 }, // Type
        { wch: 20 }, // Opération
        { wch: 15 }, // Montant
        { wch: 20 }, // Bénéficiaire
        { wch: 30 }, // Description
        { wch: 25 }  // Agent
      ];
      ws['!cols'] = wscols;

      // Ajouter la feuille au classeur
      XLSX.utils.book_append_sheet(wb, ws, journalTab === "versement" ? 'Caisse Versement' : 'Caisse Entreprise');

      // Générer le fichier Excel avec nom spécifique
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const fileName = journalTab === "versement" ? `caisse_versement_${dateStr}.xlsx` : `caisse_entreprise_${dateStr}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: 'Export réussi',
        description: 'Le fichier Excel a été généré avec succès.',
      });
    } catch (error) {
      console.error('Erreur lors de l\'export Excel:', error);
      toast({
        title: 'Erreur',
        description: 'Une erreur est survenue lors de l\'export.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle viewing receipt for a transaction
  const handleViewReceipt = async (transactionId: string) => {
    try {
      // Fetch receipts, clients, and agents in parallel
      const [recusData, clientsData, agentsData] = await Promise.all([
        apiClient.select({
          table: 'recus',
          filters: [{ op: 'eq', column: 'reference_id', value: transactionId }]
        }),
        apiClient.select({ table: 'clients' }),
        apiClient.select({ table: 'agents_recouvrement' }) // Ajout des agents
      ]);

      const recusList = Array.isArray(recusData) ? recusData : [];
      const clientsList = Array.isArray(clientsData) ? clientsData : [];
      const agentsList = Array.isArray(agentsData) ? agentsData : [];

      const receipts = recusList[0];

      if (!receipts) {
        toast({
          title: "Reçu introuvable",
          description: "Aucun reçu n'a été trouvé pour cette transaction.",
          variant: "destructive"
        });
        return;
      }

      const client = receipts.client_id ? clientsList.find((c: any) => c.id === receipts.client_id) : null;
      const agent = receipts.agent_id ? agentsList.find((a: any) => a.id === receipts.agent_id) : null;

      // Transform the data to match ReceiptWithDetails interface
      const receiptWithDetails: ReceiptWithDetails = {
        id: receipts.id,
        numero: receipts.numero,
        date_generation: receipts.date_generation,
        client_id: receipts.client_id,
        agent_id: receipts.agent_id,
        reference_id: receipts.reference_id,
        type_operation: receipts.type_operation,
        montant_total: receipts.montant_total,
        periode_debut: receipts.periode_debut,
        periode_fin: receipts.periode_fin,
        client: client ? {
          nom: client.nom,
          prenom: client.prenom,
          email: client.email,
          telephone_principal: client.telephone_principal
        } : null,
        agent: agent ? {
          nom: agent.nom,
          prenom: agent.prenom,
          code_agent: agent.code_agent
        } : null
      };

      setSelectedReceipt(receiptWithDetails);
      setIsReceiptDialogOpen(true);
    } catch (error) {
      console.error("Erreur lors de la récupération du reçu:", error);
      toast({
        title: "Erreur",
        description: "Impossible de récupérer le reçu.",
        variant: "destructive"
      });
    }
  };

  return (
    <ProtectedAction permission="canAccessCashbox" showMessage={true}>
      <div className="container mx-auto p-2 sm:p-4">
      <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
        <div className="flex flex-col gap-4 flex-1">
          {/* Solde caisse versement (affiché en principal) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Solde caisse versement</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setIsDiagnosticDialogOpen(true);
                  setIsDiagnosing(true);
                  try {
                    const data = await apiClient.rpc("diagnose_caisse_versement", {});
                    setDiagnosticData(data);
                  } catch (error: any) {
                    toast({
                      title: "Erreur",
                      description: error.message || "Impossible d'exécuter le diagnostic",
                      variant: "destructive",
                    });
                  } finally {
                    setIsDiagnosing(false);
                  }
                }}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Diagnostic
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{soldeCaisseVersement.toLocaleString()} FCFA</div>
              <p className="text-sm text-muted-foreground">Versements agents - paiements effectués</p>
            </CardContent>
          </Card>

          {/* Solde de caisse entreprise - masqué pour les secrétaires */}
          {permissions.canAccessDashboard && (
            <Card>
              <CardHeader>
                <CardTitle>Solde de caisse entreprise</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{soldeCaisseEntreprise.toLocaleString()} FCFA</div>
                <p className="text-sm text-muted-foreground">Revenus totaux - dépenses entreprise</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="w-full sm:max-w-md">
          <CardHeader>
            <CardTitle>Nouveau mouvement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
               <TabsList className={permissions.canMakeExpenses ? "grid grid-cols-2" : "grid grid-cols-1"}>
                 <TabsTrigger value="entree">Entrée (versement)</TabsTrigger>
                 {permissions.canMakeExpenses && <TabsTrigger value="depense">Dépense</TabsTrigger>}
               </TabsList>
              <TabsContent value="entree" className="space-y-3">
                <div>
                  <label className="text-sm">Type d'entrée</label>
                  <Combobox
                    options={[
                      { value: "versement", label: "Versement agent" },
                      { value: "vente", label: "Vente" },
                    ]}
                    value={entryType}
                    onChange={(v) => setEntryType(v as "versement" | "vente")}
                    placeholder="Sélectionner le type"
                  />
                </div>
                
                {entryType === "vente" ? (
                  <>
                    <div>
                      <label className="text-sm">Article</label>
                      <div className="flex gap-2">
                        <Combobox
                          options={articles.map((a: any) => ({ 
                            value: a.id, 
                            label: a.nom
                          }))}
                          value={form.article_id}
                          onChange={(v) => setForm((f) => ({ ...f, article_id: v }))}
                          placeholder="Sélectionner un article"
                          className="flex-1"
                        />
                        <ArticleForm
                          onArticleCreated={(articleId) => {
                            setForm((f) => ({ ...f, article_id: articleId }));
                            queryClient.invalidateQueries({ queryKey: ["articles"] });
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm">Agent (optionnel)</label>
                      <Combobox
                        options={agents.map((a: any) => ({ value: a.id, label: `${a.prenom} ${a.nom} (${a.code_agent})` }))}
                        value={form.agent_id}
                        onChange={(v) => setForm((f) => ({ ...f, agent_id: v }))}
                        placeholder="Sélectionner un agent"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-sm">Agent</label>
                    <Combobox
                      options={agents.map((a: any) => ({ value: a.id, label: `${a.prenom} ${a.nom} (${a.code_agent})` }))}
                      value={form.agent_id}
                      onChange={(v) => setForm((f) => ({ ...f, agent_id: v }))}
                      placeholder="Sélectionner un agent"
                    />
                  </div>
                )}
                
                <div>
                  <label className="text-sm">Bénéficiaire</label>
                  <Input 
                    value={form.beneficiaire} 
                    onChange={(e) => setForm({ ...form, beneficiaire: e.target.value })} 
                    placeholder={entryType === "vente" ? "Nom du client" : "Nom du bénéficiaire"}
                  />
                </div>
                
                <div>
                  <label className="text-sm">Montant (FCFA)</label>
                  <Input type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm">Description</label>
                  <Input 
                    value={form.description} 
                    onChange={(e) => setForm({ ...form, description: e.target.value })} 
                    placeholder={entryType === "vente" ? "Vente" : "Description"}
                  />
                </div>
                {entryType === "versement" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-sm">Mois</label>
                        <Select 
                          value={form.mois_concerne} 
                          onValueChange={(v) => setForm({ ...form, mois_concerne: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => {
                              const monthNum = String(i + 1).padStart(2, '0');
                              const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
                              return (
                                <SelectItem key={monthNum} value={monthNum}>
                                  {monthNames[i]}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm">Année</label>
                        <Select 
                          value={form.annee_concerne} 
                          onValueChange={(v) => setForm({ ...form, annee_concerne: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 10 }, (_, i) => {
                              const year = new Date().getFullYear() - 5 + i;
                              return (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <label className="text-sm">Pièce justificative</label>
                  <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </div>
                <Button className="w-full" onClick={() => createTransaction.mutate()} disabled={createTransaction.isPending}>
                  {createTransaction.isPending ? "Enregistrement..." : 
                   entryType === "vente" ? "Enregistrer la vente" : "Enregistrer l'entrée"}
                </Button>
              </TabsContent>
              <TabsContent value="depense" className="space-y-3">
                <div>
                  <label className="text-sm">Type de dépense</label>
                  <Combobox
                    options={[
                      { value: "depense_entreprise", label: "Dépense d'entreprise" },
                      { value: "autre", label: "Autre" },
                    ]}
                    value={form.type_operation}
                    onChange={(v) => setForm((f) => ({ ...f, type_operation: v as any }))}
                    placeholder="Sélectionner le type"
                  />
                </div>
                <div>
                  <label className="text-sm">Montant (FCFA)</label>
                  <Input type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm">Bénéficiaire</label>
                  <Input value={form.beneficiaire} onChange={(e) => setForm({ ...form, beneficiaire: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm">Description</label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm">Pièce justificative</label>
                  <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </div>
                <Button className="w-full" onClick={() => createTransaction.mutate()} disabled={createTransaction.isPending}>
                  {createTransaction.isPending ? "Enregistrement..." : "Enregistrer la dépense"}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Journal des opérations</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={journalTab} onValueChange={(v: any) => setJournalTab(v)} className="space-y-4">
              <TabsList className={permissions.canAccessDashboard ? "grid grid-cols-2" : "grid grid-cols-1"}>
                <TabsTrigger value="versement">Caisse Versement</TabsTrigger>
                {permissions.canAccessDashboard && <TabsTrigger value="entreprise">Caisse Entreprise</TabsTrigger>}
              </TabsList>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-3 items-start">
                <div className="flex gap-2 flex-wrap">
                  <Button variant={period === "day" ? "default" : "outline"} onClick={() => setPeriod("day")}>Jour</Button>
                  <Button variant={period === "week" ? "default" : "outline"} onClick={() => setPeriod("week")}>Semaine</Button>
                  <Button variant={period === "month" ? "default" : "outline"} onClick={() => setPeriod("month")}>Mois</Button>
                  <Button variant={period === "year" ? "default" : "outline"} onClick={() => setPeriod("year")}>Année</Button>
                </div>
                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <label className="text-sm block mb-1">Type d'opération</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={typeOperationFilter}
                      onChange={(e) => setTypeOperationFilter(e.target.value)}
                    >
                      <option value="">Tous les types</option>
                      {journalTab === "versement" ? (
                        <>
                          <option value="versement_agent">Versement agent</option>
                          <option value="paiement_caution">Paiement caution</option>
                          <option value="paiement_souscription">Paiement souscription</option>
                          <option value="paiement_loyer">Paiement loyer</option>
                          <option value="paiement_droit_terre">Paiement droit de terre</option>
                        </>
                       ) : (
                         <>
                           <option value="paiement_loyer">Paiement loyer</option>
                           <option value="paiement_souscription">Paiement souscription</option>
                           <option value="paiement_droit_terre">Paiement droit de terre</option>
                           <option value="paiement_caution">Paiement caution</option>
                           <option value="vente">Vente</option>
                           <option value="depense_entreprise">Dépense entreprise</option>
                           <option value="autre">Autre opération</option>
                         </>
                       )}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <div>
                      <label className="text-sm block mb-1">Début</label>
                      <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm block mb-1">Fin</label>
                      <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <Button 
                  variant="outline" 
                  onClick={exportToExcel}
                  disabled={isExporting || transactions.length === 0}
                >
                  {isExporting ? 'Export en cours...' : 'Exporter en Excel'}
                </Button>
              </div>

              <TabsContent value="versement">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Heure</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Opération</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Reçu</TableHead>
                        <TableHead>Solde avant</TableHead>
                        <TableHead>Solde après</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                            Chargement des transactions...
                          </TableCell>
                        </TableRow>
                      ) : pageTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                            <div className="space-y-2">
                              <p>Aucune opération pour cette période</p>
                              <p className="text-xs">
                                Période: {format(new Date(periodRange.start), "dd/MM/yyyy")} - {format(new Date(periodRange.end), "dd/MM/yyyy")}
                              </p>
                              {allTransactions.length > 0 && (
                                <p className="text-xs text-blue-600">
                                  {allTransactions.length} transaction(s) trouvée(s) au total (filtrées par type d'opération)
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        pageTransactions.map((t: any) => {
                          const agent = agents.find(a => a.id === t.agent_id);
                          return (
                            <TableRow key={t.id}>
                              <TableCell>{format(new Date(t.date_transaction), "dd/MM/yyyy")}</TableCell>
                              <TableCell>{t.heure_transaction?.toString().slice(0,5)}</TableCell>
                              <TableCell>
                                <Badge variant={t.type_transaction === "entree" ? "secondary" : "outline"}>
                                  {t.type_transaction}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{t.type_operation}</Badge>
                              </TableCell>
                              <TableCell>
                                {agent ? (
                                  <div className="text-xs">
                                    <div className="font-medium">{agent.prenom} {agent.nom}</div>
                                    <div className="text-muted-foreground">{agent.code_agent}</div>
                                  </div>
                                ) : t.agent_id ? (
                                  <span className="text-xs text-muted-foreground">Agent supprimé</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className={t.type_transaction === "entree" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                {t.type_transaction === "entree" ? "+" : "-"}{Number(t.montant).toLocaleString()} FCFA
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 text-xs"
                                  onClick={() => handleViewReceipt(t.id)}
                                >
                                  📄 Voir reçu
                                </Button>
                              </TableCell>
                              <TableCell className="text-sm">{Number(t.solde_avant).toLocaleString()}</TableCell>
                              <TableCell className="text-sm font-medium">{Number(t.solde_apres).toLocaleString()}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {totalPages > 1 && (
                  <div className="mt-4 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(currentPage - 1); }}
                            className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        {currentPage > 3 && (
                          <>
                            <PaginationItem>
                              <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(1); }}>1</PaginationLink>
                            </PaginationItem>
                            {currentPage > 4 && (
                              <PaginationItem><PaginationEllipsis /></PaginationItem>
                            )}
                          </>
                        )}
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(p => p >= Math.max(1, currentPage - 2) && p <= Math.min(totalPages, currentPage + 2))
                          .map((p) => (
                            <PaginationItem key={p}>
                              <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p); }} isActive={p === currentPage}>
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                        {currentPage < totalPages - 2 && (
                          <>
                            {currentPage < totalPages - 3 && (
                              <PaginationItem><PaginationEllipsis /></PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(totalPages); }}>{totalPages}</PaginationLink>
                            </PaginationItem>
                          </>
                        )}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                            className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="entreprise">
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Heure</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Opération</TableHead>
                        <TableHead>Agent/Bénéficiaire</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Reçu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                            Chargement des transactions...
                          </TableCell>
                        </TableRow>
                      ) : pageTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                            <div className="space-y-2">
                              <p>Aucune opération pour cette période</p>
                              <p className="text-xs">
                                Période: {format(new Date(periodRange.start), "dd/MM/yyyy")} - {format(new Date(periodRange.end), "dd/MM/yyyy")}
                              </p>
                              {allTransactions.length > 0 && (
                                <p className="text-xs text-blue-600">
                                  {allTransactions.length} transaction(s) trouvée(s) au total (filtrées par type d'opération)
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        pageTransactions.map((t: any) => {
                          const agent = agents.find(a => a.id === t.agent_id);
                          // Revenus: paiements clients et ventes
                          const isRevenu = t.type_operation === "paiement_loyer" ||
                            t.type_operation === "paiement_souscription" ||
                            t.type_operation === "paiement_droit_terre" ||
                            t.type_operation === "paiement_caution" ||
                            t.type_operation === "vente";
                          // Dépenses: dépenses entreprise et autres
                          const isDepense = t.type_operation === "depense_entreprise" ||
                            t.type_operation === "autre";
                          return (
                            <TableRow key={t.id}>
                              <TableCell>{format(new Date(t.date_transaction), "dd/MM/yyyy")}</TableCell>
                              <TableCell>{t.heure_transaction?.toString().slice(0,5)}</TableCell>
                              <TableCell>
                                <Badge variant={isRevenu ? "secondary" : "outline"}>
                                  {isRevenu ? "Revenu" : "Dépense"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={isRevenu ? "default" : "outline"}>{t.type_operation}</Badge>
                              </TableCell>
                              <TableCell>
                                {agent ? (
                                  <div className="text-xs">
                                    <div className="font-medium">{agent.prenom} {agent.nom}</div>
                                    <div className="text-muted-foreground">{agent.code_agent}</div>
                                  </div>
                                ) : t.beneficiaire ? (
                                  <span className="text-sm">{t.beneficiaire}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className={isRevenu ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                {isRevenu ? "+" : "-"}{Number(t.montant).toLocaleString()} FCFA
                              </TableCell>
                              <TableCell className="text-sm">{t.description || "-"}</TableCell>
                              <TableCell>
                                {(isRevenu || t.type_operation === "paiement_loyer" || t.type_operation === "paiement_souscription" || t.type_operation === "paiement_droit_terre" || t.type_operation === "paiement_caution") && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 text-xs"
                                    onClick={() => handleViewReceipt(t.id)}
                                  >
                                    📄 Voir reçu
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {totalPages > 1 && (
                  <div className="mt-4 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(currentPage - 1); }}
                            className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        {currentPage > 3 && (
                          <>
                            <PaginationItem>
                              <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(1); }}>1</PaginationLink>
                            </PaginationItem>
                            {currentPage > 4 && (
                              <PaginationItem><PaginationEllipsis /></PaginationItem>
                            )}
                          </>
                        )}
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(p => p >= Math.max(1, currentPage - 2) && p <= Math.min(totalPages, currentPage + 2))
                          .map((p) => (
                            <PaginationItem key={p}>
                              <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p); }} isActive={p === currentPage}>
                                {p}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                        {currentPage < totalPages - 2 && (
                          <>
                            {currentPage < totalPages - 3 && (
                              <PaginationItem><PaginationEllipsis /></PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(totalPages); }}>{totalPages}</PaginationLink>
                            </PaginationItem>
                          </>
                        )}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                            className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bilan de la période</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {journalTab === "versement" ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>Solde d'ouverture</span>
                  <span className="font-medium">{totals.ouverture.toLocaleString()} FCFA</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Total entrées</span>
                  <span className="font-medium text-green-600">+{totals.entrees.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">Total sorties</span>
                  <span className="font-medium text-red-600">-{totals.sorties.toLocaleString()} FCFA</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span>Mouvement net</span>
                  <span className={`font-medium ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totals.net >= 0 ? '+' : ''}{totals.net.toLocaleString()} FCFA
                  </span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="font-semibold">Solde de clôture</span>
                  <span className="font-bold text-lg">{totals.cloture.toLocaleString()} FCFA</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Total revenus</span>
                  <span className="font-medium text-green-600">+{totals.entrees.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">Total dépenses</span>
                  <span className="font-medium text-red-600">-{totals.sorties.toLocaleString()} FCFA</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="font-semibold">Résultat net</span>
                  <span className={`font-bold text-lg ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totals.net >= 0 ? '+' : ''}{totals.net.toLocaleString()} FCFA
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <ReceiptDetailsDialog
        receipt={selectedReceipt}
        open={isReceiptDialogOpen}
        onOpenChange={setIsReceiptDialogOpen}
      />

      {/* Diagnostic Dialog */}
      <Dialog open={isDiagnosticDialogOpen} onOpenChange={setIsDiagnosticDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Diagnostic de la Caisse Versement</DialogTitle>
            <DialogDescription>
              Analyse des transactions récentes pour identifier les problèmes de solde
            </DialogDescription>
          </DialogHeader>
          
          {isDiagnosing ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2">Analyse en cours...</span>
            </div>
          ) : diagnosticData ? (
            <div className="space-y-6">
              {/* Résumé */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Résumé</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Solde actuel</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {diagnosticData.solde_actuel.toLocaleString()} FCFA
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Solde théorique</p>
                      <p className="text-2xl font-bold text-green-600">
                        {diagnosticData.solde_theorique.toLocaleString()} FCFA
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total entrées</p>
                      <p className="text-xl font-semibold">
                        {diagnosticData.total_entrees.toLocaleString()} FCFA
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total sorties</p>
                      <p className="text-xl font-semibold text-red-600">
                        {diagnosticData.total_sorties.toLocaleString()} FCFA
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                    {Math.abs(diagnosticData.difference) > 0.01 ? (
                      <>
                        <AlertCircle className="h-5 w-5 text-orange-600" />
                        <div className="flex-1">
                          <p className="font-semibold text-orange-600">Incohérence détectée</p>
                          <p className="text-sm text-muted-foreground">
                            Différence: {diagnosticData.difference.toLocaleString()} FCFA
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {diagnosticData.message}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <p className="text-sm">{diagnosticData.message}</p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Versements récents */}
              {diagnosticData.versements_recents && diagnosticData.versements_recents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Versements récents (7 derniers jours)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {diagnosticData.versements_recents.map((v: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{v.agent}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(v.date), "dd/MM/yyyy HH:mm")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">
                              +{v.montant.toLocaleString()} FCFA
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Solde après: {v.solde_apres.toLocaleString()} FCFA
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sorties récentes */}
              {diagnosticData.sorties_recentes && diagnosticData.sorties_recentes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Sorties récentes (7 derniers jours)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {diagnosticData.sorties_recentes.map((s: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{s.beneficiaire}</p>
                            <p className="text-sm text-muted-foreground">
                              {s.type.replace("paiement_", "")} - {format(new Date(s.date), "dd/MM/yyyy HH:mm")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-red-600">
                              -{s.montant.toLocaleString()} FCFA
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Solde après: {s.solde_apres.toLocaleString()} FCFA
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="text-sm text-muted-foreground">
                Transactions analysées: {diagnosticData.transactions_analysees}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            {diagnosticData && Math.abs(diagnosticData.difference) > 0.01 && (
              <Button
                variant="default"
                onClick={async () => {
                  setIsRecalculating(true);
                  try {
                    const result = await apiClient.rpc("recalculate_caisse_versement", {});
                    toast({
                      title: "Recalcul effectué",
                      description: `Ancien solde: ${result.ancien_solde.toLocaleString()} FCFA → Nouveau solde: ${result.nouveau_solde.toLocaleString()} FCFA (${result.transactions_processed} transactions traitées)`,
                    });
                    queryClient.invalidateQueries({ queryKey: ["cash_balance"] });
                    queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
                    // Re-run diagnostic
                    const newData = await apiClient.rpc("diagnose_caisse_versement", {});
                    setDiagnosticData(newData);
                  } catch (error: any) {
                    toast({
                      title: "Erreur",
                      description: error.message || "Impossible de recalculer le solde",
                      variant: "destructive",
                    });
                  } finally {
                    setIsRecalculating(false);
                  }
                }}
                disabled={isRecalculating}
                className="flex items-center gap-2"
              >
                {isRecalculating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Recalcul en cours...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Recalculer le solde
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsDiagnosticDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ProtectedAction>
  );
}
