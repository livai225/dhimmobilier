import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export async function cashRoutes(app: FastifyInstance) {
  // Solde caisse versement = versements agents - paiements enregistrés
  app.get("/cash/balance/versement", { preHandler: app.authenticate }, async () => {
    // Lire depuis caisse_balance (mis à jour en temps réel par les RPCs)
    const balance = await prisma.caisse_balance.findFirst({
      orderBy: { updated_at: "desc" },
    });
    return Number(balance?.solde_courant || balance?.balance || 0);
  });

  // Solde caisse entreprise = revenus (paiements) - dépenses
  app.get("/cash/balance/entreprise", { preHandler: app.authenticate }, async () => {
    // Calculer depuis les tables de paiement réelles
    const [revLocations, revSouscriptions, revDroitTerre, revCautions, revVentes] =
      await Promise.all([
        prisma.paiements_locations.aggregate({ _sum: { montant: true } }),
        prisma.paiements_souscriptions.aggregate({ _sum: { montant: true } }),
        prisma.paiements_droit_terre.aggregate({ _sum: { montant: true } }),
        prisma.paiements_cautions.aggregate({ _sum: { montant: true } }),
        prisma.ventes.aggregate({ _sum: { montant: true } }),
      ]);

    const [depFactures, depEntreprise] = await Promise.all([
      prisma.factures_fournisseurs.aggregate({ _sum: { montant_paye: true } }),
      prisma.cash_transactions.aggregate({
        _sum: { montant: true },
        where: {
          type_operation: { in: ["depense_entreprise", "autre", "remboursement_caution"] },
          type_transaction: "sortie",
          type: { not: "facture" },
        },
      }),
    ]);

    const totalRevenus =
      Number(revLocations._sum.montant || 0) +
      Number(revSouscriptions._sum.montant || 0) +
      Number(revDroitTerre._sum.montant || 0) +
      Number(revCautions._sum.montant || 0) +
      Number(revVentes._sum.montant || 0);

    const totalDepenses =
      Number(depFactures._sum.montant_paye || 0) +
      Number(depEntreprise._sum.montant || 0);

    return totalRevenus - totalDepenses;
  });
}
