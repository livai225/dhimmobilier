import { useCurrentUser } from "./useCurrentUser";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserPermission {
  permission_name: string;
  granted: boolean;
}

export const useUserPermissions = () => {
  const { currentUser } = useCurrentUser();
  const [customPermissions, setCustomPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(false);

  // Charger les permissions personnalisées seulement pour les non-admins
  useEffect(() => {
    if (currentUser?.id && currentUser.role !== 'admin') {
      loadCustomPermissions();
    } else {
      setCustomPermissions([]);
      setLoading(false);
    }
  }, [currentUser?.id, currentUser?.role]);

  const loadCustomPermissions = async () => {
    if (!currentUser?.id || currentUser.role === 'admin') return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission_name, granted')
        .eq('user_id', currentUser.id);

      if (error) {
        console.error('Error loading custom permissions:', error);
      } else {
        setCustomPermissions(data || []);
      }
    } catch (error) {
      console.error('Error loading custom permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper pour vérifier une permission personnalisée
  const hasCustomPermission = (permissionName: string): boolean => {
    const permission = customPermissions.find(p => p.permission_name === permissionName);
    return permission?.granted ?? false;
  };

  if (!currentUser) {
    console.log('[useUserPermissions] No current user');
    return {
      // Permissions existantes
      canAccessAll: false,
      canManageUsers: false,
      canPayRents: false,
      canPayLandRights: false,
      canPayInvoices: false,
      canViewReceipts: false,
      canMakeDeposits: false,
      canMakeExpenses: false,
      canCreateSubscriptions: false,
      canCreateRentals: false,
      canAccessDashboard: false,
      canAccessClients: false,
      canAccessProperties: false,
      canAccessSuppliers: false,
      canAccessInvoices: false,
      canAccessSubscriptions: false,
      canAccessRentals: false,
      canAccessCashbox: false,
      canAccessAgents: false,
      canAccessReceipts: false,
      // Nouvelles permissions de création
      canCreateClients: false,
      canCreateProperties: false,
      canCreateSuppliers: false,
      canCreateInvoices: false,
      canCreateAgents: false,
      // Admin specific permissions
      isAdmin: false,
      // Utilitaires
      loading: false,
      refreshPermissions: () => Promise.resolve()
    };
  }

  const isAdmin = currentUser.role === 'admin';
  const isComptable = currentUser.role === 'comptable';
  const isSecretaire = currentUser.role === 'secretaire';
  
  console.log('[useUserPermissions] User role:', currentUser.role, 'isAdmin:', isAdmin);

  // Permissions de création (basées uniquement sur les rôles - pas de personnalisation pour éviter l'escalade de privilèges)
  const creationPermissions = {
    canCreateClients: isAdmin || isComptable, // Comptable peut créer des clients pour la facturation
    canCreateProperties: isAdmin, // Seuls les admins peuvent créer des propriétés
    canCreateSuppliers: isAdmin || isComptable, // Comptable peut créer des fournisseurs
    canCreateInvoices: isAdmin || isComptable, // Comptable peut créer des factures
    canCreateAgents: isAdmin, // Seuls les admins peuvent créer des agents
  };

  const permissions = {
    // Admin permissions - accès complet
    canAccessAll: isAdmin,
    canManageUsers: isAdmin,
    
    // Comptable permissions (finances uniquement)
    canPayRents: isAdmin || isComptable,
    canPayLandRights: isAdmin || isComptable,
    canPayInvoices: isAdmin || isComptable,
    canViewReceipts: isAdmin || isComptable || isSecretaire,
    
    // Secrétaire permissions (opérationnel uniquement)
    canMakeDeposits: isAdmin || isSecretaire,
    canMakeExpenses: isAdmin, // Seuls les admins peuvent faire des dépenses d'entreprise
    canCreateSubscriptions: isAdmin || isSecretaire,
    canCreateRentals: isAdmin || isSecretaire,
    
    // Page access permissions
    canAccessDashboard: isAdmin || isComptable, // Seuls admin et comptable voient le dashboard financier
    canAccessClients: isAdmin || isComptable || isSecretaire, // Comptable a besoin d'accès aux clients pour la facturation
    canAccessProperties: isAdmin || isComptable || isSecretaire, // Comptable a besoin d'accès aux propriétés pour la facturation
    canAccessSuppliers: isAdmin || isComptable,
    canAccessInvoices: isAdmin || isComptable,
    canAccessSubscriptions: isAdmin || isComptable || isSecretaire, // Comptable peut accéder pour les paiements
    canAccessRentals: isAdmin || isComptable || isSecretaire, // Comptable peut accéder pour les paiements
    canAccessCashbox: isAdmin || isSecretaire, // Accès caisse pour admin et secrétaire seulement
    canAccessAgents: isAdmin,
    canAccessReceipts: isAdmin || isComptable || isSecretaire, // Accès reçus pour secrétaire
    
    // Nouvelles permissions de création
    ...creationPermissions,
    
    // Admin specific permissions
    isAdmin: isAdmin,
    
    // Utilitaires
    loading,
    refreshPermissions: loadCustomPermissions
  };
  
  console.log('[useUserPermissions] Permissions calculated:', {
    canAccessClients: permissions.canAccessClients,
    canAccessProperties: permissions.canAccessProperties,
    canAccessAgents: permissions.canAccessAgents,
    isAdmin: permissions.isAdmin
  });
  
  return permissions;
};