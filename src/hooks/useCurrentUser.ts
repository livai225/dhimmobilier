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
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // Load from localStorage on init
    const storedUserId = localStorage.getItem('current_user_id');
    const cachedUser = localStorage.getItem('cached_user_data');
    
    if (storedUserId) {
      // If we have cached data, use it immediately while loading fresh data
      if (cachedUser) {
        try {
          const parsed = JSON.parse(cachedUser);
          setCurrentUser(parsed);
        } catch (e) {
          console.warn('Failed to parse cached user data');
        }
      }
      loadUser(storedUserId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadUser = async (userId: string, isRetry: boolean = false) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('actif', true)
        .single();

      clearTimeout(timeoutId);

      if (error || !data) {
        console.error('Error loading user:', error);
        
        // If it's a network error and we have cached data, keep the user logged in
        const cachedUser = localStorage.getItem('cached_user_data');
        if (cachedUser && (error?.message?.includes('network') || error?.code === 'PGRST301')) {
          console.log('Using cached user data due to network error');
          if (!isRetry && retryCount < 3) {
            // Retry in background
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              loadUser(userId, true);
            }, 5000);
          }
          setIsLoading(false);
          return;
        }
        
        // Clear data on authentication errors
        localStorage.removeItem('current_user_id');
        localStorage.removeItem('cached_user_data');
        setCurrentUser(null);
      } else {
        // Cache the user data and reset retry count
        localStorage.setItem('cached_user_data', JSON.stringify(data));
        setCurrentUser(data);
        setRetryCount(0);
      }
    } catch (error: any) {
      console.error('Error loading user:', error);
      
      // Handle timeout or network errors gracefully
      if (error.name === 'AbortError' || error.message?.includes('network')) {
        const cachedUser = localStorage.getItem('cached_user_data');
        if (cachedUser && !isRetry && retryCount < 3) {
          console.log('Network error, retrying...');
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            loadUser(userId, true);
          }, 5000);
          setIsLoading(false);
          return;
        }
      }
      
      // Clear data on persistent errors
      localStorage.removeItem('current_user_id');
      localStorage.removeItem('cached_user_data');
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
    localStorage.removeItem('cached_user_data');
    setCurrentUser(null);
  };

  return {
    currentUser,
    setUser,
    clearUser,
    isLoading
  };
};