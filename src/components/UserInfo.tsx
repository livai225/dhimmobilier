import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

const getRoleDisplayName = (role: string): string => {
  const roleMap = {
    admin: "Administrateur",
    comptable: "Comptable", 
    secretaire: "Secrétaire"
  };
  return roleMap[role as keyof typeof roleMap] || role;
};

export function UserInfo() {
  const { currentUser } = useCurrentUser();

  if (!currentUser) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <User className="h-4 w-4" />
        <span>Aucun utilisateur</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="text-sm">
        <div className="font-medium">
          {currentUser.prenom} {currentUser.nom}
        </div>
      </div>
      <Badge variant="secondary" className="text-xs">
        {getRoleDisplayName(currentUser.role)}
      </Badge>
    </div>
  );
}