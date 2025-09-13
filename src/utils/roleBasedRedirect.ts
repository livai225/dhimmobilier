import { User } from "@/hooks/useCurrentUser";

export const getDefaultRouteForRole = (user: User): string => {
  switch (user.role) {
    case 'admin':
      return '/';
    case 'comptable':
      return '/';
    case 'secretaire':
      return '/clients';
    default:
      return '/clients';
  }
};

export const getFirstAvailableRoute = (role: string): string => {
  const routes = {
    admin: ['/'],
    comptable: ['/', '/clients', '/proprietes', '/fournisseurs', '/factures', '/caisse', '/recus'],
    secretaire: ['/clients', '/proprietes', '/souscriptions', '/locations', '/agents', '/recus']
  };
  
  return routes[role as keyof typeof routes]?.[0] || '/clients';
};