import { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface MobileCardProps {
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  fields: Array<{
    label: string;
    value: ReactNode;
  }>;
  actions?: Array<{
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  }>;
  className?: string;
}

export function MobileCard({ 
  title, 
  subtitle, 
  badge, 
  fields, 
  actions, 
  className = "" 
}: MobileCardProps) {
  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {badge && (
            <Badge variant={badge.variant || "default"}>{badge.text}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fields */}
        <div className="grid grid-cols-2 gap-3">
          {fields.map((field, index) => (
            <div key={index} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {field.label}
              </p>
              <div className="text-sm">{field.value}</div>
            </div>
          ))}
        </div>
        
        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || "outline"}
                size="sm"
                onClick={action.onClick}
                className="flex-1 sm:flex-initial"
              >
                {action.icon && <span className="mr-2">{action.icon}</span>}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}