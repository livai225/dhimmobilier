import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { buildWhere, buildOrder } from "../utils/filters.js";

type Action = "select" | "insert" | "update" | "delete" | "upsert";

// Champs sensibles à exclure par table
const SENSITIVE_FIELDS: Record<string, string[]> = {
  users: ["password_hash"],
};

const SENSITIVE_WRITE_TABLES = new Set([
  "cash_transactions",
  "caisse_balance",
  "recus",
  "paiements_locations",
  "paiements_souscriptions",
  "paiements_droit_terre",
  "paiements_factures",
  "paiements_cautions",
]);

// Supprimer les champs sensibles des résultats
function sanitizeResult(table: string, data: any): any {
  const sensitiveFields = SENSITIVE_FIELDS[table];
  if (!sensitiveFields || !data) return data;

  if (Array.isArray(data)) {
    return data.map((item) => {
      const sanitized = { ...item };
      sensitiveFields.forEach((field) => delete sanitized[field]);
      return sanitized;
    });
  }

  const sanitized = { ...data };
  sensitiveFields.forEach((field) => delete sanitized[field]);
  return sanitized;
}

interface DbPayload {
  table: string;
  action: Action;
  filters?: any[];
  orderBy?: { column: string; ascending?: boolean };
  columns?: string; // ignored for now
  values?: any;
  single?: boolean;
  limit?: number;
}

export async function dbRoutes(app: FastifyInstance) {
  app.post("/db/:action", { preHandler: app.authenticate }, async (req: any, reply) => {
    const { action } = req.params as { action: Action };
    const payload = req.body as DbPayload;
    const table = payload.table;
    const model = (prisma as any)[table];
    if (!model) {
      reply.code(400);
      return { error: `Unknown table ${table}` };
    }

    try {
      if (action !== "select" && SENSITIVE_WRITE_TABLES.has(table)) {
        reply.code(403);
        return { error: `Écriture directe interdite sur ${table}. Utilisez les RPC sécurisés.` };
      }

      const where = buildWhere(payload.filters);
      const orderBy = buildOrder(payload.orderBy);

      if (action === "select") {
        const data = await model.findMany({
          where,
          orderBy,
          take: payload.limit,
        });
        const result = payload.single ? data[0] ?? null : data;
        return sanitizeResult(table, result);
      }

      if (action === "insert") {
        const values = payload.values;
        const created = await model.createMany({
          data: Array.isArray(values) ? values : [values],
        });
        app.io?.emit("db-change", { table, action: "insert" });
        return created;
      }

      if (action === "update") {
        const data = await model.updateMany({
          where,
          data: payload.values,
        });
        app.io?.emit("db-change", { table, action: "update" });
        return data;
      }

      if (action === "delete") {
        const data = await model.deleteMany({ where });
        app.io?.emit("db-change", { table, action: "delete" });
        return data;
      }

      if (action === "upsert") {
        // naive upsert expects single object with unique id
        const value = Array.isArray(payload.values) ? payload.values[0] : payload.values;
        const { id, ...rest } = value;
        const data = await model.upsert({
          where: { id },
          create: value,
          update: rest,
        });
        app.io?.emit("db-change", { table, action: "upsert" });
        return data;
      }

      reply.code(400);
      return { error: `Unsupported action ${action}` };
    } catch (error: any) {
      req.log.error(error);
      reply.code(500);
      return { error: error.message || "db error" };
    }
  });
}
