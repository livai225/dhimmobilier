import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Search, Users, Building, Home, FileText, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SearchResult {
  id: string;
  type: 'client' | 'property' | 'location' | 'subscription';
  title: string;
  subtitle: string;
  url: string;
  icon: React.ReactNode;
  badge?: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Historique des recherches
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('global-search-history');
    return saved ? JSON.parse(saved) : [];
  });

  // Sauvegarder l'historique
  const saveToHistory = (term: string) => {
    if (!term.trim()) return;
    
    const newHistory = [term, ...searchHistory.filter(h => h !== term)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('global-search-history', JSON.stringify(newHistory));
  };

  // Récupérer toutes les données nécessaires pour la recherche
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-search'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nom, prenom, telephone_principal')
        .order('nom');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties-search'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proprietes')
        .select('id, nom, adresse, zone')
        .order('nom');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations-search'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select(`
          id,
          clients(nom, prenom, telephone_principal),
          proprietes(nom, adresse, zone)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions-search'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('souscriptions')
        .select(`
          id,
          clients(nom, prenom),
          proprietes(nom, adresse, zone),
          phase_actuelle
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fonction de recherche
  const searchResults = React.useMemo(() => {
    if (!searchTerm.trim()) return [];

    const term = searchTerm.toLowerCase();
    const results: SearchResult[] = [];

    // Recherche dans les clients
    clients.forEach(client => {
      const fullName = `${client.prenom || ''} ${client.nom || ''}`.toLowerCase();
      const phone = client.telephone_principal?.toLowerCase() || '';
      
      if (fullName.includes(term) || phone.includes(term)) {
        results.push({
          id: client.id,
          type: 'client',
          title: `${client.prenom || ''} ${client.nom || ''}`.trim(),
          subtitle: client.telephone_principal || 'Pas de téléphone',
          url: `/clients`,
          icon: <Users className="h-4 w-4" />,
          badge: 'Client'
        });
      }
    });

    // Recherche dans les propriétés
    properties.forEach(property => {
      const name = property.nom?.toLowerCase() || '';
      const address = property.adresse?.toLowerCase() || '';
      const zone = property.zone?.toLowerCase() || '';
      
      if (name.includes(term) || address.includes(term) || zone.includes(term)) {
        results.push({
          id: property.id,
          type: 'property',
          title: property.nom || 'Propriété sans nom',
          subtitle: `${property.adresse || 'Pas d\'adresse'}${property.zone ? ` • ${property.zone}` : ''}`,
          url: `/proprietes`,
          icon: <Building className="h-4 w-4" />,
          badge: 'Propriété'
        });
      }
    });

    // Recherche dans les locations
    locations.forEach(location => {
      const clientName = `${location.clients?.prenom || ''} ${location.clients?.nom || ''}`.toLowerCase();
      const propertyName = location.proprietes?.nom?.toLowerCase() || '';
      const propertyAddress = location.proprietes?.adresse?.toLowerCase() || '';
      
      if (clientName.includes(term) || propertyName.includes(term) || propertyAddress.includes(term)) {
        results.push({
          id: location.id,
          type: 'location',
          title: `${location.clients?.prenom || ''} ${location.clients?.nom || ''}`.trim(),
          subtitle: `Location • ${location.proprietes?.nom || 'Propriété'}`,
          url: `/locations`,
          icon: <Home className="h-4 w-4" />,
          badge: 'Location'
        });
      }
    });

    // Recherche dans les souscriptions
    subscriptions.forEach(subscription => {
      const clientName = `${subscription.clients?.prenom || ''} ${subscription.clients?.nom || ''}`.toLowerCase();
      const propertyName = subscription.proprietes?.nom?.toLowerCase() || '';
      const propertyAddress = subscription.proprietes?.adresse?.toLowerCase() || '';
      
      if (clientName.includes(term) || propertyName.includes(term) || propertyAddress.includes(term)) {
        results.push({
          id: subscription.id,
          type: 'subscription',
          title: `${subscription.clients?.prenom || ''} ${subscription.clients?.nom || ''}`.trim(),
          subtitle: `Souscription • ${subscription.proprietes?.nom || 'Propriété'} • ${subscription.phase_actuelle || 'Phase inconnue'}`,
          url: `/souscriptions`,
          icon: <FileText className="h-4 w-4" />,
          badge: 'Souscription'
        });
      }
    });

    // Limiter à 10 résultats pour éviter la surcharge
    return results.slice(0, 10);
  }, [searchTerm, clients, properties, locations, subscriptions]);

  // Gestion des raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setOpen(true);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
      
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = (result: SearchResult) => {
    saveToHistory(searchTerm);
    navigate(result.url);
    setOpen(false);
    setSearchTerm('');
  };

  const handleHistorySelect = (term: string) => {
    setSearchTerm(term);
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Bouton de déclenchement */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-muted/50 rounded-md hover:bg-muted transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Rechercher...</span>
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Dialog de recherche */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0">
          <Command className="rounded-lg border shadow-md">
            <CommandInput
              ref={inputRef}
              placeholder="Rechercher clients, propriétés, locations, souscriptions..."
              value={searchTerm}
              onValueChange={setSearchTerm}
              className="h-12"
            />
            <CommandList className="max-h-96">
              {searchResults.length === 0 && searchTerm && (
                <CommandEmpty>Aucun résultat trouvé pour "{searchTerm}"</CommandEmpty>
              )}
              
              {searchResults.length > 0 && (
                <CommandGroup heading="Résultats">
                  {searchResults.map((result) => (
                    <CommandItem
                      key={`${result.type}-${result.id}`}
                      onSelect={() => handleSelect(result)}
                      className="flex items-center gap-3 p-3 cursor-pointer"
                    >
                      <div className="flex-shrink-0 text-muted-foreground">
                        {result.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{result.title}</span>
                          <Badge variant="secondary" className="text-xs">
                            {result.badge}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {result.subtitle}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              
              {!searchTerm && (
                <>
                  {searchHistory.length > 0 && (
                    <CommandGroup heading="Recherches récentes">
                      {searchHistory.slice(0, 5).map((term, index) => (
                        <CommandItem
                          key={index}
                          onSelect={() => handleHistorySelect(term)}
                          className="flex items-center gap-3 p-3 cursor-pointer"
                        >
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{term}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  
                  <CommandEmpty>
                    <div className="flex flex-col items-center gap-2 py-6">
                      <Search className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Tapez pour rechercher dans votre base de données
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <kbd className="h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono font-medium">
                          ⌘K
                        </kbd>
                        <span>pour ouvrir rapidement</span>
                      </div>
                    </div>
                  </CommandEmpty>
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
