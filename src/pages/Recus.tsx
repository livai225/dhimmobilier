import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Eye, Receipt, TrendingUp, FileText, Clock } from "lucide-react";
import { useReceipts, useReceiptStats, ReceiptWithDetails } from "@/hooks/useReceipts";
import { ReceiptDetailsDialog } from "@/components/ReceiptDetailsDialog";
import { downloadReceiptPDF } from "@/utils/pdfGenerator";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExportToExcelButton } from "@/components/ExportToExcelButton";

export default function Recus() {
  const [filters, setFilters] = useState({
    type_operation: "all",
    client_id: "all",
    search: "",
  });
  
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptWithDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: receipts, isLoading } = useReceipts(filters);
  const { data: stats } = useReceiptStats();

  // Get clients for filter dropdown
  const { data: clients } = useQuery({
    queryKey: ["clients-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, nom, prenom")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const operationTypes = {
    location: { label: "Paiement de loyer", color: "bg-blue-500" },
    caution_location: { label: "Caution de location", color: "bg-green-500" },
    apport_souscription: { label: "Apport de souscription", color: "bg-purple-500" },
    droit_terre: { label: "Droit de terre", color: "bg-orange-500" },
    paiement_facture: { label: "Paiement de facture", color: "bg-red-500" }
  };

  const handleViewDetails = (receipt: ReceiptWithDetails) => {
    setSelectedReceipt(receipt);
    setDetailsOpen(true);
  };

  const handleDownload = (receipt: ReceiptWithDetails) => {
    downloadReceiptPDF(receipt);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Reçus</h1>
          <p className="text-muted-foreground">
            Gestion et consultation des reçus de paiement
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reçus</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReceipts}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Encaissements ce mois</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalThisMonth.toLocaleString("fr-FR")} FCFA
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Type le plus fréquent</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {Object.entries(stats.receiptsByType).sort(([,a], [,b]) => b - a)[0]?.[0] || "N/A"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dernier reçu</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {stats.lastReceipt ? 
                  new Date(stats.lastReceipt.date_generation).toLocaleDateString("fr-FR") : 
                  "N/A"
                }
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              placeholder="Rechercher par numéro..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
            
            <Select
              value={filters.type_operation}
              onValueChange={(value) => setFilters(prev => ({ ...prev, type_operation: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Type d'opération" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {Object.entries(operationTypes).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.client_id}
              onValueChange={(value) => setFilters(prev => ({ ...prev, client_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les clients</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.nom} {client.prenom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={() => setFilters({ type_operation: "all", client_id: "all", search: "" })}
              className="w-full sm:w-auto"
            >
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Receipts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des reçus</CardTitle>
          <CardDescription>
            {receipts?.length || 0} reçu(s) trouvé(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-[700px]">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts?.map((receipt) => {
                const operation = operationTypes[receipt.type_operation] || { 
                  label: receipt.type_operation, 
                  color: "bg-gray-500" 
                };
                const clientName = `${receipt.client?.nom || ""} ${receipt.client?.prenom || ""}`.trim();

                return (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-mono text-sm">{receipt.numero}</TableCell>
                    <TableCell>
                      {new Date(receipt.date_generation).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>{clientName}</TableCell>
                    <TableCell>
                      <Badge className={`${operation.color} text-white text-xs`}>
                        {operation.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {receipt.montant_total.toLocaleString("fr-FR")} FCFA
                    </TableCell>
                    <TableCell>
                      {receipt.periode_debut ? (
                        <span className="text-sm">
                          {new Date(receipt.periode_debut).toLocaleDateString("fr-FR")}
                          {receipt.periode_fin && 
                            ` - ${new Date(receipt.periode_fin).toLocaleDateString("fr-FR")}`
                          }
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(receipt)}
                          className="w-full sm:w-auto"
                        >
                          <Eye className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Voir</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(receipt)}
                          className="w-full sm:w-auto"
                        >
                          <Download className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">PDF</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {receipts?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun reçu trouvé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ReceiptDetailsDialog
        receipt={selectedReceipt}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}