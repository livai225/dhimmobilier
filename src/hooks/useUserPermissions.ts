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

  // Charger les permissions personnalisées
  useEffect(() => {
    if (currentUser?.id) {
      loadCustomPermissions();
    } else {
      setCustomPermissions([]);
    }
  }, [currentUser?.id]);

  const loadCustomPermissions = async () => {
    if (!currentUser?.id) return;
    
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
      // Utilitaires
      loading: false,
      refreshPermissions: () => Promise.resolve()
    };
  }

  const isAdmin = currentUser.role === 'admin';
  const isComptable = currentUser.role === 'comptable';
  const isSecretaire = currentUser.role === 'secretaire';

  // Permissions de création (combinaison rôle + permissions personnalisées)
  const creationPermissions = {
    canCreateClients: isAdmin || hasCustomPermission('can_create_clients'),
    canCreateProperties: isAdmin || hasCustomPermission('can_create_properties'),
    canCreateSuppliers: (isAdmin || isComptable) || hasCustomPermission('can_create_suppliers'),
    canCreateInvoices: (isAdmin || isComptable) || hasCustomPermission('can_create_invoices'),
    canCreateAgents: (isAdmin || isComptable) || hasCustomPermission('can_create_agents'),
  };

  return {
    // Admin permissions - accès complet
    canAccessAll: isAdmin,
    canManageUsers: isAdmin,
    
    // Comptable permissions
    canPayRents: isAdmin || isComptable,
    canPayLandRights: isAdmin || isComptable,
    canPayInvoices: isAdmin || isComptable,
    canViewReceipts: isAdmin || isComptable,
    
    // Secrétaire permissions
    canMakeDeposits: isAdmin || isSecretaire,
    canMakeExpenses: isAdmin || isSecretaire,
    canCreateSubscriptions: isAdmin || isSecretaire,
    canCreateRentals: isAdmin || isSecretaire,
    
    // Page access permissions
    canAccessDashboard: isAdmin || isComptable,
    canAccessClients: isAdmin || isSecretaire,
    canAccessProperties: isAdmin || isSecretaire,
    canAccessSuppliers: isAdmin || isComptable,
    canAccessInvoices: isAdmin || isComptable,
    canAccessSubscriptions: isAdmin || isSecretaire,
    canAccessRentals: isAdmin || isSecretaire,
    canAccessCashbox: isAdmin || isSecretaire,
    canAccessAgents: isAdmin,
    canAccessReceipts: isAdmin || isComptable,
    
    // Nouvelles permissions de création
    ...creationPermissions,
    
    // Utilitaires
    loading,
    refreshPermissions: loadCustomPermissions
  };
};