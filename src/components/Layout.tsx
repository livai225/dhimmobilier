import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import BalanceBadge from "@/components/BalanceBadge";
import { LogoutButton } from "@/components/LogoutButton";
import { AuthLogoutButton } from "@/components/AuthLogoutButton";
import { UserInfo } from "@/components/UserInfo";
import { useAuthContext } from "@/components/AuthProvider";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user } = useAuthContext();
  
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1">
        <div className="border-b">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex items-center">
              <SidebarTrigger />
              <div className="ml-4">
                <h1 className="text-xl font-semibold">DH Immobilier Pro</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BalanceBadge />
              {user && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              )}
              <AuthLogoutButton />
              <ThemeToggle />
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
}