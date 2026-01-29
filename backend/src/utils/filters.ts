type Filter =
  | { op: "eq" | "ilike" | "gte" | "lte"; column: string; value: any }
  | { op: "in"; column: string; values: any[] };

export function buildWhere(filters: Filter[] = []): Record<string, any> {
  const where: Record<string, any> = {};
  for (const f of filters) {
    if (f.op === "eq") {
      where[f.column] = f.value;
    } else if (f.op === "gte") {
      where[f.column] = { ...(where[f.column] || {}), gte: f.value };
    } else if (f.op === "lte") {
      where[f.column] = { ...(where[f.column] || {}), lte: f.value };
    } else if (f.op === "ilike") {
      where[f.column] = { contains: f.value.replace(/%/g, ""), mode: "insensitive" };
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
