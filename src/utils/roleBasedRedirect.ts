import { User } from "@/hooks/useCurrentUser";

export const getDefaultRouteForRole = (user: User): string => {
  switch (user.role) {
    case 'admin':
      return '/dashboard';
    case 'comptable':
      return '/dashboard';
    case 'secretaire':
      return '/clients';
    default:
      return '/clients';
  }
};

export const getFirstAvailableRoute = (role: string): string => {
  const routes = {
    admin: ['/dashboard'],
    comptable: ['/dashboard', '/clients', '/proprietes', '/fournisseurs', '/factures', '/caisse', '/recus'],
    secretaire: ['/clients', '/proprietes', '/souscriptions', '/locations', '/agents', '/recus']
  };
  
  return routes[role as keyof typeof routes]?.[0] || '/clients';
};