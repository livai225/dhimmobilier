import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { ReceiptDetailsDialog } from "./ReceiptDetailsDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { Calendar, TrendingUp, DollarSign, Activity, Search, FileText } from "lucide-react";
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth } from "date-fns";

interface AgentOperationsDialogProps {
  agent: any;
  isOpen: boolean;
  onClose: () => void;
}

export function AgentOperationsDialog({ agent, isOpen, onClose }: AgentOperationsDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);

  const periodRange = () => {
    const now = new Date();
    let start = new Date(2020, 0, 1); // Par défaut depuis 2020
    let end = now;

    if (periodFilter === "today") {
      start = now;
    } else if (periodFilter === "this_month") {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (periodFilter === "this_year") {
      start = startOfYear(now);
      end = endOfYear(now);
    } else if (periodFilter === "custom" && customStart && customEnd) {
      start = new Date(customStart);
      end = new Date(customEnd);
    }

    return {
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd")
    };
  };

  const { data: operations = [], isLoading } = useQuery({
    queryKey: ["agent_operations", agent?.id, periodRange()],
    queryFn: async () => {
      if (!agent?.id) return [];

      const range = periodRange();
      const data = await apiClient.select<any[]>({
        table: "cash_transactions",
        filters: [
          { op: "eq", column: "agent_id", value: agent.id },
          { op: "gte", column: "date_transaction", value: range.start },
          { op: "lte", column: "date_transaction", value: range.end }
        ],
        orderBy: { column: "date_transaction", ascending: false }
      });

      return data || [];
    },
    enabled: !!agent?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ["agent_detailed_stats", agent?.id, periodRange()],
    queryFn: async () => {
      if (!agent?.id) return null;

      const range = periodRange();
      const data = await apiClient.rpc<any[]>("get_agent_statistics", {
        agent_uuid: agent.id,
        start_date: range.start,
        end_date: range.end
      });

      return data?.[0];
    },
    enabled: !!agent?.id,
  });

  // Fetch receipts for agent operations
  const { data: receipts = [] } = useQuery({
    queryKey: ["agent_receipts", agent?.id, periodRange()],
    queryFn: async () => {
      if (!agent?.id) return [];

      const range = periodRange();

      // Get all cash transactions for this agent in the period
      const transactions = await apiClient.select<any[]>({
        table: "cash_transactions",
        filters: [
          { op: "eq", column: "agent_id", value: agent.id },
          { op: "gte", column: "date_transaction", value: range.start },
          { op: "lte", column: "date_transaction", value: range.end }
        ]
      });

      if (!transactions?.length) return [];

      // Get receipts that reference these transactions
      const transactionIds = transactions.map(t => t.id);
      const receiptsData = await apiClient.select<any[]>({
        table: "recus",
        filters: [
          { op: "in", column: "reference_id", values: transactionIds }
        ]
      });

      return receiptsData || [];
    },
    enabled: !!agent?.id,
  });

  const filteredOperations = operations.filter((op) =>
    op.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.beneficiaire?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.type_operation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewReceipt = (operation: any) => {
    const receipt = receipts.find(r => r.reference_id === operation.id);
    if (receipt) {
      setSelectedReceipt(receipt);
      setIsReceiptDialogOpen(true);
    }
  };

  if (!agent) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Fiche détaillée - {agent.prenom} {agent.nom}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Code: {agent.code_agent} • Statut: {agent.statut}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Statistiques rapides */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Total versé
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {Number(stats.total_verse || 0).toLocaleString()} FCFA
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Nb opérations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.nombre_versements || 0}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Moyenne
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-purple-600">
                    {Number(stats.moyenne_versement || 0).toLocaleString()} FCFA
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Dernier versement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-medium">
                    {stats.dernier_versement ? 
                      format(new Date(stats.dernier_versement), 'dd/MM/yyyy') : 
                      'Aucun'
                    }
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filtres */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtres et recherche</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium">Recherche</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Période</label>
                  <Combobox
                    options={[
                      { value: "all", label: "Toutes les périodes" },
                      { value: "today", label: "Aujourd'hui" },
                      { value: "this_month", label: "Ce mois" },
                      { value: "this_year", label: "Cette année" },
                      { value: "custom", label: "Période personnalisée" }
                    ]}
                    value={periodFilter}
                    onChange={setPeriodFilter}
                    placeholder="Sélectionner une période"
                  />
                </div>
                
                {periodFilter === "custom" && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Du</label>
                      <Input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Au</label>
                      <Input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Historique des opérations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Historique des opérations ({filteredOperations.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Heure</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Opération</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Bénéficiaire</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reçu</TableHead>
                      <TableHead>Solde après</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {isLoading ? (
                       <TableRow>
                         <TableCell colSpan={9} className="text-center py-6">
                           Chargement...
                         </TableCell>
                       </TableRow>
                     ) : filteredOperations.length === 0 ? (
                       <TableRow>
                         <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                           Aucune opération trouvée pour cette période
                         </TableCell>
                       </TableRow>
                    ) : (
                      filteredOperations.map((operation) => (
                        <TableRow key={operation.id}>
                          <TableCell>
                            {format(new Date(operation.date_transaction), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            {operation.heure_transaction?.toString().slice(0, 5)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={operation.type_transaction === "entree" ? "default" : "secondary"}>
                              {operation.type_transaction}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {operation.type_operation}
                            </Badge>
                          </TableCell>
                          <TableCell className={operation.type_transaction === "entree" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                            {operation.type_transaction === "entree" ? "+" : "-"}
                            {Number(operation.montant).toLocaleString()} FCFA
                          </TableCell>
                          <TableCell>{operation.beneficiaire || "-"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {operation.description || "-"}
                          </TableCell>
                          <TableCell>
                            {receipts.find(r => r.reference_id === operation.id) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewReceipt(operation)}
                                className="text-xs"
                              >
                                Voir reçu
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {Number(operation.solde_apres).toLocaleString()} FCFA
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Receipt Details Dialog */}
        <ReceiptDetailsDialog
          receipt={selectedReceipt}
          open={isReceiptDialogOpen}
          onOpenChange={setIsReceiptDialogOpen}
        />
      </DialogContent>
    </Dialog>
  );
}