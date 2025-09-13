import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface User {
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

export const useCurrentUser = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage on init
    const storedUserId = localStorage.getItem('current_user_id');
    if (storedUserId) {
      loadUser(storedUserId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadUser = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('actif', true)
        .single();

      if (error || !data) {
        console.error('Error loading user:', error);
        localStorage.removeItem('current_user_id');
        setCurrentUser(null);
      } else {
        setCurrentUser(data);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      localStorage.removeItem('current_user_id');
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setUser = async (userId: string) => {
    // Prevent setting the same user ID to avoid unnecessary re-renders
    if (currentUser?.id === userId) {
      return;
    }
    
    console.log('Changing user from', currentUser?.id, 'to', userId);
    setIsLoading(true);
    localStorage.setItem('current_user_id', userId);
    await loadUser(userId);
  };

  const clearUser = () => {
    localStorage.removeItem('current_user_id');
    setCurrentUser(null);
  };

  return {
    currentUser,
    setUser,
    clearUser,
    isLoading
  };
};