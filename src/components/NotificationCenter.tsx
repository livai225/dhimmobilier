import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications } from "@/hooks/useNotifications";
import { Link } from "react-router-dom";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead } = useNotifications();
  
  const recentNotifications = notifications.slice(0, 5);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary">{unreadCount} nouvelles</Badge>
            )}
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {recentNotifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 hover:bg-accent/50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => {
                    markAsRead(notification.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-start gap-2">
                    {!notification.read && (
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.entity}
                      </p>
                    </div>
                    <Badge 
                      variant={notification.priority === 'high' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {notification.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {recentNotifications.length > 0 && (
          <div className="border-t p-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full"
              asChild
              onClick={() => setOpen(false)}
            >
              <Link to="/notifications">
                Voir toutes les notifications
              </Link>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}