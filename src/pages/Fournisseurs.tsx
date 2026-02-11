import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
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
import { ProtectedAction } from "@/components/ProtectedAction";
import { FournisseurForm } from "@/components/FournisseurForm";
import { FournisseurDetailsDialog } from "@/components/FournisseurDetailsDialog";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ExportToExcelButton } from "@/components/ExportToExcelButton";

export default function Fournisseurs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedSecteur, setSelectedSecteur] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState(null);
  const [selectedFournisseur, setSelectedFournisseur] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch suppliers with their sectors
  const { data: fournisseurs = [], isLoading, isFetching } = useQuery({
    queryKey: ["fournisseurs"],
    queryFn: async () => {
      const [fournisseursData, secteursData] = await Promise.all([
        apiClient.getFournisseurs(),
        apiClient.select({ table: "secteurs_activite", orderBy: { column: "nom", ascending: true } })
      ]);

      // Joindre les secteurs aux fournisseurs
      return fournisseursData.map((fournisseur: any) => {
        const secteur = secteursData.find((s: any) => s.id === fournisseur.secteur_id);
        return {
          ...fournisseur,
          secteur: secteur ? { nom: secteur.nom } : null
        };
      });
    },
  });

  // Fetch sectors for filter
  const { data: secteurs = [] } = useQuery({
    queryKey: ["secteurs"],
    queryFn: async () => {
      const data = await apiClient.select({
        table: "secteurs_activite",
        orderBy: { column: "nom", ascending: true }
      });
      return data;
    },
  });

  // Delete supplier mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.deleteFournisseur(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fournisseurs"] });
      toast({
        title: "Succès",
        description: "Fournisseur supprimé avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la suppression du fournisseur",
        variant: "destructive",
      });
    },
  });

  // Filter suppliers
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const filteredFournisseurs = fournisseurs.filter((fournisseur) => {
    const term = debouncedSearch.toLowerCase();
    const matchesSearch = fournisseur.nom.toLowerCase().includes(term) ||
      fournisseur.contact?.toLowerCase().includes(term) ||
      fournisseur.email?.toLowerCase().includes(term);
    
    const matchesSecteur = !selectedSecteur || fournisseur.secteur_id === selectedSecteur;
    
    return matchesSearch && matchesSecteur;
  });

  const handleEdit = (fournisseur) => {
    setEditingFournisseur(fournisseur);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingFournisseur(null);
  };

  const handleViewDetails = (fournisseur) => {
    setSelectedFournisseur(fournisseur);
    setIsDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fournisseurs</h1>
          <p className="text-muted-foreground">
            Gérez vos fournisseurs et prestataires de services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportToExcelButton
            filename={`fournisseurs_${new Date().toISOString().slice(0,10)}`}
            rows={filteredFournisseurs}
            columns={[
              { header: "Nom", accessor: (r:any) => r.nom },
              { header: "Secteur", accessor: (r:any) => r.secteur?.nom || "" },
              { header: "Contact", accessor: (r:any) => r.contact || "" },
              { header: "Téléphone", accessor: (r:any) => r.telephone || "" },
              { header: "Email", accessor: (r:any) => r.email || "" },
            ]}
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
            <ProtectedAction permission="canCreateSuppliers">
              <Button onClick={() => { setEditingFournisseur(null); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau fournisseur
              </Button>
            </ProtectedAction>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingFournisseur ? "Modifier le fournisseur" : "Nouveau fournisseur"}
                </DialogTitle>
              </DialogHeader>
              <FournisseurForm 
                fournisseur={editingFournisseur}
                onSuccess={handleCloseDialog}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Supplier Details Dialog */}
      <FournisseurDetailsDialog
        fournisseur={selectedFournisseur}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Rechercher un fournisseur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          {!!debouncedSearch && (
            <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2" onClick={() => setSearchTerm("")}>Effacer</Button>
          )}
        </div>
        <select
          value={selectedSecteur}
          onChange={(e) => setSelectedSecteur(e.target.value)}
          className="px-3 py-2 border rounded-md bg-background"
        >
          <option value="">Tous les secteurs</option>
          {secteurs.map((secteur) => (
            <option key={secteur.id} value={secteur.id}>
              {secteur.nom}
            </option>
          ))}
        </select>
      </div>

      {/* Suppliers table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Secteur</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell colSpan={6}>
                      <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ) : filteredFournisseurs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Aucun fournisseur trouvé
                </TableCell>
              </TableRow>
            ) : (
              filteredFournisseurs.map((fournisseur) => (
                <TableRow key={fournisseur.id}>
                  <TableCell className="font-medium">{fournisseur.nom}</TableCell>
                  <TableCell>
                    {fournisseur.secteur?.nom && (
                      <Badge variant="outline">{fournisseur.secteur.nom}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{fournisseur.contact}</TableCell>
                  <TableCell>{fournisseur.telephone}</TableCell>
                  <TableCell>{fournisseur.email}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(fournisseur)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(fournisseur.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewDetails(fournisseur)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
            {isFetching && !isLoading && filteredFournisseurs.length > 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="h-8 w-full rounded bg-muted animate-pulse" />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
