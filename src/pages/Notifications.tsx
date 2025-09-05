import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Clock, FileX, Bell, Settings } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

export default function Notifications() {
  const [activeTab, setActiveTab] = useState("all");
  const { notifications, markAsRead, clearAll } = useNotifications();

  const getIconByType = (type: string) => {
    switch (type) {
      case "echeance_droit_terre": return <Clock className="h-4 w-4" />;
      case "loyer_retard": return <AlertTriangle className="h-4 w-4" />;
      case "facture_impayee": return <FileX className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  const filteredNotifications = notifications.filter(notif => 
    activeTab === "all" || notif.type === activeTab
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notifications & Alertes</h1>
          <p className="text-muted-foreground">
            Suivez les échéances et alertes importantes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={clearAll}>
            Tout marquer lu
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configurer
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Centre de notifications
            {notifications.filter(n => !n.read).length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {notifications.filter(n => !n.read).length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Toutes</TabsTrigger>
              <TabsTrigger value="echeance_droit_terre">Échéances</TabsTrigger>
              <TabsTrigger value="loyer_retard">Retards</TabsTrigger>
              <TabsTrigger value="facture_impayee">Factures</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              <div className="space-y-4">
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-8">
                    <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Aucune notification</p>
                  </div>
                ) : (
                  filteredNotifications.map((notification) => (
                    <Card 
                      key={notification.id}
                      className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                        !notification.read ? 'border-primary/50 bg-primary/5' : ''
                      }`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getIconByType(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{notification.title}</h4>
                              <Badge variant={getPriorityColor(notification.priority) as any}>
                                {notification.priority}
                              </Badge>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-primary rounded-full" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{notification.entity}</span>
                              <span>{new Date(notification.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}