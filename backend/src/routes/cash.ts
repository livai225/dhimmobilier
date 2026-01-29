import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function cashRoutes(app: FastifyInstance) {
  app.get("/cash/balance/versement", { preHandler: app.authenticate }, async () => {
    const agg = await prisma.cash_transactions.aggregate({ _sum: { montant: true } });
    return Number(agg._sum.montant || 0);
  });

  app.get("/cash/balance/entreprise", { preHandler: app.authenticate }, async () => {
    // fallback: use cash_transactions sum if caisse_balance is empty
    const agg = await prisma.caisse_balance.aggregate({ _sum: { balance: true } });
    if (agg._sum.balance !== null) return Number(agg._sum.balance || 0);
    const tx = await prisma.cash_transactions.aggregate({ _sum: { montant: true } });
    return Number(tx._sum.montant || 0);
  });
}
