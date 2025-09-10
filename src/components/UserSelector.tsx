import { useState, useEffect } from "react";
import { useCurrentUser, User } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User as UserIcon } from "lucide-react";

export function UserSelector() {
  const { currentUser, setUser, isLoading } = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('actif', true)
      .order('nom');

    if (!error && data) {
      setUsers(data);
      
      // Auto-select first admin if no user selected
      if (!currentUser && data.length > 0) {
        const adminUser = data.find(u => u.role === 'admin') || data[0];
        setUser(adminUser.id);
      }
    }
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
      case 'admin': return 'Admin';
      case 'comptable': return 'Comptable';
      case 'secretaire': return 'Secrétaire';
      default: return role;
    }
  };

  if (isLoading) {
    return <div className="flex items-center gap-2">
      <UserIcon className="h-4 w-4" />
      <span className="text-sm">Chargement...</span>
    </div>;
  }

  return (
    <div className="flex items-center gap-3">
      <Select
        value={currentUser?.id || ""}
        onValueChange={setUser}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Sélectionner un utilisateur">
            {currentUser && (
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {currentUser.prenom} {currentUser.nom}
                </span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              <div className="flex items-center gap-2">
                <span>{user.prenom} {user.nom}</span>
                <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                  {getRoleLabel(user.role)}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {currentUser && (
        <Badge variant={getRoleBadgeVariant(currentUser.role)}>
          {getRoleLabel(currentUser.role)}
        </Badge>
      )}
    </div>
  );
}