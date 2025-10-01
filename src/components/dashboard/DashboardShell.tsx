import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  children: ReactNode;
  className?: string;
}

export function DashboardShell({ children, className }: DashboardShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-br from-background via-background to-muted/20",
        className
      )}
    >
      <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {children}
      </div>
    </div>
  );
}

interface DashboardHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function DashboardHeader({
  title,
  description,
  actions,
  className,
}: DashboardHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-center md:justify-between",
        "pb-6 border-b border-border",
        className
      )}
    >
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight gradient-text">
          {title}
        </h1>
        {description && (
          <p className="text-base text-muted-foreground max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap">{actions}</div>
      )}
    </div>
  );
}

interface DashboardGridProps {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4;
  className?: string;
}

export function DashboardGrid({
  children,
  cols = 4,
  className,
}: DashboardGridProps) {
  const colsClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div
      className={cn(
        "grid gap-4 md:gap-6",
        colsClass[cols],
        "animate-stagger",
        className
      )}
    >
      {children}
    </div>
  );
}

interface DashboardSectionProps {
  children: ReactNode;
  className?: string;
}

export function DashboardSection({
  children,
  className,
}: DashboardSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>{children}</section>
  );
}
