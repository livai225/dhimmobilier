type Filter =
  | { op: "eq" | "ilike" | "gte" | "lte"; column: string; value: any }
  | { op: "in"; column: string; values: any[] };

function isLikelyDateColumn(column: string): boolean {
  // Keep this conservative to avoid accidentally rewriting non-date string filters.
  return (
    column === "date" ||
    column.startsWith("date_") ||
    column.endsWith("_date") ||
    column.endsWith("_at")
  );
}

function coerceDateFilterValue(value: any): any {
  if (typeof value !== "string") return value;

  const v = value.trim();
  if (v.length === 0) return value;

  // Already a proper ISO-8601 DateTime with timezone (or a Date-only string handled below).
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)) {
    return new Date(v);
  }

  // "2026-02-01T00:00:00" -> "2026-02-01T00:00:00.000Z"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v)) {
    return new Date(v + ".000Z");
  }

  // "2026-02-28T23:59:59.999" -> "2026-02-28T23:59:59.999Z"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/.test(v)) {
    return new Date(v + "Z");
  }

  // "2026-02-01" -> "2026-02-01T00:00:00.000Z"
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(v + "T00:00:00.000Z");
  }

  return value;
}

export function buildWhere(filters: Filter[] = []): Record<string, any> {
  const where: Record<string, any> = {};
  for (const f of filters) {
    const value =
      f.op === "in" || !isLikelyDateColumn(f.column) ? undefined : coerceDateFilterValue(f.value);

    if (f.op === "eq") {
      where[f.column] = value ?? f.value;
    } else if (f.op === "gte") {
      where[f.column] = { ...(where[f.column] || {}), gte: value ?? f.value };
    } else if (f.op === "lte") {
      where[f.column] = { ...(where[f.column] || {}), lte: value ?? f.value };
    } else if (f.op === "ilike") {
      // MySQL is case-insensitive by default, no need for mode
      where[f.column] = { contains: f.value.replace(/%/g, "") };
    } else if (f.op === "in") {
      where[f.column] = { in: f.values };
    }
  }
  return where;
}

export type OrderBy = { column: string; ascending?: boolean };

export function buildOrder(order?: OrderBy) {
  if (!order) return undefined;
  return { [order.column]: order.ascending === false ? "desc" : "asc" };
}
