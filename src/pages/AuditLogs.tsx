import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Eye, Plus, Edit, Trash2, LogIn, LogOut, Search, Download, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AuditLogs() {
  const { currentUser } = useCurrentUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedTable, setSelectedTable] = useState('all');
  const [dateRange, setDateRange] = useState('7'); // days

  // Check if user is admin
  const isAdmin = currentUser?.role === 'admin';

  // IMPORTANT: Always call hooks, even if we'll conditionally render
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-audit'],
    queryFn: async () => {
      if (!isAdmin) return []; // Don't fetch if not admin
      
      const { data, error } = await supabase
        .from('users')
        .select('id, nom, prenom')
        .eq('actif', true);
      
      if (error) throw error;
      return data;
    },
    enabled: isAdmin // Only run query if admin
  });

  const { data: auditLogs = [], isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', selectedUser, selectedAction, selectedTable, dateRange, searchTerm],
    queryFn: async () => {
      if (!isAdmin) return []; // Don't fetch if not admin
      
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          users:user_id (nom, prenom)
        `)
        .order('timestamp', { ascending: false })
        .limit(999999);

      // Apply filters
      if (selectedUser !== 'all') {
        query = query.eq('user_id', selectedUser);
      }

      if (selectedAction !== 'all') {
        query = query.eq('action_type', selectedAction);
      }

      if (selectedTable !== 'all') {
        query = query.eq('table_name', selectedTable);
      }

      if (dateRange !== 'all') {
        const days = parseInt(dateRange);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        query = query.gte('timestamp', startDate.toISOString());
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin, // Only run query if admin
    refetchInterval: isAdmin ? 30000 : false // Auto refresh only if admin
  });

  // NOW we can do conditional rendering after all hooks are called
  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Accès refusé</h3>
              <p className="text-muted-foreground">Seuls les administrateurs peuvent accéder aux logs d'audit.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return <Plus className="h-4 w-4" />;
      case 'UPDATE': return <Edit className="h-4 w-4" />;
      case 'DELETE': return <Trash2 className="h-4 w-4" />;
      case 'VIEW': return <Eye className="h-4 w-4" />;
      case 'LOGIN': return <LogIn className="h-4 w-4" />;
      case 'LOGOUT': return <LogOut className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'CREATE': return 'default';
      case 'UPDATE': return 'secondary';
      case 'DELETE': return 'destructive';
      case 'VIEW': return 'outline';
      case 'LOGIN': return 'default';
      case 'LOGOUT': return 'secondary';
      default: return 'outline';
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    const searchLower = searchTerm.toLowerCase();
    const userName = log.users ? `${log.users.prenom} ${log.users.nom}` : '';
    return (
      userName.toLowerCase().includes(searchLower) ||
      log.table_name.toLowerCase().includes(searchLower) ||
      log.description?.toLowerCase().includes(searchLower) ||
      log.action_type.toLowerCase().includes(searchLower)
    );
  });

  const exportLogs = () => {
    const csvContent = [
      ['Date/Heure', 'Utilisateur', 'Action', 'Table', 'Description'].join(','),
      ...filteredLogs.map(log => [
        format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
        log.users ? `${log.users.prenom} ${log.users.nom}` : 'Système',
        log.action_type,
        log.table_name,
        log.description || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const uniqueTables = [...new Set(auditLogs.map(log => log.table_name))].sort();

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Logs d'Audit</h1>
          <p className="text-muted-foreground">Surveillez toutes les actions des utilisateurs</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
          <Button onClick={exportLogs} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredLogs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Créations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {filteredLogs.filter(log => log.action_type === 'CREATE').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Modifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {filteredLogs.filter(log => log.action_type === 'UPDATE').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Suppressions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {filteredLogs.filter(log => log.action_type === 'DELETE').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Utilisateur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les utilisateurs</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.prenom} {user.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les actions</SelectItem>
                <SelectItem value="CREATE">Création</SelectItem>
                <SelectItem value="UPDATE">Modification</SelectItem>
                <SelectItem value="DELETE">Suppression</SelectItem>
                <SelectItem value="VIEW">Consultation</SelectItem>
                <SelectItem value="LOGIN">Connexion</SelectItem>
                <SelectItem value="LOGOUT">Déconnexion</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger>
                <SelectValue placeholder="Table" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les tables</SelectItem>
                {uniqueTables.map(table => (
                  <SelectItem key={table} value={table}>
                    {table}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Aujourd'hui</SelectItem>
                <SelectItem value="7">7 derniers jours</SelectItem>
                <SelectItem value="30">30 derniers jours</SelectItem>
                <SelectItem value="90">90 derniers jours</SelectItem>
                <SelectItem value="all">Toute la période</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              onClick={() => {
                setSearchTerm('');
                setSelectedUser('all');
                setSelectedAction('all');
                setSelectedTable('all');
                setDateRange('7');
              }}
              variant="outline"
            >
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Journal d'Activité</CardTitle>
          <CardDescription>
            {filteredLogs.length} entrée(s) trouvée(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Heure</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        {log.users ? `${log.users.prenom} ${log.users.nom}` : 'Système'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action_type)} className="gap-1">
                          {getActionIcon(log.action_type)}
                          {log.action_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.table_name}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.description}
                      </TableCell>
                      <TableCell>
                        {(log.old_values || log.new_values) && (
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}