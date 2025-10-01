import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  variant?: "default" | "primary" | "success" | "warning" | "error";
  className?: string;
}

const variantStyles = {
  default: {
    bg: "bg-card",
    iconBg: "bg-muted",
    iconColor: "text-foreground",
    border: "border-border",
  },
  primary: {
    bg: "bg-gradient-to-br from-primary/10 to-primary/5",
    iconBg: "bg-primary/20",
    iconColor: "text-primary",
    border: "border-primary/20",
  },
  success: {
    bg: "bg-gradient-to-br from-[hsl(var(--success-50))] to-transparent",
    iconBg: "bg-[hsl(var(--success-100))]",
    iconColor: "text-[hsl(var(--success-600))]",
    border: "border-[hsl(var(--success-200))]",
  },
  warning: {
    bg: "bg-gradient-to-br from-[hsl(var(--warning-50))] to-transparent",
    iconBg: "bg-[hsl(var(--warning-100))]",
    iconColor: "text-[hsl(var(--warning-600))]",
    border: "border-[hsl(var(--warning-200))]",
  },
  error: {
    bg: "bg-gradient-to-br from-[hsl(var(--error-50))] to-transparent",
    iconBg: "bg-[hsl(var(--error-100))]",
    iconColor: "text-[hsl(var(--error-600))]",
    border: "border-[hsl(var(--error-200))]",
  },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  variant = "default",
  className,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-1",
        styles.bg,
        styles.border,
        className
      )}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div
            className={cn(
              "rounded-lg p-2.5 transition-transform duration-300 group-hover:scale-110",
              styles.iconBg
            )}
          >
            <Icon className={cn("h-5 w-5", styles.iconColor)} />
          </div>
          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                trend.isPositive
                  ? "bg-[hsl(var(--success-100))] text-[hsl(var(--success-600))]"
                  : "bg-[hsl(var(--error-100))] text-[hsl(var(--error-600))]"
              )}
            >
              <span>{trend.isPositive ? "↑" : "↓"}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold text-foreground">{value}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Decorative gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </Card>
  );
}
