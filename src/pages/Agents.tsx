import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AgentOperationsDialog } from "@/components/AgentOperationsDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function Agents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [showOperationsDialog, setShowOperationsDialog] = useState(false);
  const [selectedAgentForOperations, setSelectedAgentForOperations] = useState<any>(null);
  const [form, setForm] = useState({ nom: "", prenom: "", code_agent: "", telephone: "", email: "", statut: "actif" });

  useEffect(() => {
    document.title = "Agents de recouvrement - Gestion";
  }, []);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agents_recouvrement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents_recouvrement")
        .select("id, nom, prenom, code_agent, telephone, email, statut, date_embauche")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["agent_stats", selectedAgent],
    queryFn: async () => {
      if (!selectedAgent) return null;
      const { data, error } = await supabase.rpc("get_agent_statistics", { agent_uuid: selectedAgent });
      if (error) throw error;
      return data?.[0];
    },
    enabled: !!selectedAgent,
  });

  const createAgent = useMutation({
    mutationFn: async () => {
      if (!form.nom || !form.prenom || !form.code_agent) throw new Error("Nom, Prénom et Code agent sont requis");
      const { error } = await supabase.from("agents_recouvrement").insert({
        nom: form.nom,
        prenom: form.prenom,
        code_agent: form.code_agent,
        telephone: form.telephone || null,
        email: form.email || null,
        statut: form.statut,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ nom: "", prenom: "", code_agent: "", telephone: "", email: "", statut: "actif" });
      queryClient.invalidateQueries({ queryKey: ["agents_recouvrement"] });
      toast({ title: "Agent créé", description: "L'agent a été ajouté avec succès." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteAgent = useMutation({
    mutationFn: async (agentId: string) => {
      const { error } = await supabase
        .from("agents_recouvrement")
        .delete()
        .eq("id", agentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents_recouvrement"] });
      // Reset selected agent if it was the one being deleted
      if (selectedAgent) {
        setSelectedAgent("");
      }
      toast({ title: "Agent supprimé", description: "L'agent a été supprimé avec succès." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="container mx-auto p-2 sm:p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Liste des agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 max-w-sm">
              <Combobox
                options={agents.map((a: any) => ({ value: a.id, label: `${a.prenom} ${a.nom} (${a.code_agent})` }))}
                value={selectedAgent}
                onChange={setSelectedAgent}
                placeholder="Voir les statistiques d'un agent"
              />
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        Aucun agent enregistré
                      </TableCell>
                    </TableRow>
                  ) : (
                    agents.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.code_agent}</TableCell>
                        <TableCell>{a.prenom} {a.nom}</TableCell>
                        <TableCell>{a.telephone || '-'}</TableCell>
                        <TableCell>{a.email || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={a.statut === 'actif' ? 'secondary' : 'outline'}>{a.statut}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedAgentForOperations(a);
                                setShowOperationsDialog(true);
                              }}
                            >
                              📊 Fiche détaillée
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  Supprimer
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Êtes-vous sûr de vouloir supprimer l'agent {a.prenom} {a.nom} ({a.code_agent}) ?
                                    Cette action est irréversible.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteAgent.mutate(a.id)}
                                    disabled={deleteAgent.isPending}
                                  >
                                    {deleteAgent.isPending ? "Suppression..." : "Supprimer"}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {selectedAgent && stats && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardHeader className="py-3"><CardTitle className="text-sm">Total versé</CardTitle></CardHeader>
                  <CardContent className="text-xl font-bold">{Number(stats.total_verse || 0).toLocaleString()} FCFA</CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-3"><CardTitle className="text-sm">Versements</CardTitle></CardHeader>
                  <CardContent className="text-xl font-bold">{stats.nombre_versements || 0}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-3"><CardTitle className="text-sm">Moyenne</CardTitle></CardHeader>
                  <CardContent className="text-xl font-bold">{Number(stats.moyenne_versement || 0).toLocaleString()} FCFA</CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-3"><CardTitle className="text-sm">Dernier</CardTitle></CardHeader>
                  <CardContent className="text-xl font-bold">{stats.dernier_versement || '-'}</CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nouvel agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm">Prénom</label>
              <Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </div>
            <div>
              <label className="text-sm">Nom</label>
              <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
            <div>
              <label className="text-sm">Code agent</label>
              <Input value={form.code_agent} onChange={(e) => setForm({ ...form, code_agent: e.target.value })} placeholder="Ex: AGT-001" />
            </div>
            <div>
              <label className="text-sm">Téléphone</label>
              <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
            <div>
              <label className="text-sm">Email</label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-sm">Statut</label>
              <Combobox
                options={[{ value: 'actif', label: 'Actif' }, { value: 'inactif', label: 'Inactif' }, { value: 'suspendu', label: 'Suspendu' }]}
                value={form.statut}
                onChange={(v) => setForm({ ...form, statut: v })}
                placeholder="Sélectionner un statut"
              />
            </div>
            <Button className="w-full" onClick={() => createAgent.mutate()} disabled={createAgent.isPending}>
              {createAgent.isPending ? "Création..." : "Créer l'agent"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Dialog des opérations */}
      {showOperationsDialog && selectedAgentForOperations && (
        <AgentOperationsDialog
          agent={selectedAgentForOperations}
          isOpen={showOperationsDialog}
          onClose={() => {
            setShowOperationsDialog(false);
            setSelectedAgentForOperations(null);
          }}
        />
      )}
    </div>
  );
}
