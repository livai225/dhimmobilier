import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";

interface ProtectedActionProps {
  children: React.ReactNode;
  permission: keyof ReturnType<typeof useUserPermissions>;
  fallback?: React.ReactNode;
  showMessage?: boolean;
}

export function ProtectedAction({ 
  children, 
  permission, 
  fallback = null,
  showMessage = false 
}: ProtectedActionProps) {
  const { currentUser } = useCurrentUser();
  const permissions = useUserPermissions();

  if (!currentUser) {
    if (showMessage) {
      return (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Veuillez sélectionner un utilisateur pour continuer.
          </AlertDescription>
        </Alert>
      );
    }
    return fallback;
  }

  if (!permissions[permission]) {
    if (showMessage) {
      return (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Vous n'avez pas les permissions nécessaires pour cette action.
          </AlertDescription>
        </Alert>
      );
    }
    return fallback;
  }

  return <>{children}</>;
}