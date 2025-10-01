import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ActivityItem {
  id: string;
  title: string;
  description?: string;
  timestamp: Date | string;
  icon?: ReactNode;
  variant?: "default" | "success" | "warning" | "error";
}

interface ActivityTimelineProps {
  title: string;
  activities: ActivityItem[];
  emptyMessage?: string;
  className?: string;
}

const variantStyles = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-[hsl(var(--success-100))] text-[hsl(var(--success-600))] border-[hsl(var(--success-200))]",
  warning: "bg-[hsl(var(--warning-100))] text-[hsl(var(--warning-600))] border-[hsl(var(--warning-200))]",
  error: "bg-[hsl(var(--error-100))] text-[hsl(var(--error-600))] border-[hsl(var(--error-200))]",
};

export function ActivityTimeline({
  title,
  activities,
  emptyMessage = "Aucune activité récente",
  className,
}: ActivityTimelineProps) {
  return (
    <Card className={cn("transition-all duration-300 hover:shadow-md", className)}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div
                key={activity.id}
                className={cn(
                  "relative flex gap-4 pb-4",
                  index !== activities.length - 1 &&
                    "border-l-2 border-border ml-5 pl-6"
                )}
              >
                {/* Timeline dot */}
                <div
                  className={cn(
                    "absolute left-0 top-0 h-10 w-10 rounded-full border-2 flex items-center justify-center",
                    "transition-all duration-300 hover:scale-110",
                    variantStyles[activity.variant || "default"]
                  )}
                >
                  {activity.icon}
                </div>

                {/* Content */}
                <div className="flex-1 ml-12">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-foreground">
                        {activity.title}
                      </h4>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(
                        typeof activity.timestamp === "string"
                          ? new Date(activity.timestamp)
                          : activity.timestamp,
                        { addSuffix: true, locale: fr }
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
