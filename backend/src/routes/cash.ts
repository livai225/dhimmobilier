import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function cashRoutes(app: FastifyInstance) {
  // Total des versements agents (entrées uniquement)
  app.get("/cash/balance/versement", { preHandler: app.authenticate }, async () => {
    const agg = await prisma.cash_transactions.aggregate({
      _sum: { montant: true },
      where: { type_transaction: "entree", type_operation: "versement_agent" },
    });
    return Number(agg._sum.montant || 0);
  });

  // Solde global de la caisse entreprise
  app.get("/cash/balance/entreprise", { preHandler: app.authenticate }, async () => {
    // Utiliser caisse_balance si disponible
    const balance = await prisma.caisse_balance.findFirst({
      orderBy: { updated_at: "desc" },
    });
    if (balance) {
      return Number(balance.solde_courant || balance.balance || 0);
    }
    // Fallback: calculer depuis les transactions
    const [entrees, sorties] = await Promise.all([
      prisma.cash_transactions.aggregate({
        _sum: { montant: true },
        where: { type_transaction: "entree" },
      }),
      prisma.cash_transactions.aggregate({
        _sum: { montant: true },
        where: { type_transaction: "sortie" },
      }),
    ]);
    return Number(entrees._sum.montant || 0) - Number(sorties._sum.montant || 0);
  });
}
