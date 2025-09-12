import React from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de se déconnecter",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Déconnexion",
          description: "Vous avez été déconnecté avec succès",
        });
      }
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
