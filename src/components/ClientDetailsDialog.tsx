import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Eye, 
  Phone, 
  Mail, 
  MapPin, 
  AlertTriangle, 
  Home, 
  FileText, 
  CreditCard,
  Receipt,
  Download,
  Calendar,
  DollarSign
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Client {
  id: string;
  nom: string;
  prenom?: string;
  telephone_principal?: string;
  telephone_secondaire_1?: string;
  telephone_secondaire_2?: string;
  email?: string;
  adresse?: string;
  contact_urgence_nom?: string;
  contact_urgence_telephone?: string;
  contact_urgence_relation?: string;
  created_at: string;
  updated_at: string;
}

interface ClientDetailsDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDetailsDialog({ client, open, onOpenChange }: ClientDetailsDialogProps) {
  // Local state for notes and attachments (stored in localStorage)
  const [newNote, setNewNote] = useState("");
  const [notes, setNotes] = useState<Array<{ id: string; text: string; date: string }>>([]);
  const [serverNotesEnabled, setServerNotesEnabled] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileUrl, setNewFileUrl] = useState("");
  const [files, setFiles] = useState<Array<{ id: string; name: string; url: string; date: string }>>([]);

  // Helpers to persist in localStorage
  const storageKeys = useMemo(() => ({
    notes: client ? `client_notes_${client.id}` : "client_notes_",
    files: client ? `client_files_${client.id}` : "client_files_",
  }), [client]);

  useEffect(() => {
    if (!client) return;
    
    // Load notes from localStorage only
    setServerNotesEnabled(false);
    try {
      const n = JSON.parse(localStorage.getItem(storageKeys.notes) || "[]");
      setNotes(Array.isArray(n) ? n : []);
    } catch {
      setNotes([]);
    }

    // Load files from localStorage
    try {
      const f = JSON.parse(localStorage.getItem(storageKeys.files) || "[]");
      setFiles(Array.isArray(f) ? f : []);
    } catch {
      setFiles([]);
    }
  }, [client, storageKeys]);

  const addNote = async () => {
    if (!newNote.trim() || !client) return;
    const entryLocal = { id: crypto.randomUUID(), text: newNote.trim(), date: new Date().toISOString() };
    
    // Store in localStorage only
    const next = [entryLocal, ...notes];
    setNotes(next);
    localStorage.setItem(storageKeys.notes, JSON.stringify(next));
    setNewNote("");
  };

  const deleteNote = async (id: string) => {
    const next = notes.filter(n => n.id !== id);
    setNotes(next);
    localStorage.setItem(storageKeys.notes, JSON.stringify(next));
  };

  const addFile = () => {
    if (!newFileName.trim() || !newFileUrl.trim()) return;
    const entry = { id: crypto.randomUUID(), name: newFileName.trim(), url: newFileUrl.trim(), date: new Date().toISOString() };
    const next = [entry, ...files];
    setFiles(next);
    localStorage.setItem(storageKeys.files, JSON.stringify(next));
    setNewFileName("");
    setNewFileUrl("");
  };

  const deleteFile = (id: string) => {
    const next = files.filter(f => f.id !== id);
    setFiles(next);
    localStorage.setItem(storageKeys.files, JSON.stringify(next));
  };

  // Timeline filters
  const [showLocations, setShowLocations] = useState(true);
  const [showSouscriptions, setShowSouscriptions] = useState(true);
  const [showLocPays, setShowLocPays] = useState(true);
  const [showSubPays, setShowSubPays] = useState(true);
  const [showLandRights, setShowLandRights] = useState(true);
  const [showReceipts, setShowReceipts] = useState(true);
  const [showNotes, setShowNotes] = useState(true);

  // Fetch locations
  const { data: locations = [] } = useQuery({
    queryKey: ['client-locations', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('locations')
        .select(`
          *,
          proprietes(nom, adresse, loyer_mensuel)
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id,
  });

  // Fetch souscriptions
  const { data: souscriptions = [] } = useQuery({
    queryKey: ['client-souscriptions', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('souscriptions')
        .select(`
          *,
          proprietes(nom, adresse)
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id,
  });

  // Fetch location payments
  const { data: locationPayments = [] } = useQuery({
    queryKey: ['client-location-payments', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('paiements_locations')
        .select(`
          *,
          locations!inner(
            proprietes(nom)
          )
        `)
        .eq('locations.client_id', client.id)
        .order('date_paiement', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id,
  });

  // Fetch subscription payments
  const { data: subscriptionPayments = [] } = useQuery({
    queryKey: ['client-subscription-payments', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('paiements_souscriptions')
        .select(`
          *,
          souscriptions!inner(
            proprietes(nom)
          )
        `)
        .eq('souscriptions.client_id', client.id)
        .order('date_paiement', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id,
  });

  // Fetch land rights payments with proper structure
  const { data: landRightsPayments = [] } = useQuery({
    queryKey: ['client-land-rights-payments', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      
      // Get payments with their related subscription data
      const { data, error } = await supabase
        .from('paiements_droit_terre')
        .select(`
          id,
          montant,
          date_paiement,
          mode_paiement,
          reference,
          souscription_id,
          created_at
        `)
        .order('date_paiement', { ascending: false });
      
      if (error) throw error;
      
      // Filter by client through souscriptions
      const { data: clientSouscriptions, error: souscriptionsError } = await supabase
        .from('souscriptions')
        .select('id, propriete_id, proprietes(nom)')
        .eq('client_id', client.id);
      
      if (souscriptionsError) throw souscriptionsError;
      
      const souscriptionIds = new Set(clientSouscriptions?.map(s => s.id) || []);
      
      // Create a map for property names
      const propertyMap = new Map(
        clientSouscriptions?.map(s => [s.id, s.proprietes?.nom]) || []
      );
      
      // Filter and enrich payments
      const filteredPayments = data?.filter(payment => 
        souscriptionIds.has(payment.souscription_id)
      ).map(payment => ({
        ...payment,
        propriete_nom: propertyMap.get(payment.souscription_id) || 'Propriété inconnue'
      })) || [];
      
      return filteredPayments;
    },
    enabled: !!client?.id,
  });

  // Fetch receipts
  const { data: receipts = [] } = useQuery({
    queryKey: ['client-receipts', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('recus')
        .select('*')
        .eq('client_id', client.id)
        .order('date_generation', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount).replace('XOF', 'FCFA');
  };

  const formatDate = (date: string) => {
    return format(new Date(date), 'dd/MM/yyyy', { locale: fr });
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'active': { label: 'Actif', variant: 'default' as const },
      'suspendu': { label: 'Suspendu', variant: 'secondary' as const },
      'termine': { label: 'Terminé', variant: 'outline' as const },
      'souscription': { label: 'Souscription', variant: 'default' as const },
      'droit_terre': { label: 'Droit de terre', variant: 'secondary' as const },
    };
    
    const config = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Détails du client - {client.nom} {client.prenom}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-9">
            <TabsTrigger value="info">Informations</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="souscriptions">Souscriptions</TabsTrigger>
            <TabsTrigger value="paiements">Paiements</TabsTrigger>
            <TabsTrigger value="droits-terre">Droits de Terre</TabsTrigger>
            <TabsTrigger value="recus">Reçus</TabsTrigger>
            <TabsTrigger value="activite">Activité</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="fichiers">Fichiers</TabsTrigger>
          </TabsList>

          {/* Client Information */}
          <TabsContent value="info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Informations personnelles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold">Nom complet</h4>
                    <p>{client.nom} {client.prenom}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">Email</h4>
                    <div className="flex items-center gap-2">
                      {client.email ? (
                        <>
                          <Mail className="h-4 w-4" />
                          <a href={`mailto:${client.email}`} className="underline">{client.email}</a>
                          <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(client.email)}>Copier</Button>
                        </>
                      ) : <span>-</span>}
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold mb-2">Numéros de téléphone</h4>
                  <div className="space-y-1">
                    {client.telephone_principal && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <a href={`tel:${client.telephone_principal}`} className="text-sm underline">Principal: {client.telephone_principal}</a>
                        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(client.telephone_principal!)}>Copier</Button>
                      </div>
                    )}
                    {client.telephone_secondaire_1 && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <a href={`tel:${client.telephone_secondaire_1}`} className="text-sm underline">Secondaire 1: {client.telephone_secondaire_1}</a>
                        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(client.telephone_secondaire_1!)}>Copier</Button>
                      </div>
                    )}
                    {client.telephone_secondaire_2 && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <a href={`tel:${client.telephone_secondaire_2}`} className="text-sm underline">Secondaire 2: {client.telephone_secondaire_2}</a>
                        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(client.telephone_secondaire_2!)}>Copier</Button>
                      </div>
                    )}
                  </div>
                </div>
                
                {client.contact_urgence_nom && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Contact d'urgence
                      </h4>
                      <div className="space-y-1">
                        <p><strong>Nom:</strong> {client.contact_urgence_nom}</p>
                        <p><strong>Téléphone:</strong> {client.contact_urgence_telephone}</p>
                        <p><strong>Relation:</strong> {client.contact_urgence_relation}</p>
                      </div>
                    </div>
                  </>
                )}
                
                {client.adresse && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Adresse
                      </h4>
                      <p>{client.adresse}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activité (Timeline) */}
          <TabsContent value="activite">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Timeline des activités
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Button size="sm" variant={showLocations ? 'default' : 'outline'} onClick={() => setShowLocations(v=>!v)}>Locations</Button>
                  <Button size="sm" variant={showSouscriptions ? 'default' : 'outline'} onClick={() => setShowSouscriptions(v=>!v)}>Souscriptions</Button>
                  <Button size="sm" variant={showLocPays ? 'default' : 'outline'} onClick={() => setShowLocPays(v=>!v)}>Paiements Loyer</Button>
                  <Button size="sm" variant={showSubPays ? 'default' : 'outline'} onClick={() => setShowSubPays(v=>!v)}>Paiements Souscription</Button>
                  <Button size="sm" variant={showLandRights ? 'default' : 'outline'} onClick={() => setShowLandRights(v=>!v)}>Droits de Terre</Button>
                  <Button size="sm" variant={showReceipts ? 'default' : 'outline'} onClick={() => setShowReceipts(v=>!v)}>Reçus</Button>
                  <Button size="sm" variant={showNotes ? 'default' : 'outline'} onClick={() => setShowNotes(v=>!v)}>Notes</Button>
                </div>
                {(() => {
                  const items: Array<{ date: string; label: string; amount?: number; icon: JSX.Element }> = [];
                  if (showLocations) {
                    locations.forEach(l => items.push({ date: l.created_at, label: `Location créée: ${l.proprietes?.nom || l.id}`, icon: <Home className="h-4 w-4" /> }));
                  }
                  if (showSouscriptions) {
                    souscriptions.forEach(s => items.push({ date: s.created_at, label: `Souscription: ${s.proprietes?.nom || s.id}`, icon: <FileText className="h-4 w-4" /> }));
                  }
                  if (showLocPays) {
                    locationPayments.forEach(p => items.push({ date: p.date_paiement, label: `Paiement loyer - ${p.locations?.proprietes?.nom || ''}`, amount: p.montant, icon: <CreditCard className="h-4 w-4" /> }));
                  }
                  if (showSubPays) {
                    subscriptionPayments.forEach(p => items.push({ date: p.date_paiement, label: `Paiement souscription - ${p.souscriptions?.proprietes?.nom || ''}`, amount: p.montant, icon: <CreditCard className="h-4 w-4" /> }));
                  }
                  if (showLandRights) {
                    landRightsPayments.forEach(p => items.push({ date: p.date_paiement, label: `Paiement droit de terre - ${p.propriete_nom}`, amount: p.montant, icon: <DollarSign className="h-4 w-4" /> }));
                  }
                  if (showReceipts) {
                    receipts.forEach(r => items.push({ date: r.date_generation, label: `Reçu généré (#${r.numero})`, amount: r.montant_total, icon: <Receipt className="h-4 w-4" /> }));
                  }
                  if (showNotes) {
                    notes.forEach(n => items.push({ date: n.date, label: `Note ajoutée`, icon: <FileText className="h-4 w-4" /> }));
                  }

                  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                  if (items.length === 0) {
                    return <p className="text-center py-6 text-muted-foreground">Aucune activité à afficher.</p>;
                  }

                  return (
                    <div className="space-y-3">
                      {items.map((it, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="text-muted-foreground">{it.icon}</div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{it.label}</div>
                            <div className="text-xs text-muted-foreground">{format(new Date(it.date), 'dd MMM yyyy', { locale: fr })}</div>
                          </div>
                          {typeof it.amount === 'number' && (
                            <div className="text-xs font-semibold">{formatCurrency(it.amount)}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes (localStorage) */}
          <TabsContent value="notes">
            <Card>
              <CardHeader>
                <CardTitle>Notes internes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <input
                    className="flex-1 border rounded px-3 py-2 bg-background"
                    placeholder="Ajouter une note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <Button onClick={addNote}>Ajouter</Button>
                </div>
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune note pour l'instant.</p>
                ) : (
                  <div className="space-y-2">
                    {notes.map((n) => (
                      <div key={n.id} className="border rounded p-2 flex items-start justify-between">
                        <div>
                          <div className="text-sm whitespace-pre-wrap">{n.text}</div>
                          <div className="text-xs text-muted-foreground mt-1">{format(new Date(n.date), 'dd/MM/yyyy HH:mm', { locale: fr })}</div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteNote(n.id)}>Supprimer</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fichiers (liens) */}
          <TabsContent value="fichiers">
            <Card>
              <CardHeader>
                <CardTitle>Pièces jointes (liens)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    className="border rounded px-3 py-2 bg-background"
                    placeholder="Nom du fichier (ex: CNI recto)"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                  />
                  <input
                    className="border rounded px-3 py-2 bg-background md:col-span-2"
                    placeholder="URL (ex: https://...)"
                    value={newFileUrl}
                    onChange={(e) => setNewFileUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Button onClick={addFile}>Ajouter</Button>
                </div>
                {files.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune pièce jointe.</p>
                ) : (
                  <div className="space-y-2">
                    {files.map((f) => (
                      <div key={f.id} className="border rounded p-2 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{f.name}</div>
                          <a href={f.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 underline break-all">{f.url}</a>
                          <div className="text-xs text-muted-foreground">{format(new Date(f.date), 'dd/MM/yyyy HH:mm', { locale: fr })}</div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteFile(f.id)}>Supprimer</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Locations */}
          <TabsContent value="locations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Locations ({locations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {locations.length === 0 ? (
                  <div className="text-center py-8">
                    <Home className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold">Aucune location</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ce client n'a aucune location enregistrée.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Propriété</TableHead>
                        <TableHead>Loyer Mensuel</TableHead>
                        <TableHead>Dette</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date Début</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {locations.map((location) => (
                        <TableRow key={location.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{location.proprietes?.nom}</div>
                              <div className="text-sm text-muted-foreground">{location.proprietes?.adresse}</div>
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(location.loyer_mensuel || 0)}</TableCell>
                          <TableCell>
                            <span className={location.dette_totale > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                              {formatCurrency(location.dette_totale || 0)}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(location.statut)}</TableCell>
                          <TableCell>{formatDate(location.date_debut)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Souscriptions */}
          <TabsContent value="souscriptions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Souscriptions ({souscriptions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {souscriptions.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold">Aucune souscription</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ce client n'a aucune souscription enregistrée.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Propriété</TableHead>
                        <TableHead>Prix Total</TableHead>
                        <TableHead>Solde Restant</TableHead>
                        <TableHead>Phase</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date Début</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {souscriptions.map((subscription) => (
                        <TableRow key={subscription.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{subscription.proprietes?.nom}</div>
                              <div className="text-sm text-muted-foreground">{subscription.proprietes?.adresse}</div>
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(subscription.prix_total || 0)}</TableCell>
                          <TableCell>
                            <span className={subscription.solde_restant > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                              {formatCurrency(subscription.solde_restant || 0)}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(subscription.phase_actuelle)}</TableCell>
                          <TableCell>{getStatusBadge(subscription.statut)}</TableCell>
                          <TableCell>{formatDate(subscription.date_debut)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Paiements */}
          <TabsContent value="paiements">
            <div className="space-y-4">
              {/* Location Payments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Paiements de Loyer ({locationPayments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {locationPayments.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">Aucun paiement de loyer</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Propriété</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Référence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {locationPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{payment.locations?.proprietes?.nom}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(payment.montant)}</TableCell>
                            <TableCell>{payment.mode_paiement || '-'}</TableCell>
                            <TableCell>{formatDate(payment.date_paiement)}</TableCell>
                            <TableCell>{payment.reference || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Subscription Payments */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Paiements de Souscription ({subscriptionPayments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subscriptionPayments.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">Aucun paiement de souscription</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Propriété</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Référence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subscriptionPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{payment.souscriptions?.proprietes?.nom}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(payment.montant)}</TableCell>
                            <TableCell>{payment.mode_paiement || '-'}</TableCell>
                            <TableCell>{formatDate(payment.date_paiement)}</TableCell>
                            <TableCell>{payment.reference || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Land Rights Payments */}
          <TabsContent value="droits-terre">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Paiements Droits de Terre ({landRightsPayments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {landRightsPayments.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold">Aucun paiement</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Aucun paiement de droit de terre enregistré.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Propriété</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Référence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {landRightsPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{payment.propriete_nom}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(payment.montant)}</TableCell>
                          <TableCell>{payment.mode_paiement || '-'}</TableCell>
                          <TableCell>{formatDate(payment.date_paiement)}</TableCell>
                          <TableCell>{payment.reference || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Receipts */}
          <TabsContent value="recus">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Reçus ({receipts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {receipts.length === 0 ? (
                  <div className="text-center py-8">
                    <Receipt className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold">Aucun reçu</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Aucun reçu généré pour ce client.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numéro</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Période</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipts.map((receipt) => (
                        <TableRow key={receipt.id}>
                          <TableCell className="font-medium">{receipt.numero}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {receipt.type_operation.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(receipt.montant_total)}</TableCell>
                          <TableCell>{formatDate(receipt.date_generation)}</TableCell>
                          <TableCell>
                            {receipt.periode_debut && receipt.periode_fin 
                              ? `${formatDate(receipt.periode_debut)} - ${formatDate(receipt.periode_fin)}`
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline">
                              <Download className="h-4 w-4 mr-2" />
                              Télécharger
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}