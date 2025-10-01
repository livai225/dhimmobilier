import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  variant?: "default" | "success" | "warning" | "error";
  className?: string;
}

const variantStyles = {
  default: {
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    gradient: "from-primary/5 to-transparent",
  },
  success: {
    iconBg: "bg-[hsl(var(--success-100))]",
    iconColor: "text-[hsl(var(--success-600))]",
    gradient: "from-[hsl(var(--success-50))] to-transparent",
  },
  warning: {
    iconBg: "bg-[hsl(var(--warning-100))]",
    iconColor: "text-[hsl(var(--warning-600))]",
    gradient: "from-[hsl(var(--warning-50))] to-transparent",
  },
  error: {
    iconBg: "bg-[hsl(var(--error-100))]",
    iconColor: "text-[hsl(var(--error-600))]",
    gradient: "from-[hsl(var(--error-50))] to-transparent",
  },
};

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: MetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-1",
        "border-border bg-card",
        className
      )}
    >
      {/* Gradient background */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-50",
          styles.gradient
        )}
      />

      {/* Content */}
      <div className="relative p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {title}
            </p>
            <h3 className="text-3xl font-bold text-foreground mb-2">
              {value}
            </h3>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>

          {/* Icon */}
          <div
            className={cn(
              "rounded-xl p-3 transition-transform duration-300",
              "group-hover:scale-110",
              styles.iconBg
            )}
          >
            <Icon className={cn("h-6 w-6", styles.iconColor)} />
          </div>
        </div>

        {/* Trend indicator */}
        {trend && (
          <div className="mt-4 flex items-center gap-2">
            <span
              className={cn(
                "text-xs font-semibold px-2 py-1 rounded-full",
                trend.isPositive !== false
                  ? "bg-[hsl(var(--success-100))] text-[hsl(var(--success-600))]"
                  : "bg-[hsl(var(--error-100))] text-[hsl(var(--error-600))]"
              )}
            >
              {trend.isPositive !== false ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
