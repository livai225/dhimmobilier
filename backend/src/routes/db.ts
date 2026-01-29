import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { buildWhere, buildOrder } from "../utils/filters";

type Action = "select" | "insert" | "update" | "delete" | "upsert";

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
      const where = buildWhere(payload.filters);
      const orderBy = buildOrder(payload.orderBy);

      if (action === "select") {
        const data = await model.findMany({
          where,
          orderBy,
          take: payload.limit,
        });
        return payload.single ? data[0] ?? null : data;
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
