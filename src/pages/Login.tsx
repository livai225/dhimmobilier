import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { apiClient } from '@/integrations/api/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Eye, EyeOff, LogIn, Building2 } from 'lucide-react';

// Function to decode base64 password hash
  const decodeBase64 = (encoded: string): string => {
    try {
      return atob(encoded);
    } catch (error) {
      console.error('Error decoding base64:', error);
      return encoded; // Return original if decode fails
    }
  };

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { logLogin } = useAuditLog();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const useApi = import.meta.env.VITE_USE_API === 'true';

      if (useApi) {
        // --- Nouveau mode API MySQL ---
        const { user } = await apiClient.login({ username, password });
        localStorage.setItem('current_user_id', user.id);
        logLogin(`Connexion via API - ${user.prenom} ${user.nom} (${user.username})`);
        toast({
          title: 'Connexion réussie',
          description: `Bienvenue ${user.prenom} ${user.nom}`,
        });
        const { getDefaultRouteForRole } = await import('@/utils/roleBasedRedirect');
        navigate(getDefaultRouteForRole(user));
      } else {
        // --- Mode Supabase legacy ---
        // Find the user by username and verify password
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, nom, prenom, username, password_hash, role, actif')
          .eq('username', username)
          .eq('actif', true)
          .single();

        if (userError || !userData) {
          setError('Nom d\'utilisateur ou mot de passe incorrect');
          return;
        }

        // Decode the base64 password hash and compare with entered password
        const decodedPassword = decodeBase64(userData.password_hash);
        if (decodedPassword !== password) {
          setError('Nom d\'utilisateur ou mot de passe incorrect');
          return;
        }

        // Set the user data for the application to use
        localStorage.setItem('current_user_id', userData.id);

        // Log the login action using our improved audit system
        logLogin(`Connexion réussie - ${userData.prenom} ${userData.nom} (${userData.username})`);

        toast({
          title: 'Connexion réussie',
          description: `Bienvenue ${userData.prenom} ${userData.nom}`,
        });
      
        // Import role-based redirect utility
        const { getDefaultRouteForRole } = await import('@/utils/roleBasedRedirect');
        
        // Redirect based on user role
        const defaultRoute = getDefaultRouteForRole(userData);
        navigate(defaultRoute);
      }
    } catch (err) {
      setError('Une erreur inattendue s\'est produite');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">DH Immobilier</CardTitle>
          <CardDescription>
            Connectez-vous à votre espace de gestion immobilière
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input
                id="username"
                type="text"
                placeholder="Votre nom d'utilisateur"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Connexion...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Se connecter
                </div>
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Besoin d'aide ? Contactez votre administrateur</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
