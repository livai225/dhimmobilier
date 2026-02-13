import { useState, useEffect, useRef } from "react";
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
const USER_CACHE_TTL_MS = 30_000;

type SharedUserState = {
  currentUser: User | null;
  isLoading: boolean;
  lastLoadedAt: number;
};

const sharedState: SharedUserState = {
  currentUser: null,
  isLoading: true,
  lastLoadedAt: 0,
};

let inFlightUserRequest: Promise<User | null> | null = null;
const subscribers = new Set<(state: SharedUserState) => void>();

const getStoredUserId = () => localStorage.getItem("current_user_id");
const getCachedUser = () => {
  const cachedUser = localStorage.getItem("cached_user_data");
  if (!cachedUser) return null;
  try {
    return JSON.parse(cachedUser) as User;
  } catch {
    return null;
  }
};

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber({ ...sharedState }));
}

function setSharedState(partial: Partial<SharedUserState>) {
  Object.assign(sharedState, partial);
  notifySubscribers();
}

async function fetchCurrentUser(userId: string): Promise<User | null> {
  if (inFlightUserRequest) return inFlightUserRequest;

  inFlightUserRequest = (async () => {
    try {
      const res = await apiClient.currentUser();
      const user = res.user?.id === userId ? (res.user as User) : null;
      return user;
    } finally {
      inFlightUserRequest = null;
    }
  })();

  return inFlightUserRequest;
}

export const useCurrentUser = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(sharedState.currentUser);
  const [isLoading, setIsLoading] = useState(sharedState.isLoading);
  const retryCountRef = useRef(0);

  useEffect(() => {
    const onSharedChange = (state: SharedUserState) => {
      setCurrentUser(state.currentUser);
      setIsLoading(state.isLoading);
    };

    subscribers.add(onSharedChange);

    const storedUserId = getStoredUserId();
    const cachedUser = getCachedUser();

    if (!storedUserId) {
      setSharedState({ currentUser: null, isLoading: false, lastLoadedAt: Date.now() });
      return () => {
        subscribers.delete(onSharedChange);
      };
    }

    if (!sharedState.currentUser && cachedUser) {
      setSharedState({ currentUser: cachedUser, isLoading: true });
    }

    const now = Date.now();
    const isFresh =
      sharedState.lastLoadedAt > 0 &&
      now - sharedState.lastLoadedAt < USER_CACHE_TTL_MS &&
      !!sharedState.currentUser;

    if (!isFresh) {
      void loadUser(storedUserId);
    } else {
      setSharedState({ isLoading: false });
    }

    return () => {
      subscribers.delete(onSharedChange);
    };
  }, []);

  const loadUser = async (userId: string, isRetry: boolean = false) => {
    setSharedState({ isLoading: true });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      let data: User | null = null;
      let error: any = null;

      try {
        data = await fetchCurrentUser(userId);
      } catch (e: any) {
        error = e;
      }

      clearTimeout(timeoutId);

      if (error || !data) {
        console.error('Error loading user:', error);
        
        // If it's a network error and we have cached data, keep the user logged in
        const cachedUser = getCachedUser();
        if (cachedUser && (error?.message?.includes('network') || error?.message?.includes('Failed to fetch'))) {
          console.log("Using cached user data due to network error");
          if (!isRetry && retryCountRef.current < MAX_RETRIES) {
            // Retry in background
            retryCountRef.current += 1;
            setTimeout(() => {
              void loadUser(userId, true);
            }, RETRY_DELAY_MS);
          }
          setSharedState({
            currentUser: cachedUser,
            isLoading: false,
            lastLoadedAt: Date.now(),
          });
          return;
        }
        
        // Clear data on authentication errors
        localStorage.removeItem("current_user_id");
        localStorage.removeItem("cached_user_data");
        setSharedState({ currentUser: null });
      } else {
        // Cache the user data and reset retry count
        localStorage.setItem("cached_user_data", JSON.stringify(data));
        setSharedState({ currentUser: data, lastLoadedAt: Date.now() });
        retryCountRef.current = 0;
      }
    } catch (error: any) {
      console.error("Error loading user:", error);
      
      // Handle timeout or network errors gracefully
      if (error.name === "AbortError" || error.message?.includes("network")) {
        const cachedUser = getCachedUser();
        if (cachedUser && !isRetry && retryCountRef.current < MAX_RETRIES) {
          console.log("Network error, retrying...");
          retryCountRef.current += 1;
          setTimeout(() => {
            void loadUser(userId, true);
          }, RETRY_DELAY_MS);
          setSharedState({
            currentUser: cachedUser,
            isLoading: false,
            lastLoadedAt: Date.now(),
          });
          return;
        }
      }
      
      // Clear data on persistent errors
      localStorage.removeItem("current_user_id");
      localStorage.removeItem("cached_user_data");
      setSharedState({ currentUser: null });
    } finally {
      setSharedState({ isLoading: false });
    }
  };

  const setUser = async (userId: string) => {
    // Prevent setting the same user ID to avoid unnecessary re-renders
    if (sharedState.currentUser?.id === userId) {
      return;
    }
    
    console.log("Changing user from", sharedState.currentUser?.id, "to", userId);
    localStorage.setItem("current_user_id", userId);
    setSharedState({ isLoading: true, lastLoadedAt: 0 });
    await loadUser(userId);
  };

  const clearUser = () => {
    localStorage.removeItem("current_user_id");
    localStorage.removeItem("cached_user_data");
    setSharedState({ currentUser: null, isLoading: false, lastLoadedAt: Date.now() });
  };

  return {
    currentUser,
    setUser,
    clearUser,
    isLoading
  };
};
