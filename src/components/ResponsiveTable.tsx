import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ResponsiveTableProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function ResponsiveTable({ title, children, className = "" }: ResponsiveTableProps) {
  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="overflow-x-auto">
        <div className="min-w-[600px]">
          <Table>
            {children}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

interface ResponsiveTableHeaderProps {
  children: ReactNode;
}

export function ResponsiveTableHeader({ children }: ResponsiveTableHeaderProps) {
  return (
    <TableHeader>
      <TableRow>
        {children}
      </TableRow>
    </TableHeader>
  );
}

interface ResponsiveTableBodyProps {
  children: ReactNode;
}

export function ResponsiveTableBody({ children }: ResponsiveTableBodyProps) {
  return (
    <TableBody>
      {children}
    </TableBody>
  );
}

interface ResponsiveTableHeadProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveTableHead({ children, className = "" }: ResponsiveTableHeadProps) {
  return (
    <TableHead className={className}>
      {children}
    </TableHead>
  );
}

interface ResponsiveTableCellProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveTableCell({ children, className = "" }: ResponsiveTableCellProps) {
  return (
    <TableCell className={className}>
      {children}
    </TableCell>
  );
}

interface ResponsiveTableRowProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveTableRow({ children, className = "" }: ResponsiveTableRowProps) {
  return (
    <TableRow className={className}>
      {children}
    </TableRow>
  );
}