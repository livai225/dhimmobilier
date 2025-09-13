import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  Users, 
  Building, 
  Truck, 
  FileText, 
  UserCheck, 
  Home,
  Receipt,
  Settings,
  Wallet,
  UserCog,
  Shield
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import React from "react";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    permission: "canAccessDashboard" as const,
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Users,
    permission: "canAccessClients" as const,
  },
  {
    title: "Propriétés",
    url: "/proprietes",
    icon: Building,
    permission: "canAccessProperties" as const,
  },
  {
    title: "Fournisseurs",
    url: "/fournisseurs",
    icon: Truck,
    permission: "canAccessSuppliers" as const,
  },
  {
    title: "Factures",
    url: "/factures",
    icon: FileText,
    permission: "canAccessInvoices" as const,
  },
  {
    title: "Souscriptions",
    url: "/souscriptions",
    icon: UserCheck,
    permission: "canAccessSubscriptions" as const,
  },
  {
    title: "Locations",
    url: "/locations",
    icon: Home,
    permission: "canAccessRentals" as const,
  },
  {
    title: "Solde caisse versement",
    url: "/caisse",
    icon: Wallet,
    permission: "canAccessCashbox" as const,
  },
  {
    title: "Agents",
    url: "/agents",
    icon: UserCog,
    permission: "canAccessAgents" as const,
  },
  {
    title: "Reçus",
    url: "/recus",
    icon: Receipt,
    permission: "canAccessReceipts" as const,
  },
  {
    title: "Utilisateurs",
    url: "/users",
    icon: UserCog,
    permission: "canManageUsers" as const,
  },
  {
    title: "Logs d'Audit",
    url: "/audit-logs",
    icon: Shield,
    permission: "isAdmin" as const,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const permissions = useUserPermissions();

  const filteredMenuItems = menuItems.filter(item => 
    permissions[item.permission]
  );

  // Auto-redirect secretary users from dashboard to their first available page
  React.useEffect(() => {
    if (location.pathname === '/' && !permissions.canAccessDashboard && filteredMenuItems.length > 0) {
      const firstAvailableItem = filteredMenuItems[0];
      window.location.replace(firstAvailableItem.url);
    }
  }, [location.pathname, permissions.canAccessDashboard, filteredMenuItems]);

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    isActive={location.pathname === item.url}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {permissions.isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/settings">
                  <Settings />
                  <span>Paramètres</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}