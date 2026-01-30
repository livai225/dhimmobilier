import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface ArticleFormProps {
  onArticleCreated?: (articleId: string) => void;
}

export function ArticleForm({ onArticleCreated }: ArticleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logCreate, logDelete } = useAuditLog();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    nom: "",
  });

  // Fetch existing articles
  const { data: articles, isLoading } = useQuery({
    queryKey: ["articles"],
    queryFn: async () => {
      const data = await apiClient.select<any[]>({
        table: "articles",
        orderBy: { column: "nom", ascending: true }
      });
      return data;
    },
  });

  const createArticle = useMutation({
    mutationFn: async () => {
      const articleData = {
        nom: form.nom,
        prix_reference: 0,
        description: null,
      };
      await apiClient.insert({
        table: "articles",
        values: articleData
      });
      // Return the data for logging purposes
      return { ...articleData, id: 'new' };
    },
    onSuccess: (data) => {
      logCreate('articles', data.id, data, `Création de l'article ${data.nom}`);
      
      toast({
        title: "Article créé",
        description: `L'article "${form.nom}" a été ajouté avec succès.`,
      });
      setForm({ nom: "" });
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      onArticleCreated?.(data.id);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer l'article.",
        variant: "destructive",
      });
    },
  });

  const deleteArticle = useMutation({
    mutationFn: async (articleId: string) => {
      // Get article data before deletion
      const article = await apiClient.select<any>({
        table: "articles",
        filters: [{ op: "eq", column: "id", value: articleId }],
        single: true
      });

      await apiClient.delete({
        table: "articles",
        filters: [{ op: "eq", column: "id", value: articleId }]
      });

      return { article };
    },
    onSuccess: (result) => {
      if (result.article) {
        logDelete('articles', result.article.id, result.article, `Suppression de l'article ${result.article.nom}`);
      }
      
      toast({
        title: "Article supprimé",
        description: "L'article a été supprimé avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer l'article.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvel article
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gestion des articles</DialogTitle>
          <DialogDescription>
            Gérez votre catalogue d'articles. Créez de nouveaux articles ou supprimez les existants.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Liste des articles existants */}
          {articles && articles.length > 0 && (
            <div>
              <Label>Articles existants</Label>
              <ScrollArea className="h-32 w-full border rounded-md p-2">
                <div className="space-y-2">
                  {articles.map((article) => (
                    <div key={article.id} className="flex items-center justify-between bg-muted p-2 rounded">
                      <span className="text-sm">{article.nom}</span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                            <AlertDialogDescription>
                              Êtes-vous sûr de vouloir supprimer l'article "{article.nom}" ? Cette action ne peut pas être annulée.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteArticle.mutate(article.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Formulaire de création */}
          <div>
            <Label htmlFor="nom">Créer un nouvel article</Label>
            <div className="flex gap-2">
              <Input
                id="nom"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="Ex: Sable, Ciment, Gravier..."
              />
              <Button
                onClick={() => createArticle.mutate()}
                disabled={!form.nom || createArticle.isPending}
                size="sm"
              >
                {createArticle.isPending ? "..." : "Ajouter"}
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}