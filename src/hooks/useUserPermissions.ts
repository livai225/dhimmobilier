import { useCurrentUser } from "./useCurrentUser";

export const useUserPermissions = () => {
  const { currentUser } = useCurrentUser();

  if (!currentUser) {
    return {
      canAccessAll: false,
      canManageUsers: false,
      canPayRents: false,
      canPayLandRights: false,
      canPayInvoices: false,
      canCreateSuppliers: false,
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
    };
  }

  const isAdmin = currentUser.role === 'admin';
  const isComptable = currentUser.role === 'comptable';
  const isSecretaire = currentUser.role === 'secretaire';

  return {
    // Admin permissions - accès complet
    canAccessAll: isAdmin,
    canManageUsers: isAdmin,
    
    // Comptable permissions
    canPayRents: isAdmin || isComptable,
    canPayLandRights: isAdmin || isComptable,
    canPayInvoices: isAdmin || isComptable,
    canCreateSuppliers: isAdmin || isComptable,
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
  };
};