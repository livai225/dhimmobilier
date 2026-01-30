import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/api/client";
import { apiClient } from "@/integrations/api/client";

export interface User {
  id: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  role: 'admin' | 'comptable' | 'secretaire';
  actif: boolean;
  username?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export const useCurrentUser = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const retryCountRef = useRef(0);
  const useApi = import.meta.env.VITE_USE_API === 'true';

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

      let data: any = null;
      let error: any = null;

      if (useApi) {
        // Backend MySQL
        try {
          const res = await apiClient.currentUser();
          data = res.user?.id === userId ? res.user : null;
        } catch (e: any) {
          error = e;
        }
      } else {
        // Supabase legacy
        const response = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .eq('actif', true)
          .single();
        data = response.data;
        error = response.error;
      }

      clearTimeout(timeoutId);

      if (error || !data) {
        console.error('Error loading user:', error);
        
        // If it's a network error and we have cached data, keep the user logged in
        const cachedUser = localStorage.getItem('cached_user_data');
        if (cachedUser && (error?.message?.includes('network') || error?.code === 'PGRST301')) {
          console.log('Using cached user data due to network error');
          if (!isRetry && retryCountRef.current < MAX_RETRIES) {
            // Retry in background
            retryCountRef.current += 1;
            setTimeout(() => {
              loadUser(userId, true);
            }, RETRY_DELAY_MS);
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
        retryCountRef.current = 0;
      }
    } catch (error: any) {
      console.error('Error loading user:', error);
      
      // Handle timeout or network errors gracefully
      if (error.name === 'AbortError' || error.message?.includes('network')) {
        const cachedUser = localStorage.getItem('cached_user_data');
        if (cachedUser && !isRetry && retryCountRef.current < MAX_RETRIES) {
          console.log('Network error, retrying...');
          retryCountRef.current += 1;
          setTimeout(() => {
            loadUser(userId, true);
          }, RETRY_DELAY_MS);
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
