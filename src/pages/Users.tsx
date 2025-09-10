import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Shield, User, Calculator, Lock } from "lucide-react";
import { toast } from "sonner";
import { ProtectedAction } from "@/components/ProtectedAction";

interface User {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  role: 'admin' | 'comptable' | 'secretaire';
  actif: boolean;
  username?: string;
  password_hash?: string;
}

interface AvailablePermission {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  category: string;
}

interface UserPermission {
  permission_name: string;
  granted: boolean;
}

export default function Users() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    username: '',
    password: '',
    role: 'secretaire' as 'admin' | 'comptable' | 'secretaire',
  });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const queryClient = useQueryClient();

  // Charger les permissions disponibles
  const { data: availablePermissions } = useQuery({
    queryKey: ['available-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('available_permissions')
        .select('*')
        .order('category, display_name');
      
      if (error) throw error;
      return data as AvailablePermission[];
    }
  });

  // Charger les permissions de l'utilisateur en cours d'édition
  const { data: userPermissions } = useQuery({
    queryKey: ['user-permissions', editingUser?.id],
    queryFn: async () => {
      if (!editingUser?.id) return [];
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission_name, granted')
        .eq('user_id', editingUser.id);
      
      if (error) throw error;
      return data as UserPermission[];
    },
    enabled: !!editingUser?.id
  });

  // Effet pour mettre à jour les permissions sélectionnées
  useEffect(() => {
    if (userPermissions) {
      const grantedPermissions = userPermissions
        .filter(p => p.granted)
        .map(p => p.permission_name);
      setSelectedPermissions(grantedPermissions);
    }
  }, [userPermissions]);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('nom');
      
      if (error) throw error;
      return data as User[];
    }
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof formData) => {
      // Hash le mot de passe si fourni
      let hashedPassword = null;
      if (userData.password) {
        // Pour le moment, simple hash - à améliorer pour la production
        hashedPassword = btoa(userData.password); // Base64 encoding - remplacer par bcrypt en production
      }

      const { password, ...userDataToInsert } = userData;
      const finalUserData = {
        ...userDataToInsert,
        password_hash: hashedPassword
      };

      const { data, error } = await supabase
        .from('users')
        .insert([finalUserData])
        .select()
        .single();
      
      if (error) throw error;

      // Sauvegarder les permissions personnalisées
      if (selectedPermissions.length > 0) {
        const permissionsToInsert = selectedPermissions.map(permissionName => ({
          user_id: data.id,
          permission_name: permissionName,
          granted: true
        }));

        const { error: permError } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (permError) {
          console.error('Error saving permissions:', permError);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success("Utilisateur créé avec succès");
    },
    onError: (error: any) => {
      toast.error(error.message?.includes('users_username_key') 
        ? "Ce nom d'utilisateur existe déjà" 
        : "Erreur lors de la création de l'utilisateur");
      console.error(error);
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...userData }: { id: string } & typeof formData) => {
      // Hash le mot de passe si fourni et modifié
      let hashedPassword = undefined;
      if (userData.password && userData.password.trim() !== '') {
        hashedPassword = btoa(userData.password); // Base64 encoding - remplacer par bcrypt en production
      }

      const { password, ...userDataToUpdate } = userData;
      const finalUserData = hashedPassword 
        ? { ...userDataToUpdate, password_hash: hashedPassword }
        : userDataToUpdate;

      const { data, error } = await supabase
        .from('users')
        .update(finalUserData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // Mettre à jour les permissions personnalisées
      // D'abord, supprimer toutes les permissions existantes
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', id);

      // Puis, insérer les nouvelles permissions sélectionnées
      if (selectedPermissions.length > 0) {
        const permissionsToInsert = selectedPermissions.map(permissionName => ({
          user_id: id,
          permission_name: permissionName,
          granted: true
        }));

        const { error: permError } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (permError) {
          console.error('Error saving permissions:', permError);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      setIsDialogOpen(false);
      resetForm();
      toast.success("Utilisateur modifié avec succès");
    },
    onError: (error: any) => {
      toast.error(error.message?.includes('users_username_key') 
        ? "Ce nom d'utilisateur existe déjà" 
        : "Erreur lors de la modification de l'utilisateur");
      console.error(error);
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('users')
        .update({ actif: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success("Utilisateur désactivé avec succès");
    },
    onError: (error) => {
      toast.error("Erreur lors de la désactivation de l'utilisateur");
      console.error(error);
    }
  });

  const resetForm = () => {
    setFormData({
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
      username: '',
      password: '',
      role: 'secretaire',
    });
    setSelectedPermissions([]);
    setEditingUser(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, ...formData });
    } else {
      createUserMutation.mutate(formData);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      nom: user.nom,
      prenom: user.prenom,
      email: user.email || '',
      telephone: user.telephone || '',
      username: user.username || '',
      password: '', // Ne pas pré-remplir le mot de passe
      role: user.role,
    });
    setIsDialogOpen(true);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'comptable': return 'secondary';
      case 'secretaire': return 'outline';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrateur';
      case 'comptable': return 'Comptable';
      case 'secretaire': return 'Secrétaire';
      default: return role;
    }
  };

  return (
    <ProtectedAction permission="canManageUsers" showMessage>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestion des Utilisateurs</h1>
            <p className="text-muted-foreground">
              Gérez les utilisateurs et leurs rôles dans le système
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvel Utilisateur
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prenom">Prénom *</Label>
                    <Input
                      id="prenom"
                      value={formData.prenom}
                      onChange={(e) => setFormData(prev => ({ ...prev, prenom: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom *</Label>
                    <Input
                      id="nom"
                      value={formData.nom}
                      onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input
                    id="telephone"
                    value={formData.telephone}
                    onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
                  />
                </div>

                <Separator />
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Nom d'utilisateur *
                    </Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      required
                      placeholder="login_utilisateur"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Mot de passe {editingUser ? '' : '*'}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      required={!editingUser}
                      placeholder={editingUser ? "Laisser vide pour ne pas changer" : "mot_de_passe"}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Rôle *</Label>
                  <Select 
                    value={formData.role} 
                    onValueChange={(value: 'admin' | 'comptable' | 'secretaire') => 
                      setFormData(prev => ({ ...prev, role: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Administrateur
                        </div>
                      </SelectItem>
                      <SelectItem value="comptable">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-4 w-4" />
                          Comptable
                        </div>
                      </SelectItem>
                      <SelectItem value="secretaire">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Secrétaire
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Section des permissions personnalisées */}
                {availablePermissions && availablePermissions.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Permissions personnalisées</Label>
                      <p className="text-sm text-muted-foreground">
                        Accordez des permissions spécifiques en plus de celles du rôle.
                      </p>
                      
                      <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto border rounded-md p-3">
                        {availablePermissions.map((permission) => (
                          <div key={permission.id} className="flex items-start space-x-3">
                            <Checkbox
                              id={permission.name}
                              checked={selectedPermissions.includes(permission.name)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedPermissions(prev => [...prev, permission.name]);
                                } else {
                                  setSelectedPermissions(prev => prev.filter(p => p !== permission.name));
                                }
                              }}
                            />
                            <div className="space-y-1 leading-none">
                              <Label
                                htmlFor={permission.name}
                                className="text-sm font-medium leading-none cursor-pointer"
                              >
                                {permission.display_name}
                              </Label>
                              {permission.description && (
                                <p className="text-xs text-muted-foreground">
                                  {permission.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                    {editingUser ? 'Modifier' : 'Créer'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p>Chargement...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom complet</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.filter(u => u.actif).map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.prenom} {user.nom}
                  </TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>{user.telephone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {getRoleLabel(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteUserMutation.mutate(user.id)}
                        disabled={deleteUserMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </ProtectedAction>
  );
}