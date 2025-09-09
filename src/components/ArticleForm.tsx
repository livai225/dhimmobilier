import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface ArticleFormProps {
  onArticleCreated?: (articleId: string) => void;
}

export function ArticleForm({ onArticleCreated }: ArticleFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    nom: "",
    prix_reference: "",
    description: "",
  });

  const createArticle = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .insert({
          nom: form.nom,
          prix_reference: Number(form.prix_reference) || 0,
          description: form.description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Article créé",
        description: `L'article "${form.nom}" a été ajouté avec succès.`,
      });
      setForm({ nom: "", prix_reference: "", description: "" });
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
          <DialogTitle>Créer un nouvel article</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="nom">Nom de l'article*</Label>
            <Input
              id="nom"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Ex: Sable, Ciment, etc."
            />
          </div>
          <div>
            <Label htmlFor="prix_reference">Prix de référence (FCFA)</Label>
            <Input
              id="prix_reference"
              type="number"
              value={form.prix_reference}
              onChange={(e) => setForm({ ...form, prix_reference: e.target.value })}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="description">Description (optionnelle)</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description de l'article"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => createArticle.mutate()}
              disabled={!form.nom || createArticle.isPending}
            >
              {createArticle.isPending ? "Création..." : "Créer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}