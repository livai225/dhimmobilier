import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/integrations/api/client";
import { ProtectedAction } from "@/components/ProtectedAction";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AgentOperationsDialog } from "@/components/AgentOperationsDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileCard } from "@/components/MobileCard";
import { Plus, Eye, Trash2, Users, Phone, Mail, Calendar, Pencil } from "lucide-react";

export default function Agents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [showOperationsDialog, setShowOperationsDialog] = useState(false);
  const [selectedAgentForOperations, setSelectedAgentForOperations] = useState<any>(null);
  const [form, setForm] = useState({ nom: "", prenom: "", code_agent: "", telephone: "", email: "", statut: "actif" });
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nom: "", prenom: "", code_agent: "", telephone: "", email: "", statut: "actif" });
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const permissions = useUserPermissions();

  useEffect(() => {
    document.title = "Agents de recouvrement - Gestion";
  }, []);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agents_recouvrement"],
    queryFn: async () => {
      const data = await apiClient.select({ table: 'agents_recouvrement', orderBy: { column: 'nom', ascending: true } });
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["agent_stats", selectedAgent],
    queryFn: async () => {
      if (!selectedAgent) return null;
      const data = await apiClient.rpc("get_agent_statistics", { agent_id: selectedAgent });
      return Array.isArray(data) && data.length > 0 ? data[0] : null;
    },
    enabled: !!selectedAgent,
  });

  const createAgent = useMutation({
    mutationFn: async () => {
      if (!form.nom || !form.prenom || !form.code_agent) throw new Error("Nom, Prénom et Code agent sont requis");
      const agentData = {
        nom: form.nom,
        prenom: form.prenom,
        code_agent: form.code_agent,
        telephone: form.telephone || null,
        email: form.email || null,
        statut: form.statut,
      };
      return await apiClient.insert({ table: 'agents_recouvrement', values: agentData });
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
      return await apiClient.delete({ table: 'agents_recouvrement', filters: [{ op: 'eq', column: 'id', value: agentId }] });
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

  const updateAgent = useMutation({
    mutationFn: async (payload: { id: string; values: any }) => {
      const { id, values } = payload;
      if (!values.nom || !values.prenom || !values.code_agent) {
        throw new Error("Nom, Prénom et Code agent sont requis");
      }
      return await apiClient.update({
        table: 'agents_recouvrement',
        filters: [{ op: 'eq', column: 'id', value: id }],
        values,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents_recouvrement"] });
      setShowEditDialog(false);
      setEditingAgentId(null);
      toast({ title: "Agent mis à jour", description: "Les informations ont été enregistrées." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openEdit = (agent: any) => {
    setEditingAgentId(agent.id);
    setEditForm({
      nom: agent.nom || "",
      prenom: agent.prenom || "",
      code_agent: agent.code_agent || "",
      telephone: agent.telephone || "",
      email: agent.email || "",
      statut: agent.statut || "actif",
    });
    setShowEditDialog(true);
  };

  return (
    <div className="container mx-auto p-2 sm:p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Agents de recouvrement</h2>
          <p className="text-muted-foreground">
            Gérez vos agents et suivez leurs performances
          </p>
        </div>
        <ProtectedAction permission="canCreateAgents">
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              // Scroll vers le formulaire et focus sur le premier champ
              formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              // léger timeout pour laisser le scroll finir
              setTimeout(() => {
                firstInputRef.current?.focus();
              }, 300);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvel agent
          </Button>
        </ProtectedAction>
      </div>

      {/* Statistics selector */}
      <div className="max-w-sm">
        <Combobox
          options={agents.map((a: any) => ({ value: a.id, label: `${a.prenom} ${a.nom} (${a.code_agent})` }))}
          value={selectedAgent}
          onChange={setSelectedAgent}
          placeholder="Voir les statistiques d'un agent"
        />
      </div>

      {/* Statistics cards when agent selected */}
      {selectedAgent && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total versé</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{Number(stats.total_verse || 0).toLocaleString()} FCFA</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Versements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{stats.nombre_versements || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Moyenne</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{Number(stats.moyenne_versement || 0).toLocaleString()} FCFA</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Dernier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{stats.dernier_versement || '-'}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Agents List */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Liste des agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-6">Chargement...</p>
            ) : agents.length === 0 ? (
              <div className="text-center py-10">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">Aucun agent</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Commencez par créer votre premier agent.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Cards (visible on small screens) */}
                <div className="block md:hidden space-y-3">
                  {agents.map((agent: any) => (
                    <MobileCard
                      key={agent.id}
                      title={`${agent.prenom} ${agent.nom}`}
                      subtitle={agent.code_agent}
                      badge={{
                        text: agent.statut,
                        variant: agent.statut === 'actif' ? 'secondary' : 'outline'
                      }}
                      fields={[
                        {
                          label: "Téléphone",
                          value: agent.telephone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {agent.telephone}
                            </div>
                          ) : '-'
                        },
                        {
                          label: "Email",
                          value: agent.email ? (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {agent.email}
                            </div>
                          ) : '-'
                        },
                        {
                          label: "Embauche",
                          value: agent.date_embauche ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(agent.date_embauche).toLocaleDateString('fr-FR')}
                            </div>
                          ) : '-'
                        },
                        {
                          label: "Statut",
                          value: <Badge variant={agent.statut === 'actif' ? 'secondary' : 'outline'}>{agent.statut}</Badge>
                        }
                      ]}
                      actions={[
                        {
                          label: "Fiche détaillée",
                          icon: <Eye className="h-4 w-4" />,
                          onClick: () => {
                            setSelectedAgentForOperations(agent);
                            setShowOperationsDialog(true);
                          },
                          variant: "outline"
                        },
                        ...(permissions.canCreateAgents ? [{
                          label: "Modifier",
                          icon: <Pencil className="h-4 w-4" />,
                          onClick: () => openEdit(agent),
                          variant: "secondary"
                        }] : []),
                        {
                          label: "Supprimer",
                          icon: <Trash2 className="h-4 w-4" />,
                          onClick: () => {
                            if (confirm(`Êtes-vous sûr de vouloir supprimer l'agent ${agent.prenom} ${agent.nom} ?`)) {
                              deleteAgent.mutate(agent.id);
                            }
                          },
                          variant: "destructive"
                        }
                      ]}
                    />
                  ))}
                </div>

                {/* Desktop Table (hidden on small screens) */}
                <div className="hidden md:block">
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
                        {agents.map((a: any) => (
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
                                  <Eye className="h-4 w-4 mr-1" />
                                  Fiche détaillée
                                </Button>
                                <ProtectedAction permission="canCreateAgents">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => openEdit(a)}
                                  >
                                    <Pencil className="h-4 w-4 mr-1" />
                                    Modifier
                                  </Button>
                                </ProtectedAction>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                      <Trash2 className="h-4 w-4" />
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
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Create Agent Form */}
        <Card ref={formCardRef}>
          <CardHeader>
            <CardTitle>Nouvel agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium">Prénom</label>
              <Input 
                ref={firstInputRef}
                value={form.prenom} 
                onChange={(e) => setForm({ ...form, prenom: e.target.value })} 
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nom</label>
              <Input 
                value={form.nom} 
                onChange={(e) => setForm({ ...form, nom: e.target.value })} 
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Code agent</label>
              <Input 
                value={form.code_agent} 
                onChange={(e) => setForm({ ...form, code_agent: e.target.value })} 
                placeholder="Ex: AGT-001" 
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Téléphone</label>
              <Input 
                value={form.telephone} 
                onChange={(e) => setForm({ ...form, telephone: e.target.value })} 
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input 
                value={form.email} 
                onChange={(e) => setForm({ ...form, email: e.target.value })} 
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Statut</label>
              <div className="mt-1">
                <Combobox
                  options={[
                    { value: 'actif', label: 'Actif' }, 
                    { value: 'inactif', label: 'Inactif' }, 
                    { value: 'suspendu', label: 'Suspendu' }
                  ]}
                  value={form.statut}
                  onChange={(v) => setForm({ ...form, statut: v })}
                  placeholder="Sélectionner un statut"
                />
              </div>
            </div>
            <Button 
              className="w-full mt-4" 
              onClick={() => createAgent.mutate()} 
              disabled={createAgent.isPending}
            >
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

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Modifier l'agent</DialogTitle>
            <DialogDescription>
              Mettez à jour les informations de l'agent sélectionné.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-sm font-medium">Prénom</label>
              <Input 
                value={editForm.prenom} 
                onChange={(e) => setEditForm({ ...editForm, prenom: e.target.value })} 
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Nom</label>
              <Input 
                value={editForm.nom} 
                onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })} 
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Code agent</label>
              <Input 
                value={editForm.code_agent} 
                onChange={(e) => setEditForm({ ...editForm, code_agent: e.target.value })} 
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Téléphone</label>
              <Input 
                value={editForm.telephone} 
                onChange={(e) => setEditForm({ ...editForm, telephone: e.target.value })} 
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input 
                value={editForm.email} 
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} 
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Statut</label>
              <div className="mt-1">
                <Combobox
                  options={[
                    { value: 'actif', label: 'Actif' }, 
                    { value: 'inactif', label: 'Inactif' }, 
                    { value: 'suspendu', label: 'Suspendu' }
                  ]}
                  value={editForm.statut}
                  onChange={(v) => setEditForm({ ...editForm, statut: v })}
                  placeholder="Sélectionner un statut"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (!editingAgentId) return;
                updateAgent.mutate({
                  id: editingAgentId,
                  values: {
                    nom: editForm.nom,
                    prenom: editForm.prenom,
                    code_agent: editForm.code_agent,
                    telephone: editForm.telephone || null,
                    email: editForm.email || null,
                    statut: editForm.statut,
                  }
                });
              }}
              disabled={updateAgent.isPending}
            >
              {updateAgent.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
