import { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MobileCard } from "@/components/MobileCard";

interface ResponsiveViewProps<T> {
  data: T[];
  isLoading?: boolean;
  emptyState?: {
    icon?: ReactNode;
    title: string;
    description: string;
  };
  mobileCard?: {
    getTitle: (item: T) => string;
    getSubtitle?: (item: T) => string | undefined;
    getBadge?: (item: T) => { text: string; variant?: "default" | "secondary" | "destructive" | "outline" } | undefined;
    getFields: (item: T) => Array<{ label: string; value: ReactNode }>;
    getActions?: (item: T) => Array<{
      label: string;
      icon?: ReactNode;
      onClick: () => void;
      variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    }>;
  };
  desktopTable?: {
    columns: Array<{ header: string; accessor: (item: T) => ReactNode }>;
    actions?: (item: T) => ReactNode;
  };
}

export function ResponsiveView<T extends { id: string }>({
  data,
  isLoading = false,
  emptyState,
  mobileCard,
  desktopTable
}: ResponsiveViewProps<T>) {
  if (isLoading) {
    return <p className="text-center py-6">Chargement...</p>;
  }

  if (data.length === 0 && emptyState) {
    return (
      <div className="text-center py-10">
        {emptyState.icon}
        <h3 className="mt-2 text-sm font-semibold">{emptyState.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{emptyState.description}</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Cards (visible on small screens) */}
      {mobileCard && (
        <div className="block md:hidden space-y-3 animate-fade-in">
          {data.map((item) => (
            <MobileCard
              key={item.id}
              title={mobileCard.getTitle(item)}
              subtitle={mobileCard.getSubtitle?.(item)}
              badge={mobileCard.getBadge?.(item)}
              fields={mobileCard.getFields(item)}
              actions={mobileCard.getActions?.(item)}
            />
          ))}
        </div>
      )}

      {/* Desktop Table (hidden on small screens) */}
      {desktopTable && (
        <div className="hidden md:block">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {desktopTable.columns.map((column, index) => (
                    <TableHead key={index}>{column.header}</TableHead>
                  ))}
                  {desktopTable.actions && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.id}>
                    {desktopTable.columns.map((column, index) => (
                      <TableCell key={index}>{column.accessor(item)}</TableCell>
                    ))}
                    {desktopTable.actions && (
                      <TableCell>{desktopTable.actions(item)}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}