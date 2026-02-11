import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

export async function healthRoutes(app: FastifyInstance) {
  // Health check simple
  app.get("/health", async (req, reply) => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Health check avec vérification de la base de données
  app.get("/health/db", async (req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error({ error }, "Database health check failed");
      reply.code(503);
      return {
        status: "error",
        database: "disconnected",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  });

  // Métriques de l'API
  app.get("/metrics", { preHandler: (app as any).authenticate }, async (req, reply) => {
    try {
      const [
        clientsCount,
        proprietesCount,
        locationsCount,
        souscriptionsCount,
        transactionsCount,
        usersCount,
      ] = await Promise.all([
        prisma.clients.count(),
        prisma.proprietes.count(),
        prisma.locations.count(),
        prisma.souscriptions.count(),
        prisma.cash_transactions.count(),
        prisma.users.count(),
      ]);

      const balance = await prisma.caisse_balance.findFirst({
        orderBy: { updated_at: "desc" },
      });

      return {
        timestamp: new Date().toISOString(),
        metrics: {
          clients: clientsCount,
          proprietes: proprietesCount,
          locations: locationsCount,
          souscriptions: souscriptionsCount,
          transactions: transactionsCount,
          users: usersCount,
          solde_caisse: Number(balance?.solde_courant || balance?.balance || 0),
        },
      };
    } catch (error: any) {
      logger.error({ error }, "Metrics collection failed");
      reply.code(500);
      return {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  });

  // Informations sur l'API
  app.get("/info", async (req, reply) => {
    return {
      name: "DH Immobilier API",
      version: "0.1.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      node_version: process.version,
    };
  });
}
