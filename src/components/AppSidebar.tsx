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
  Bell,
  BarChart3,
  Calendar
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Users,
  },
  {
    title: "Propriétés",
    url: "/proprietes",
    icon: Building,
  },
  {
    title: "Fournisseurs",
    url: "/fournisseurs",
    icon: Truck,
  },
  {
    title: "Factures",
    url: "/factures",
    icon: FileText,
  },
  {
    title: "Souscriptions",
    url: "/souscriptions",
    icon: UserCheck,
  },
  {
    title: "Locations",
    url: "/locations",
    icon: Home,
  },
  {
    title: "Solde caisse versement",
    url: "/caisse",
    icon: Wallet,
  },
  {
    title: "Agents",
    url: "/agents",
    icon: UserCog,
  },
  {
    title: "Reçus",
    url: "/recus",
    icon: Receipt,
  },
  {
    title: "Notifications",
    url: "/notifications",
    icon: Bell,
  },
  {
    title: "Rapports",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "Calendrier",
    url: "/calendar",
    icon: Calendar,
  },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
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
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/settings">
                <Settings />
                <span>Paramètres</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}