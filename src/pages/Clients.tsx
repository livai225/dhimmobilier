import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, Users, Phone, Mail, MapPin, AlertTriangle, Search, TrendingUp, Activity, Eye, Loader2, ArrowUpDown, Home, User, UserCheck } from "lucide-react";
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
  locations?: Array<{ count: number }>;
  souscriptions?: Array<{ count: number }>;
}

export default function Clients() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  // Filtres rapides
  const [filterMissingPhone, setFilterMissingPhone] = useState(false);
  const [filterMissingUrgence, setFilterMissingUrgence] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");
  const [clientTypeFilter, setClientTypeFilter] = useState<'all' | 'locataires' | 'souscripteurs' | 'mixtes' | 'prospects'>('all');
  // Tri
  const [sortBy, setSortBy] = useState<"nom" | "email" | "telephone" | "created_at">("nom");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
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

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Advanced string normalization function
  const normalizeString = (str: string): string => {
    if (!str) return '';
    return str
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove invisible characters
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' '); // Normalize spaces
  };

  // Fuzzy matching function
  const fuzzyMatch = (text: string, query: string): boolean => {
    const normalizedText = normalizeString(text);
    const normalizedQuery = normalizeString(query);
    
    // Exact match first
    if (normalizedText.includes(normalizedQuery)) return true;
    
    // Word-by-word matching
    const queryWords = normalizedQuery.split(' ').filter(word => word.length > 0);
    const textWords = normalizedText.split(' ');
    
    return queryWords.every(queryWord => 
      textWords.some(textWord => 
        textWord.includes(queryWord) || 
        queryWord.includes(textWord) ||
        levenshteinDistance(textWord, queryWord) <= 1
      )
    );
  };

  // Simple Levenshtein distance for fuzzy matching (max distance 1)
  const levenshteinDistance = (a: string, b: string): number => {
    if (Math.abs(a.length - b.length) > 1) return 2; // Early exit for efficiency
    
    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));
    
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    return matrix[a.length][b.length];
  };

  // Fetch agents for filtering
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents_recouvrement')
        .select('id, nom, prenom, code_agent')
        .eq('statut', 'actif')
        .order('nom');
      if (error) throw error;
      return data || [];
    },
  });

  // Pagination côté serveur avec tri et filtres
  const itemsPerPage = 50;
  const { data: clients, isLoading, isFetching } = useQuery({
    queryKey: ['clients', debouncedSearchTerm, filterMissingPhone, filterMissingUrgence, selectedAgentId, clientTypeFilter, currentPage, itemsPerPage, sortBy, sortDir],
    queryFn: async () => {
      const term = debouncedSearchTerm;
      const offset = (currentPage - 1) * itemsPerPage;
      const end = offset + itemsPerPage - 1;

      let query = supabase
        .from('clients')
        .select(`
          *,
          locations:locations!left(count),
          souscriptions:souscriptions!left(count)
        `);

      // Filter by agent if selected
      if (selectedAgentId && selectedAgentId !== "all") {
        const { data: clientIds } = await supabase
          .from('locations')
          .select('client_id, proprietes!inner(agent_id)')
          .eq('proprietes.agent_id', selectedAgentId);
        
        const { data: clientIdsFromSouscriptions } = await supabase
          .from('souscriptions')
          .select('client_id, proprietes!inner(agent_id)')
          .eq('proprietes.agent_id', selectedAgentId);

        const allClientIds = [
          ...(clientIds || []).map(item => item.client_id),
          ...(clientIdsFromSouscriptions || []).map(item => item.client_id)
        ];
        
        const uniqueClientIds = [...new Set(allClientIds)];
        
        if (uniqueClientIds.length === 0) {
          return [];
        }
        
        query = query.in('id', uniqueClientIds);
      }

      // Recherche multi-champs
      if (term.trim().length > 0) {
        const normalizedSearch = normalizeString(term);
        const searchWords = normalizedSearch.split(' ').filter(w => w.length > 0);
        const conditions = [
          `nom.ilike.%${normalizedSearch}%`,
          `prenom.ilike.%${normalizedSearch}%`,
          `email.ilike.%${normalizedSearch}%`,
          `telephone_principal.ilike.%${term}%`,
          `adresse.ilike.%${normalizedSearch}%`
        ];
        if (searchWords.length > 1) {
          conditions.push(`nom.ilike.%${searchWords.join('%')}%`);
          conditions.push(`prenom.ilike.%${searchWords.join('%')}%`);
          const reversed = [...searchWords].reverse().join(' ');
          conditions.push(`nom.ilike.%${reversed}%`);
          conditions.push(`prenom.ilike.%${reversed}%`);
        }
        query = query.or(conditions.join(','));
      }

      // Filtres rapides côté serveur
      if (filterMissingPhone) query = query.is('telephone_principal', null);
      if (filterMissingUrgence) query = query.is('contact_urgence_nom', null);

      // Apply client type filter
      if (clientTypeFilter === 'locataires') {
        query = query.gt('locations.count', 0).eq('souscriptions.count', 0);
      } else if (clientTypeFilter === 'souscripteurs') {
        query = query.eq('locations.count', 0).gt('souscriptions.count', 0);
      } else if (clientTypeFilter === 'mixtes') {
        query = query.gt('locations.count', 0).gt('souscriptions.count', 0);
      } else if (clientTypeFilter === 'prospects') {
        query = query.eq('locations.count', 0).eq('souscriptions.count', 0);
      }

      // Tri côté serveur
      const sortColumn = sortBy === 'telephone' ? 'telephone_principal' : (sortBy === 'email' ? 'email' : (sortBy === 'created_at' ? 'created_at' : 'nom'));
      query = query.order(sortColumn, { ascending: sortDir === 'asc' });

      // Pagination
      const { data, error } = await query.range(offset, end);
      if (error) throw error;
      return data || [];
    },
    placeholderData: (prev) => prev,
  });

  // Compte total pour pagination
  const { data: totalCount = 0 } = useQuery({
    queryKey: ['clients-count', debouncedSearchTerm, filterMissingPhone, filterMissingUrgence, selectedAgentId, clientTypeFilter],
    queryFn: async () => {
      const term = debouncedSearchTerm;
      let query = supabase.from('clients').select(`
        *,
        locations:locations!left(count),
        souscriptions:souscriptions!left(count)
      `, { count: 'exact', head: true });

      // Filter by agent if selected
      if (selectedAgentId && selectedAgentId !== "all") {
        const { data: clientIds } = await supabase
          .from('locations')
          .select('client_id, proprietes!inner(agent_id)')
          .eq('proprietes.agent_id', selectedAgentId);
        
        const { data: clientIdsFromSouscriptions } = await supabase
          .from('souscriptions')
          .select('client_id, proprietes!inner(agent_id)')
          .eq('proprietes.agent_id', selectedAgentId);

        const allClientIds = [
          ...(clientIds || []).map(item => item.client_id),
          ...(clientIdsFromSouscriptions || []).map(item => item.client_id)
        ];
        
        const uniqueClientIds = [...new Set(allClientIds)];
        
        if (uniqueClientIds.length === 0) {
          return 0;
        }
        
        query = query.in('id', uniqueClientIds);
      }

      if (term.trim().length > 0) {
        const normalizedSearch = normalizeString(term);
        const searchWords = normalizedSearch.split(' ').filter(w => w.length > 0);
        const conditions = [
          `nom.ilike.%${normalizedSearch}%`,
          `prenom.ilike.%${normalizedSearch}%`,
          `email.ilike.%${normalizedSearch}%`,
          `telephone_principal.ilike.%${term}%`,
          `adresse.ilike.%${normalizedSearch}%`
        ];
        if (searchWords.length > 1) {
          conditions.push(`nom.ilike.%${searchWords.join('%')}%`);
          conditions.push(`prenom.ilike.%${searchWords.join('%')}%`);
          const reversed = [...searchWords].reverse().join(' ');
          conditions.push(`nom.ilike.%${reversed}%`);
          conditions.push(`prenom.ilike.%${reversed}%`);
        }
        query = query.or(conditions.join(','));
      }
      if (filterMissingPhone) query = query.is('telephone_principal', null);
      if (filterMissingUrgence) query = query.is('contact_urgence_nom', null);

      // Apply client type filter
      if (clientTypeFilter === 'locataires') {
        query = query.gt('locations.count', 0).eq('souscriptions.count', 0);
      } else if (clientTypeFilter === 'souscripteurs') {
        query = query.eq('locations.count', 0).gt('souscriptions.count', 0);
      } else if (clientTypeFilter === 'mixtes') {
        query = query.gt('locations.count', 0).gt('souscriptions.count', 0);
      } else if (clientTypeFilter === 'prospects') {
        query = query.eq('locations.count', 0).eq('souscriptions.count', 0);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
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

  const getClientTypeBadge = (client: Client) => {
    const locationsCount = client.locations?.[0]?.count || 0;
    const souscriptionsCount = client.souscriptions?.[0]?.count || 0;
    
    if (locationsCount > 0 && souscriptionsCount > 0) {
      return <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">Mixte</Badge>;
    } else if (locationsCount > 0) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">Locataire</Badge>;
    } else if (souscriptionsCount > 0) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">Bailleur</Badge>;
    } else {
      return <Badge variant="outline" className="text-muted-foreground">Prospect</Badge>;
    }
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

  // Pagination calculée via totalCount et page courante
  const totalPages = Math.max(1, Math.ceil((totalCount as number) / itemsPerPage));
  const currentClients = clients || [];

  // Reset to first page when search changes with debouncing
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setCurrentPage(1);
    
    // Debug logging
    if (value.trim()) {
      console.log('🔍 Recherche:', {
        terme: value,
        normalise: normalizeString(value),
        clientsPageCount: (clients || []).length,
        totalCount
      });
    }
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
            {searchTerm.trim() || filterMissingPhone || filterMissingUrgence || (selectedAgentId && selectedAgentId !== "all")
              ? `${totalCount as number} résultats`
              : `${stats?.totalClients || 0} clients au total`}
            {selectedAgentId && selectedAgentId !== "all" && agents && (
              <span className="text-sm"> • Filtrés par agent {agents.find(a => a.id === selectedAgentId)?.code_agent}</span>
            )}
          </p>
        </div>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
          <ExportToExcelButton
            filename={`clients_${new Date().toISOString().slice(0,10)}`}
            rows={currentClients}
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
              <Button onClick={() => { resetForm(); setEditingClient(null); setIsDialogOpen(true); }} className="w-full sm:w-auto">
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

      {/* Enhanced Search Bar + Quick Filters */}
      <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, prénom, email, téléphone..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-8 pr-8"
          />
          {isLoading && (
            <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedAgentId} onValueChange={(value) => { setSelectedAgentId(value); setCurrentPage(1); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tous les agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les agents</SelectItem>
              {agents?.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.code_agent} ({agent.prenom} {agent.nom})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={filterMissingPhone ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilterMissingPhone((v) => !v); setCurrentPage(1); }}
          >
            Numéro de téléphone manquant
          </Button>
          <Button
            type="button"
            variant={filterMissingUrgence ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilterMissingUrgence((v) => !v); setCurrentPage(1); }}
          >
            Urgence manquante
          </Button>
          
          <Select value={clientTypeFilter} onValueChange={(value) => { setClientTypeFilter(value as any); setCurrentPage(1); }}>
            <SelectTrigger className="w-auto min-w-[180px]">
              <SelectValue placeholder="Type de client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="locataires">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Locataires
                </div>
              </SelectItem>
              <SelectItem value="souscripteurs">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Bailleurs
                </div>
              </SelectItem>
              <SelectItem value="mixtes">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Mixtes
                </div>
              </SelectItem>
              <SelectItem value="prospects">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Prospects
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {searchTerm && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {totalCount as number} résultat{(totalCount as number) !== 1 ? 's' : ''}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="h-6 px-2 text-xs"
            >
              Effacer
            </Button>
          </div>
        )}
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
          <CardDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <span>
              {currentClients.length} client{currentClients.length !== 1 ? 's' : ''}
              {searchTerm && ` trouvé${currentClients.length !== 1 ? 's' : ''} pour "${searchTerm}"`}
              {totalPages > 1 && ` • Page ${currentPage} sur ${totalPages}`}
            </span>
            {searchTerm && currentClients.length === 0 && (
              <span className="text-xs mt-1 sm:mt-0">
                💡 Astuce: Essayez avec moins de caractères ou vérifiez l'orthographe
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 w-full rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : currentClients.length === 0 ? (
              <div className="text-center py-10">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">
                  {searchTerm || filterMissingPhone || filterMissingUrgence || selectedAgentId ? "Aucun client trouvé" : "Aucun client"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm 
                    ? `Aucun résultat pour "${searchTerm}". Essayez avec d'autres termes ou vérifiez l'orthographe.`
                    : "Commencez par créer votre premier client."
                  }
                </p>
                {searchTerm && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-muted-foreground">Suggestions:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Badge variant="outline" className="text-xs">Vérifiez l'orthographe</Badge>
                      <Badge variant="outline" className="text-xs">Utilisez moins de mots</Badge>
                      <Badge variant="outline" className="text-xs">Essayez juste le nom</Badge>
                    </div>
                  </div>
                )}
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
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => {
                            setSortBy('nom');
                            setSortDir((d) => (sortBy === 'nom' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
                          }}
                        >
                          Nom <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => {
                            setSortBy('email');
                            setSortDir((d) => (sortBy === 'email' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
                          }}
                        >
                          Contact <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={() => {
                            setSortBy('telephone');
                            setSortDir((d) => (sortBy === 'telephone' ? (d === 'asc' ? 'desc' : 'asc') : 'asc'));
                          }}
                        >
                          Téléphones <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead>
                        Urgence
                      </TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isFetching && currentClients.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <div className="h-8 w-full rounded bg-muted animate-pulse" />
                        </TableCell>
                      </TableRow>
                    )}
                    {currentClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{client.nom} {client.prenom}</span>
                              {getClientTypeBadge(client)}
                            </div>
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
          {totalPages > 1 && (totalCount as number) > 0 && (
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