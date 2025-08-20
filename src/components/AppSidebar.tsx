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
  UserCog
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
    title: "Caisse",
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
            <SidebarMenuButton>
              <Settings />
              <span>Paramètres</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}