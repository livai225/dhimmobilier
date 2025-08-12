import { ButtonHTMLAttributes } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

interface Column<Row> {
  header: string;
  key?: string;
  accessor?: (row: Row) => any;
}

interface ExportToExcelButtonProps<Row> extends ButtonHTMLAttributes<HTMLButtonElement> {
  filename: string;
  rows: Row[];
  columns: Column<Row>[];
  label?: string;
}

export function ExportToExcelButton<Row>({ filename, rows, columns, label = "Exporter Excel", ...props }: ExportToExcelButtonProps<Row>) {
  const handleExport = () => {
    if (!rows || rows.length === 0) return;

    const safeRows = rows.map((row) => {
      const obj: Record<string, any> = {};
      columns.forEach((col) => {
        const value = col.accessor ? col.accessor(row) : col.key ? (row as any)[col.key] : undefined;
        obj[col.header] = value ?? "";
      });
      return obj;
    });

    const worksheet = XLSX.utils.json_to_sheet(safeRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Données");

    const safeFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
    XLSX.writeFile(workbook, safeFilename);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
      {...props}
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}
