import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, Users, Phone, Mail, MapPin, AlertTriangle, Search, TrendingUp, Activity, Eye } from "lucide-react";
import { ProtectedAction } from "@/components/ProtectedAction";
import { useToast } from "@/hooks/use-toast";
import { ClientForm } from "@/components/ClientForm";
import { ExportToExcelButton } from "@/components/ExportToExcelButton";
import { ClientDetailsDialog } from "@/components/ClientDetailsDialog";
import { MobileCard } from "@/components/MobileCard";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

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

export default function Clients() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    telephone_principal: "",
    telephone_secondaire_1: "",
    telephone_secondaire_2: "",
    email: "",
    adresse: "",
    contact_urgence_nom: "",
    contact_urgence_telephone: "",
    contact_urgence_relation: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch clients
  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Fetch client statistics
  const { data: stats } = useQuery({
    queryKey: ['client-stats'],
    queryFn: async () => {
      const [
        { count: totalClients },
        { data: recentClients },
        { data: locations },
        { data: souscriptions }
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('locations').select('client_id').eq('statut', 'active'),
        supabase.from('souscriptions').select('client_id').eq('statut', 'active')
      ]);

      const activeRentals = locations?.length || 0;
      const activeSubscriptions = souscriptions?.length || 0;
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const newClientsThisMonth = recentClients?.filter(client => 
        new Date(client.created_at) >= thisMonth
      ).length || 0;

      return {
        totalClients: totalClients || 0,
        newClientsThisMonth,
        activeRentals,
        activeSubscriptions,
        recentClients: recentClients || []
      };
    },
  });

  const createClient = useMutation({
    mutationFn: async (clientData: typeof formData) => {
      const { data, error } = await supabase.from('clients').insert([clientData]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-stats'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Client créé",
        description: "Le client a été créé avec succès.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le client.",
        variant: "destructive",
      });
    },
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, ...clientData }: any) => {
      const { data, error } = await supabase.from('clients').update(clientData).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-stats'] });
      setIsDialogOpen(false);
      resetForm();
      setEditingClient(null);
      toast({
        title: "Client modifié",
        description: "Le client a été modifié avec succès.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le client.",
        variant: "destructive",
      });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-stats'] });
      toast({
        title: "Client supprimé",
        description: "Le client a été supprimé avec succès.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le client.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      nom: "",
      prenom: "",
      telephone_principal: "",
      telephone_secondaire_1: "",
      telephone_secondaire_2: "",
      email: "",
      adresse: "",
      contact_urgence_nom: "",
      contact_urgence_telephone: "",
      contact_urgence_relation: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient) {
      updateClient.mutate({ ...editingClient, ...formData });
    } else {
      createClient.mutate(formData);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      nom: client.nom,
      prenom: client.prenom || "",
      telephone_principal: client.telephone_principal || "",
      telephone_secondaire_1: client.telephone_secondaire_1 || "",
      telephone_secondaire_2: client.telephone_secondaire_2 || "",
      email: client.email || "",
      adresse: client.adresse || "",
      contact_urgence_nom: client.contact_urgence_nom || "",
      contact_urgence_telephone: client.contact_urgence_telephone || "",
      contact_urgence_relation: client.contact_urgence_relation || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce client ?")) {
      deleteClient.mutate(id);
    }
  };

  const filteredClients = clients?.filter(client => {
    const searchLower = searchTerm.toLowerCase().trim().replace(/\s+/g, ' ');
    if (!searchLower) return true;
    
    // Normalize client data
    const nom = (client.nom || '').toLowerCase().trim();
    const prenom = (client.prenom || '').toLowerCase().trim();
    const email = (client.email || '').toLowerCase().trim();
    const phone = (client.telephone_principal || '').replace(/[\s\-\.]/g, '');
    const searchPhone = searchTerm.replace(/[\s\-\.]/g, '');
    
    // Full name variations
    const fullName1 = `${nom} ${prenom}`.trim();
    const fullName2 = `${prenom} ${nom}`.trim();
    
    return nom.includes(searchLower) ||
           prenom.includes(searchLower) ||
           fullName1.includes(searchLower) ||
           fullName2.includes(searchLower) ||
           email.includes(searchLower) ||
           phone.includes(searchPhone);
  }) || [];

  // Pagination logic
  const itemsPerPage = 50;
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClients = filteredClients.slice(startIndex, endIndex);

  // Reset to first page when search changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return "-";
    return phone;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Clients</h2>
          <p className="text-muted-foreground">
            Gérez vos clients et leurs informations
          </p>
        </div>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
          <ExportToExcelButton
            filename={`clients_${new Date().toISOString().slice(0,10)}`}
            rows={filteredClients}
            columns={[
              { header: "Nom", accessor: (r:any) => r.nom },
              { header: "Prénom", accessor: (r:any) => r.prenom || "" },
              { header: "Email", accessor: (r:any) => r.email || "" },
              { header: "Téléphone", accessor: (r:any) => r.telephone_principal || "" },
              { header: "Adresse", accessor: (r:any) => r.adresse || "" },
            ]}
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
            <ProtectedAction permission="canCreateClients">
              <Button onClick={() => { resetForm(); setEditingClient(null); }} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau client
              </Button>
            </ProtectedAction>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto mx-4">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? "Modifier le client" : "Nouveau client"}
                </DialogTitle>
                <DialogDescription>
                  {editingClient 
                    ? "Modifiez les informations du client ci-dessous."
                    : "Ajoutez un nouveau client en remplissant les informations ci-dessous."
                  }
                </DialogDescription>
              </DialogHeader>
              <ClientForm 
                client={editingClient}
                onSuccess={() => {
                  setIsDialogOpen(false);
                  setEditingClient(null);
                  resetForm();
                  queryClient.invalidateQueries({ queryKey: ['clients'] });
                  queryClient.invalidateQueries({ queryKey: ['client-stats'] });
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dashboard Statistics */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.newClientsThisMonth || 0} nouveaux ce mois
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations Actives</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeRentals || 0}</div>
            <p className="text-xs text-muted-foreground">
              Contrats en cours
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Souscriptions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeSubscriptions || 0}</div>
            <p className="text-xs text-muted-foreground">
              Actives
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Croissance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats?.newClientsThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">
              Ce mois-ci
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-8"
          />
        </div>
      </div>

      {/* Client Details Dialog */}
      <ClientDetailsDialog 
        client={selectedClient}
        open={!!selectedClient}
        onOpenChange={() => setSelectedClient(null)}
      />

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Liste des clients
          </CardTitle>
          <CardDescription>
            {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''} 
            {searchTerm && ` trouvé${filteredClients.length !== 1 ? 's' : ''} pour "${searchTerm}"`}
            {totalPages > 1 && ` • Page ${currentPage} sur ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Chargement...</p>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-10">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">
                {searchTerm ? "Aucun client trouvé" : "Aucun client"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm 
                  ? "Essayez avec d'autres termes de recherche."
                  : "Commencez par créer votre premier client."
                }
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Cards (visible on small screens) */}
              <div className="block md:hidden space-y-3">
                {currentClients.map((client) => (
                  <MobileCard
                    key={client.id}
                    title={`${client.nom} ${client.prenom || ''}`}
                    subtitle={client.email || "Pas d'email"}
                    badge={client.contact_urgence_nom ? {
                      text: "Contact urgence",
                      variant: "secondary"
                    } : undefined}
                    fields={[
                      {
                        label: "Téléphone principal",
                        value: client.telephone_principal ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {client.telephone_principal}
                          </div>
                        ) : '-'
                      },
                      {
                        label: "Email",
                        value: client.email ? (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </div>
                        ) : '-'
                      },
                      {
                        label: "Adresse",
                        value: client.adresse ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span className="text-xs">{client.adresse.substring(0, 40)}...</span>
                          </div>
                        ) : '-'
                      },
                      {
                        label: "Contact urgence",
                        value: client.contact_urgence_nom ? (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                            <span className="text-xs">{client.contact_urgence_nom}</span>
                          </div>
                        ) : '-'
                      }
                    ]}
                    actions={[
                      {
                        label: "Voir",
                        icon: <Eye className="h-4 w-4" />,
                        onClick: () => setSelectedClient(client),
                        variant: "outline"
                      },
                      {
                        label: "Modifier",
                        icon: <Edit className="h-4 w-4" />,
                        onClick: () => handleEdit(client),
                        variant: "outline"
                      },
                      {
                        label: "Supprimer",
                        icon: <Trash2 className="h-4 w-4" />,
                        onClick: () => handleDelete(client.id),
                        variant: "destructive"
                      }
                    ]}
                  />
                ))}
              </div>

              {/* Desktop Table (hidden on small screens) */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Téléphones</TableHead>
                      <TableHead>Urgence</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{client.nom} {client.prenom}</div>
                            {client.adresse && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {client.adresse.substring(0, 30)}...
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {client.email && (
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3" />
                                {client.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {client.telephone_principal && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3" />
                                {formatPhone(client.telephone_principal)}
                                <Badge variant="outline" className="ml-1 text-xs">Principal</Badge>
                              </div>
                            )}
                            {client.telephone_secondaire_1 && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {formatPhone(client.telephone_secondaire_1)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {client.contact_urgence_nom ? (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                              <Badge variant="secondary" className="text-xs">
                                {client.contact_urgence_nom}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedClient(client)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(client)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(client.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && filteredClients.length > 0 && (
            <div className="mt-6 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                      }}
                      className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  
                  {/* First page */}
                  {currentPage > 3 && (
                    <>
                      <PaginationItem>
                        <PaginationLink 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setCurrentPage(1); }}
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      {currentPage > 4 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                    </>
                  )}
                  
                  {/* Pages around current page */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => 
                      page >= Math.max(1, currentPage - 2) && 
                      page <= Math.min(totalPages, currentPage + 2)
                    )
                    .map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => { e.preventDefault(); setCurrentPage(page); }}
                          isActive={page === currentPage}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                  
                  {/* Last page */}
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink 
                          href="#" 
                          onClick={(e) => { e.preventDefault(); setCurrentPage(totalPages); }}
                        >
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}
                  
                  <PaginationItem>
                    <PaginationNext 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                      }}
                      className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}