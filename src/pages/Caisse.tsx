import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import * as XLSX from 'xlsx';

export default function Caisse() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [tab, setTab] = useState<"entree" | "depense">("entree");
  const [file, setFile] = useState<File | null>(null);
  const [typeOperationFilter, setTypeOperationFilter] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    document.title = "Caisse - Solde et opérations";
  }, []);

  const { data: balance = 0 } = useQuery({
    queryKey: ["cash_balance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_current_cash_balance");
      if (error) throw error;
      return Number(data || 0);
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents_recouvrement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents_recouvrement")
        .select("id, nom, prenom, code_agent, statut")
        .order("nom");
      if (error) throw error;
      return data;
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
    const end = now;
    const startStr = customStart || format(start, "yyyy-MM-dd");
    const endStr = customEnd || format(end, "yyyy-MM-dd");
    return { start: startStr, end: endStr };
  }, [period, customStart, customEnd]);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["cash_transactions", periodRange, typeOperationFilter],
    queryFn: async () => {
      let query = supabase
        .from("cash_transactions")
        .select("*")
        .gte("date_transaction", periodRange.start)
        .lte("date_transaction", periodRange.end);
      
      if (typeOperationFilter) {
        query = query.eq("type_operation", typeOperationFilter);
      }
      
      const { data, error } = await query
        .order("date_transaction", { ascending: false })
        .order("heure_transaction", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const totals = useMemo(() => {
    const entrees = transactions
      .filter((t: any) => t.type_transaction === "entree")
      .reduce((s: number, t: any) => s + Number(t.montant), 0);
    const sorties = transactions
      .filter((t: any) => t.type_transaction === "sortie")
      .reduce((s: number, t: any) => s + Number(t.montant), 0);
    const net = entrees - sorties;
    const ouverture = balance - net;
    const cloture = balance;
    return { entrees, sorties, net, ouverture, cloture };
  }, [transactions, balance]);

  const [form, setForm] = useState({
    agent_id: "",
    montant: "",
    date_transaction: format(new Date(), "yyyy-MM-dd"),
    type_operation: "versement_agent" as "versement_agent" | "depense_entreprise" | "autre",
    beneficiaire: "",
    description: "",
  });

  const createTransaction = useMutation({
    mutationFn: async () => {
      const montantNum = Number(form.montant || 0);
      if (!montantNum || montantNum <= 0) throw new Error("Montant invalide");

      let uploadedPath: string | null = null;
      if (file) {
        const path = `transactions/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("justificatifs")
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        uploadedPath = path;
      }

      const { data, error } = await supabase.rpc("record_cash_transaction", {
        p_type_transaction: tab === "entree" ? "entree" : "sortie",
        p_montant: montantNum,
        p_type_operation: tab === "entree" ? "versement_agent" : form.type_operation,
        p_agent_id: tab === "entree" ? form.agent_id || null : null,
        p_beneficiaire: form.beneficiaire || null,
        p_reference_operation: null,
        p_description: form.description || null,
        p_piece_justificative: uploadedPath,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (transactionId) => {
      // Generate receipt for agent deposits
      if (tab === "entree" && form.agent_id) {
        try {
          const { ReceiptGenerator } = await import("@/utils/receiptGenerator");
          await ReceiptGenerator.createReceipt({
            clientId: "00000000-0000-0000-0000-000000000000", // Placeholder for agent deposits
            referenceId: transactionId,
            typeOperation: "versement_agent",
            montantTotal: Number(form.montant),
            datePaiement: form.date_transaction
          });
        } catch (receiptError) {
          console.error("Erreur lors de la génération du reçu:", receiptError);
          toast({ 
            title: "Avertissement", 
            description: "Transaction enregistrée mais le reçu n'a pas pu être généré.",
            variant: "destructive"
          });
        }
      }

      // Generate receipt for expenses
      if (tab === "depense") {
        try {
          const { ReceiptGenerator } = await import("@/utils/receiptGenerator");
          
          // Map expense type to receipt operation type
          const operationTypeMap = {
            "depense_entreprise": "paiement_facture",
            "autre": "versement_agent"
          };
          
          await ReceiptGenerator.createReceipt({
            clientId: "00000000-0000-0000-0000-000000000000", // Placeholder for company expenses
            referenceId: transactionId,
            typeOperation: operationTypeMap[form.type_operation] || "versement_agent",
            montantTotal: Number(form.montant),
            datePaiement: form.date_transaction
          });
        } catch (receiptError) {
          console.error("Erreur lors de la génération du reçu:", receiptError);
          toast({ 
            title: "Avertissement", 
            description: "Transaction enregistrée mais le reçu n'a pas pu être généré.",
            variant: "destructive"
          });
        }
      }

      setForm({
        agent_id: "",
        montant: "",
        date_transaction: format(new Date(), "yyyy-MM-dd"),
        type_operation: "versement_agent",
        beneficiaire: "",
        description: "",
      });
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cash_balance"] });
      toast({ title: "Opération enregistrée", description: "La transaction a été ajoutée à la caisse." });
    },
    onError: (e: any) => {
      toast({ title: "Erreur", description: e.message || "Impossible d'enregistrer", variant: "destructive" });
    },
  });

  const exportToExcel = () => {
    if (isExporting || transactions.length === 0) return;
    
    setIsExporting(true);
    
    try {
      // Préparer les données pour l'export
      const dataToExport = transactions.map((t: any) => ({
        'Date': format(new Date(t.date_transaction), 'dd/MM/yyyy'),
        'Heure': t.heure_transaction?.toString().slice(0,5) || '',
        'Type': t.type_transaction === 'entree' ? 'Entrée' : 'Sortie',
        'Opération': t.type_operation,
        'Montant (FCFA)': Number(t.montant).toLocaleString(),
        'Solde avant': Number(t.solde_avant).toLocaleString(),
        'Solde après': Number(t.solde_apres).toLocaleString(),
        'Bénéficiaire': t.beneficiaire || '',
        'Description': t.description || '',
        'Agent': t.agent_nom || ''
      }));

      // Créer un nouveau classeur et une feuille
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // Définir la largeur des colonnes
      const wscols = [
        { wch: 12 }, // Date
        { wch: 8 },  // Heure
        { wch: 10 }, // Type
        { wch: 20 }, // Opération
        { wch: 15 }, // Montant
        { wch: 15 }, // Solde avant
        { wch: 15 }, // Solde après
        { wch: 20 }, // Bénéficiaire
        { wch: 30 }, // Description
        { wch: 25 }  // Agent
      ];
      ws['!cols'] = wscols;

      // Ajouter la feuille au classeur
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

      // Générer le fichier Excel
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      XLSX.writeFile(wb, `transactions_${dateStr}.xlsx`);
      
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

  return (
    <div className="container mx-auto p-2 sm:p-4">
      <div className="flex items-start justify-between gap-4 flex-col sm:flex-row">
        <Card className="flex-1 min-w-[260px]">
          <CardHeader>
            <CardTitle>Solde actuel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{balance.toLocaleString()} FCFA</div>
            <p className="text-sm text-muted-foreground">Mise à jour en temps réel après chaque opération</p>
          </CardContent>
        </Card>

        <Card className="w-full sm:max-w-md">
          <CardHeader>
            <CardTitle>Nouveau mouvement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="entree">Entrée (versement)</TabsTrigger>
                <TabsTrigger value="depense">Dépense</TabsTrigger>
              </TabsList>
              <TabsContent value="entree" className="space-y-3">
                <div>
                  <label className="text-sm">Agent</label>
                  <Combobox
                    options={agents.map((a: any) => ({ value: a.id, label: `${a.prenom} ${a.nom} (${a.code_agent})` }))}
                    value={form.agent_id}
                    onChange={(v) => setForm((f) => ({ ...f, agent_id: v }))}
                    placeholder="Sélectionner un agent"
                  />
                </div>
                <div>
                  <label className="text-sm">Montant (FCFA)</label>
                  <Input type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm">Bénéficiaire (optionnel)</label>
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
                  {createTransaction.isPending ? "Enregistrement..." : "Enregistrer l'entrée"}
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
                     <option value="versement_agent">Versement agent</option>
                     <option value="paiement_caution">Paiement caution</option>
                     <option value="depense_entreprise">Dépense entreprise</option>
                     <option value="autre">Autre opération</option>
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
              <Button 
                variant="outline" 
                onClick={exportToExcel}
                disabled={isExporting || transactions.length === 0}
                className="self-end"
              >
                {isExporting ? 'Export en cours...' : 'Exporter en Excel'}
              </Button>
            </div>

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
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                        Aucune opération pour cette période
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((t: any) => {
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
                            {t.reference_operation ? (
                              <Button variant="outline" size="sm" className="h-7 text-xs">
                                📄 Voir reçu
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bilan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Solde d'ouverture</span>
              <span className="font-medium">{totals.ouverture.toLocaleString()} FCFA</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
