import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChartWidgetProps {
  title: string;
  description?: string;
  children: ReactNode;
  isLoading?: boolean;
  actions?: ReactNode;
  className?: string;
}

export function ChartWidget({
  title,
  description,
  children,
  isLoading = false,
  actions,
  className,
}: ChartWidgetProps) {
  return (
    <Card
      className={cn(
        "transition-all duration-300 hover:shadow-md",
        "border-border bg-card",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          {description && (
            <CardDescription className="text-sm">{description}</CardDescription>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-[300px] w-full" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
