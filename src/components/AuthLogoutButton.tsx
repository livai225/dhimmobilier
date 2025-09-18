import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useAuthContext } from '@/components/AuthProvider';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function AuthLogoutButton() {
  const { signOut } = useAuthContext();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      
      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de se déconnecter",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Déconnexion réussie",
        description: "À bientôt !",
      });
      
      navigate('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite",
        variant: "destructive",
      });
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleLogout}
      className="gap-2"
    >
      <LogOut className="h-4 w-4" />
      Déconnexion
    </Button>
  );
}