import React from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function LogoutButton() {
  const { clearUser } = useCurrentUser();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      clearUser();
      toast({
        title: "Déconnexion",
        description: "Vous avez été déconnecté avec succès",
      });
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      className="flex items-center gap-2"
    >
      <LogOut className="w-4 h-4" />
      Déconnexion
    </Button>
  );
}
