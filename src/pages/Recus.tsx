import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

import { Download, Eye, Receipt, TrendingUp, FileText, Clock, AlertTriangle } from "lucide-react";
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

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
    apport_souscription: { label: "Apport de location", color: "bg-purple-500" },
    droit_terre: { label: "Droit de terre", color: "bg-orange-500" },
    paiement_facture: { label: "Paiement de facture", color: "bg-red-500" },
    versement_agent: { label: "Versement agent", color: "bg-indigo-500" },
    vente: { label: "Vente", color: "bg-emerald-500" }
  };

  const handleViewDetails = (receipt: ReceiptWithDetails) => {
    setSelectedReceipt(receipt);
    setDetailsOpen(true);
  };

  const handleDownload = (receipt: ReceiptWithDetails) => {
    downloadReceiptPDF(receipt);
  };

  // Reset page on filters change
  // Note: relying on object key changes; if useReceipts memoizes, this is fine
  useEffect(() => { setCurrentPage(1); }, [filters.type_operation, filters.client_id, filters.search]);

  // Pagination calculation
  const total = receipts?.length || 0;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const offset = (currentPage - 1) * itemsPerPage;
  const pageReceipts = (receipts || []).slice(offset, offset + itemsPerPage);

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
        <ExportToExcelButton
          filename={`recus_${new Date().toISOString().slice(0,10)}`}
          rows={receipts || []}
          columns={[
            { header: "Numéro", accessor: (r:any) => r.numero },
            { header: "Date", accessor: (r:any) => new Date(r.date_generation).toLocaleDateString("fr-FR") },
            { header: "Client", accessor: (r:any) => `${r.client?.nom || ''} ${r.client?.prenom || ''}`.trim() },
            { header: "Type", accessor: (r:any) => r.type_operation },
            { header: "Montant", accessor: (r:any) => r.montant_total },
            { header: "Période début", accessor: (r:any) => r.periode_debut ? new Date(r.periode_debut).toLocaleDateString("fr-FR") : "-" },
            { header: "Période fin", accessor: (r:any) => r.periode_fin ? new Date(r.periode_fin).toLocaleDateString("fr-FR") : "-" },
          ]}
        />
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
              <CardTitle className="text-sm font-medium">Paiements clients</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-600">
                {stats.clientPaymentsThisMonth.toLocaleString("fr-FR")} FCFA
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ce mois</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Versements agents</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-600">
                {stats.agentDepositsThisMonth.toLocaleString("fr-FR")} FCFA
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ce mois</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Factures payées</CardTitle>
              <TrendingUp className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-600">
                {stats.invoicePaymentsThisMonth.toLocaleString("fr-FR")} FCFA
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ce mois</p>
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
              placeholder="Rechercher par numéro ou client..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
            
            <Combobox
              options={[
                { value: "all", label: "Tous les types" },
                ...Object.entries(operationTypes).map(([key, { label }]) => ({
                  value: key,
                  label: label
                }))
              ]}
              value={filters.type_operation}
              onChange={(value) => setFilters(prev => ({ ...prev, type_operation: value }))}
              placeholder="Type d'opération"
              buttonClassName="w-48 justify-start"
            />

            <Combobox
              options={[
                { value: "all", label: "Tous les clients" },
                ...(clients?.map(client => ({
                  value: client.id,
                  label: `${client.prenom} ${client.nom}`.trim()
                })) || [])
              ]}
              value={filters.client_id}
              onChange={(value) => setFilters(prev => ({ ...prev, client_id: value }))}
              placeholder="Sélectionner un client"
              buttonClassName="w-64 justify-start"
            />

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
            {total} reçu(s) • Page {currentPage} / {totalPages}
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
              {pageReceipts.map((receipt) => {
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
              {total === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun reçu trouvé
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
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