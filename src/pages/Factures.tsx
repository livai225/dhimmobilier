import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FactureForm } from "@/components/FactureForm";
import { PaiementFactureDialog } from "@/components/PaiementFactureDialog";
import { Plus, Search, Edit, Trash2, CreditCard, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Factures() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFournisseur, setSelectedFournisseur] = useState("");
  const [selectedStatut, setSelectedStatut] = useState("");
  const [isFactureDialogOpen, setIsFactureDialogOpen] = useState(false);
  const [isPaiementDialogOpen, setIsPaiementDialogOpen] = useState(false);
  const [editingFacture, setEditingFacture] = useState(null);
  const [selectedFactureForPaiement, setSelectedFactureForPaiement] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch invoices with suppliers
  const { data: factures = [], isLoading } = useQuery({
    queryKey: ["factures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factures_fournisseurs")
        .select(`
          *,
          fournisseur:fournisseurs(nom),
          propriete:proprietes(nom)
        `)
        .order("date_facture", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch suppliers for filter
  const { data: fournisseurs = [] } = useQuery({
    queryKey: ["fournisseurs-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fournisseurs")
        .select("id, nom")
        .order("nom");
      
      if (error) throw error;
      return data;
    },
  });

  // Delete invoice mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("factures_fournisseurs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["factures"] });
      toast({
        title: "Succès",
        description: "Facture supprimée avec succès",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la suppression de la facture",
        variant: "destructive",
      });
    },
  });

  // Filter invoices
  const filteredFactures = factures.filter((facture) => {
    const matchesSearch = facture.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      facture.fournisseur?.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      facture.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFournisseur = !selectedFournisseur || facture.fournisseur_id === selectedFournisseur;
    
    let matchesStatut = true;
    if (selectedStatut) {
      const solde = facture.solde || 0;
      if (selectedStatut === "payee" && solde > 0) matchesStatut = false;
      if (selectedStatut === "impayee" && solde === 0) matchesStatut = false;
      if (selectedStatut === "partielle" && (solde === 0 || solde === facture.montant_total)) matchesStatut = false;
    }
    
    return matchesSearch && matchesFournisseur && matchesStatut;
  });

  const handleEdit = (facture) => {
    setEditingFacture(facture);
    setIsFactureDialogOpen(true);
  };

  const handleCloseFactureDialog = () => {
    setIsFactureDialogOpen(false);
    setEditingFacture(null);
  };

  const handlePaiement = (facture) => {
    setSelectedFactureForPaiement(facture);
    setIsPaiementDialogOpen(true);
  };

  const handleClosePaiementDialog = () => {
    setIsPaiementDialogOpen(false);
    setSelectedFactureForPaiement(null);
  };

  const getStatutBadge = (facture) => {
    const solde = facture.solde || 0;
    const montantTotal = facture.montant_total || 0;
    
    if (solde === 0) {
      return <Badge variant="default">Payée</Badge>;
    } else if (solde === montantTotal) {
      return <Badge variant="destructive">Impayée</Badge>;
    } else {
      return <Badge variant="secondary">Partielle</Badge>;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Factures fournisseurs</h1>
          <p className="text-muted-foreground">
            Gérez vos factures et effectuez les paiements
          </p>
        </div>
        <Dialog open={isFactureDialogOpen} onOpenChange={setIsFactureDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingFacture(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle facture
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingFacture ? "Modifier la facture" : "Nouvelle facture"}
              </DialogTitle>
            </DialogHeader>
            <FactureForm 
              facture={editingFacture}
              onSuccess={handleCloseFactureDialog}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Rechercher une facture..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedFournisseur}
          onChange={(e) => setSelectedFournisseur(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="">Tous les fournisseurs</option>
          {fournisseurs.map((fournisseur) => (
            <option key={fournisseur.id} value={fournisseur.id}>
              {fournisseur.nom}
            </option>
          ))}
        </select>
        <select
          value={selectedStatut}
          onChange={(e) => setSelectedStatut(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="">Tous les statuts</option>
          <option value="payee">Payées</option>
          <option value="impayee">Impayées</option>
          <option value="partielle">Partiellement payées</option>
        </select>
      </div>

      {/* Invoices table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Facture</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Montant total</TableHead>
              <TableHead>Montant payé</TableHead>
              <TableHead>Solde</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredFactures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Aucune facture trouvée
                </TableCell>
              </TableRow>
            ) : (
              filteredFactures.map((facture) => (
                <TableRow key={facture.id}>
                  <TableCell className="font-medium">{facture.numero}</TableCell>
                  <TableCell>{facture.fournisseur?.nom}</TableCell>
                  <TableCell>
                    {format(new Date(facture.date_facture), "dd/MM/yyyy", { locale: fr })}
                  </TableCell>
                  <TableCell>{formatCurrency(facture.montant_total)}</TableCell>
                  <TableCell>{formatCurrency(facture.montant_paye)}</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(facture.solde)}
                  </TableCell>
                  <TableCell>{getStatutBadge(facture)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePaiement(facture)}
                        disabled={facture.solde === 0}
                      >
                        <CreditCard className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(facture)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(facture.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Receipt className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Payment Dialog */}
      <PaiementFactureDialog
        facture={selectedFactureForPaiement}
        open={isPaiementDialogOpen}
        onOpenChange={setIsPaiementDialogOpen}
        onSuccess={handleClosePaiementDialog}
      />
    </div>
  );
}