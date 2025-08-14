import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { FournisseurForm } from "@/components/FournisseurForm";
import { Plus, Search, Edit, Trash2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ExportToExcelButton } from "@/components/ExportToExcelButton";

export default function Fournisseurs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSecteur, setSelectedSecteur] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch suppliers with their sectors and invoice stats
  const { data: fournisseurs = [], isLoading } = useQuery({
    queryKey: ["fournisseurs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fournisseurs")
        .select(`
          *,
          secteur:secteurs_activite(nom)
        `)
        .order("nom");
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch invoice stats for suppliers
  const { data: supplierStats } = useQuery({
    queryKey: ["supplier-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("factures_fournisseurs")
        .select("fournisseur_id, montant_total, solde");
      
      if (error) throw error;
      
      const stats = data?.reduce((acc, facture) => {
        const id = facture.fournisseur_id;
        if (!acc[id]) {
          acc[id] = { totalFactures: 0, totalEnCours: 0, nombreFactures: 0 };
        }
        acc[id].totalFactures += Number(facture.montant_total || 0);
        acc[id].totalEnCours += Number(facture.solde || 0);
        acc[id].nombreFactures += 1;
        return acc;
      }, {} as Record<string, { totalFactures: number; totalEnCours: number; nombreFactures: number }>) || {};

      return stats;
    },
  });

  // Fetch sectors for filter
  const { data: secteurs = [] } = useQuery({
    queryKey: ["secteurs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("secteurs_activite")
        .select("*")
        .order("nom");
      
      if (error) throw error;
      return data;
    },
  });

  // Delete supplier mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fournisseurs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fournisseurs"] });
      toast({
        title: "Succès",
        description: "Fournisseur supprimé avec succès",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la suppression du fournisseur",
        variant: "destructive",
      });
    },
  });

  // Filter suppliers
  const filteredFournisseurs = fournisseurs.filter((fournisseur) => {
    const matchesSearch = fournisseur.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fournisseur.contact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fournisseur.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
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

  const getPerformanceColor = (note) => {
    if (!note) return "secondary";
    if (note >= 4) return "default";
    if (note >= 3) return "secondary";
    return "destructive";
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
              <Button onClick={() => setEditingFournisseur(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau fournisseur
              </Button>
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
        </div>
        <Select value={selectedSecteur} onValueChange={setSelectedSecteur}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tous les secteurs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tous les secteurs</SelectItem>
            {secteurs.map((secteur) => (
              <SelectItem key={secteur.id} value={secteur.id}>
                {secteur.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <TableHead>Performance</TableHead>
              <TableHead>Factures</TableHead>
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
            ) : filteredFournisseurs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                  <TableCell>
                    {fournisseur.note_performance && (
                      <Badge variant={getPerformanceColor(fournisseur.note_performance)}>
                        {fournisseur.note_performance}/5
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {supplierStats?.[fournisseur.id] ? (
                        <>
                          <Badge variant="outline" className="text-xs">
                            {supplierStats[fournisseur.id].nombreFactures} facture{supplierStats[fournisseur.id].nombreFactures > 1 ? 's' : ''}
                          </Badge>
                          {supplierStats[fournisseur.id].totalEnCours > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {supplierStats[fournisseur.id].totalEnCours.toLocaleString()} FCFA dus
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Aucune facture</span>
                      )}
                    </div>
                  </TableCell>
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
                      <Button variant="ghost" size="sm">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}