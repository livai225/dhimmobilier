import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { nanoid } from "nanoid";

const receiptNumber = () => `R-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const factureNumber = () => `F-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// Helper to normalize params (remove p_ prefix used by frontend)
function normalizeParams(params: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    const normalizedKey = key.startsWith("p_") ? key.slice(2) : key;
    normalized[normalizedKey] = value;
  }
  return normalized;
}

// Helper to get current cash balance
async function getCurrentCashBalance(): Promise<number> {
  const balance = await prisma.caisse_balance.findFirst({
    orderBy: { updated_at: "desc" },
  });
  return Number(balance?.solde_courant || balance?.balance || 0);
}

// Helper to update cash balance
async function updateCashBalance(
  tx: any,
  montant: number,
  type: "entree" | "sortie"
): Promise<{ solde_avant: number; solde_apres: number }> {
  const current = await tx.caisse_balance.findFirst({
    orderBy: { updated_at: "desc" },
  });
  const solde_avant = Number(current?.solde_courant || current?.balance || 0);
  const solde_apres = type === "entree" ? solde_avant + montant : solde_avant - montant;

  if (current) {
    await tx.caisse_balance.update({
      where: { id: current.id },
      data: { solde_courant: solde_apres, balance: solde_apres, derniere_maj: new Date() },
    });
  } else {
    await tx.caisse_balance.create({
      data: { solde_courant: solde_apres, balance: solde_apres },
    });
  }

  return { solde_avant, solde_apres };
}

export async function rpcRoutes(app: FastifyInstance) {
  // Main RPC handler
  app.post("/rpc/:fn", { preHandler: app.authenticate }, async (req: any, reply) => {
    const { fn } = req.params as { fn: string };
    const rawParams = (req.body as any) || {};
    const params = normalizeParams(rawParams);

    try {
      switch (fn) {
        // ============== CASH BALANCE ==============
        case "get_current_cash_balance": {
          return await getCurrentCashBalance();
        }

        case "get_solde_caisse_entreprise": {
          const balance = await prisma.caisse_balance.findFirst({
            orderBy: { updated_at: "desc" },
          });
          if (balance) return Number(balance.solde_courant || balance.balance || 0);
          // Fallback: calculate from transactions
          const entrees = await prisma.cash_transactions.aggregate({
            _sum: { montant: true },
            where: { type_transaction: "entree" },
          });
          const sorties = await prisma.cash_transactions.aggregate({
            _sum: { montant: true },
            where: { type_transaction: "sortie" },
          });
          return Number(entrees._sum.montant || 0) - Number(sorties._sum.montant || 0);
        }

        // ============== CASH TRANSACTIONS ==============
        case "record_cash_transaction": {
          const montant = Number(params.montant || 0);
          const typeTransaction = params.type_transaction || "entree";

          const result = await prisma.$transaction(async (tx) => {
            const { solde_avant, solde_apres } = await updateCashBalance(tx, montant, typeTransaction);

            const rec = await tx.cash_transactions.create({
              data: {
                montant,
                type_transaction: typeTransaction,
                type_operation: params.type_operation || "autre",
                agent_id: params.agent_id || null,
                beneficiaire: params.beneficiaire || null,
                reference_operation: params.reference_operation || null,
                description: params.description || null,
                piece_justificative: params.piece_justificative || null,
                solde_avant,
                solde_apres,
                mode: params.mode || null,
                type: params.type || typeTransaction,
                reference: params.reference || null,
              },
            });
            return rec.id;
          });

          app.io?.emit("db-change", { table: "cash_transactions", action: "insert" });
          return result;
        }

        case "record_sale_with_cash": {
          const montant = Number(params.montant || 0);

          const result = await prisma.$transaction(async (tx) => {
            const sale = await tx.ventes.create({
              data: {
                article_id: params.article_id || nanoid(),
                montant,
                quantite: Number(params.quantite || 1),
              },
            });

            const { solde_avant, solde_apres } = await updateCashBalance(tx, montant, "entree");

            await tx.cash_transactions.create({
              data: {
                montant,
                type_transaction: "entree",
                type_operation: "vente",
                solde_avant,
                solde_apres,
                type: "sale",
                mode: params.mode || "cash",
                reference: params.reference || sale.id,
              },
            });

            return sale.id;
          });

          app.io?.emit("db-change", { table: "ventes", action: "insert" });
          return result;
        }

        // ============== LOCATION PAYMENTS ==============
        case "pay_location_with_cash": {
          const montant = Number(params.montant || 0);
          const locationId = params.location_id;
          const clientId = params.client_id;

          const recuId = await prisma.$transaction(async (tx) => {
            // Get location to find client if not provided
            let finalClientId = clientId;
            if (!finalClientId && locationId) {
              const location = await tx.locations.findUnique({ where: { id: locationId } });
              finalClientId = location?.client_id || locationId;
            }

            // Create payment
            const payment = await tx.paiements_locations.create({
              data: {
                location_id: locationId,
                montant,
                date_paiement: params.date_paiement ? new Date(params.date_paiement) : new Date(),
                mode_paiement: params.mode_paiement || params.mode || "cash",
                reference: params.reference || null,
                mois_concerne: params.mois_concerne || null,
              },
            });

            // Update cash balance
            const { solde_avant, solde_apres } = await updateCashBalance(tx, montant, "entree");

            // Record cash transaction
            await tx.cash_transactions.create({
              data: {
                montant,
                type_transaction: "entree",
                type_operation: "paiement_loyer",
                reference_operation: payment.id,
                solde_avant,
                solde_apres,
                type: "location",
                mode: params.mode_paiement || params.mode || "cash",
                reference: params.reference || payment.id,
              },
            });

            // Create receipt
            const recu = await tx.recus.create({
              data: {
                numero: receiptNumber(),
                client_id: finalClientId || "",
                reference_id: payment.id,
                type_operation: "location",
                montant_total: montant,
              },
            });

            return recu.id;
          });

          app.io?.emit("db-change", { table: "paiements_locations", action: "insert" });
          return recuId;
        }

        // ============== SOUSCRIPTION PAYMENTS ==============
        case "pay_souscription_with_cash": {
          const montant = Number(params.montant || 0);
          const souscriptionId = params.souscription_id;
          const clientId = params.client_id;

          const recuId = await prisma.$transaction(async (tx) => {
            // Get souscription to find client if not provided
            let finalClientId = clientId;
            if (!finalClientId && souscriptionId) {
              const souscription = await tx.souscriptions.findUnique({ where: { id: souscriptionId } });
              finalClientId = souscription?.client_id || souscriptionId;
            }

            // Create payment
            const payment = await tx.paiements_souscriptions.create({
              data: {
                souscription_id: souscriptionId,
                montant,
                date_paiement: params.date_paiement ? new Date(params.date_paiement) : new Date(),
                mode_paiement: params.mode_paiement || params.mode || "cash",
                reference: params.reference || null,
              },
            });

            // Update souscription solde_restant
            await tx.souscriptions.update({
              where: { id: souscriptionId },
              data: { solde_restant: { decrement: montant } },
            });

            // Update cash balance
            const { solde_avant, solde_apres } = await updateCashBalance(tx, montant, "entree");

            // Record cash transaction
            await tx.cash_transactions.create({
              data: {
                montant,
                type_transaction: "entree",
                type_operation: "paiement_souscription",
                reference_operation: payment.id,
                solde_avant,
                solde_apres,
                type: "souscription",
                mode: params.mode_paiement || params.mode || "cash",
                reference: params.reference || payment.id,
              },
            });

            // Create receipt
            const recu = await tx.recus.create({
              data: {
                numero: receiptNumber(),
                client_id: finalClientId || "",
                reference_id: payment.id,
                type_operation: "souscription",
                montant_total: montant,
              },
            });

            return recu.id;
          });

          app.io?.emit("db-change", { table: "paiements_souscriptions", action: "insert" });
          return recuId;
        }

        // ============== DROIT DE TERRE PAYMENTS ==============
        case "pay_droit_terre_with_cash": {
          const montant = Number(params.montant || 0);
          const souscriptionId = params.souscription_id;
          const clientId = params.client_id;

          const recuId = await prisma.$transaction(async (tx) => {
            // Get souscription to find client if not provided
            let finalClientId = clientId;
            if (!finalClientId && souscriptionId) {
              const souscription = await tx.souscriptions.findUnique({ where: { id: souscriptionId } });
              finalClientId = souscription?.client_id || souscriptionId;
            }

            // Create payment
            const payment = await tx.paiements_droit_terre.create({
              data: {
                souscription_id: souscriptionId,
                montant,
                date_paiement: params.date_paiement ? new Date(params.date_paiement) : new Date(),
                mode_paiement: params.mode_paiement || params.mode || "cash",
                reference: params.reference || null,
              },
            });

            // Update cash balance
            const { solde_avant, solde_apres } = await updateCashBalance(tx, montant, "entree");

            // Record cash transaction
            await tx.cash_transactions.create({
              data: {
                montant,
                type_transaction: "entree",
                type_operation: "paiement_droit_terre",
                reference_operation: payment.id,
                solde_avant,
                solde_apres,
                type: "droit_terre",
                mode: params.mode_paiement || params.mode || "cash",
                reference: params.reference || payment.id,
              },
            });

            // Create receipt
            const recu = await tx.recus.create({
              data: {
                numero: receiptNumber(),
                client_id: finalClientId || "",
                reference_id: payment.id,
                type_operation: "droit_terre",
                montant_total: montant,
              },
            });

            return recu.id;
          });

          app.io?.emit("db-change", { table: "paiements_droit_terre", action: "insert" });
          return recuId;
        }

        // ============== FACTURE PAYMENTS ==============
        case "pay_facture_with_cash": {
          const montant = Number(params.montant || 0);
          const factureId = params.facture_id;

          const recuId = await prisma.$transaction(async (tx) => {
            // Get facture to find fournisseur
            const facture = await tx.factures_fournisseurs.findUnique({ where: { id: factureId } });
            if (!facture) throw new Error("Facture introuvable");

            // Create payment
            const payment = await tx.paiements_factures.create({
              data: {
                facture_id: factureId,
                montant,
                date_paiement: params.date_paiement ? new Date(params.date_paiement) : new Date(),
                mode_paiement: params.mode_paiement || params.mode || "cash",
                reference: params.reference || null,
              },
            });

            // Update facture montant_paye and solde
            const newMontantPaye = Number(facture.montant_paye) + montant;
            const newSolde = Number(facture.montant_total) - newMontantPaye;
            await tx.factures_fournisseurs.update({
              where: { id: factureId },
              data: {
                montant_paye: newMontantPaye,
                solde: newSolde,
                statut: newSolde <= 0 ? "payee" : "partiel",
              },
            });

            // Update cash balance (sortie for facture payment)
            const { solde_avant, solde_apres } = await updateCashBalance(tx, montant, "sortie");

            // Record cash transaction
            await tx.cash_transactions.create({
              data: {
                montant,
                type_transaction: "sortie",
                type_operation: "depense_entreprise",
                beneficiaire: facture.fournisseur_id,
                reference_operation: payment.id,
                solde_avant,
                solde_apres,
                type: "facture",
                mode: params.mode_paiement || params.mode || "cash",
                reference: params.reference || payment.id,
              },
            });

            // Create receipt
            const recu = await tx.recus.create({
              data: {
                numero: receiptNumber(),
                client_id: facture.fournisseur_id,
                reference_id: payment.id,
                type_operation: "facture",
                montant_total: montant,
              },
            });

            return recu.id;
          });

          app.io?.emit("db-change", { table: "paiements_factures", action: "insert" });
          return recuId;
        }

        // ============== CAUTION PAYMENTS ==============
        case "pay_caution_with_cash": {
          const montant = Number(params.montant || 0);
          const locationId = params.location_id;

          const result = await prisma.$transaction(async (tx) => {
            // Create caution payment
            const payment = await tx.paiements_cautions.create({
              data: {
                location_id: locationId,
                montant,
                date_paiement: params.date_paiement ? new Date(params.date_paiement) : new Date(),
                mode_paiement: params.mode_paiement || params.mode || "cash",
                reference: params.reference || null,
              },
            });

            // Update cash balance (sortie for caution refund)
            const { solde_avant, solde_apres } = await updateCashBalance(tx, montant, "sortie");

            // Record cash transaction
            await tx.cash_transactions.create({
              data: {
                montant,
                type_transaction: "sortie",
                type_operation: "remboursement_caution",
                reference_operation: payment.id,
                solde_avant,
                solde_apres,
                type: "caution",
                mode: params.mode_paiement || params.mode || "cash",
                reference: params.reference || payment.id,
              },
            });

            return payment.id;
          });

          app.io?.emit("db-change", { table: "paiements_cautions", action: "insert" });
          return result;
        }

        // ============== UTILITIES ==============
        case "generate_facture_number": {
          return factureNumber();
        }

        case "get_agent_statistics": {
          const agentId = params.agent_uuid || params.agent_id;
          const startDate = params.start_date ? new Date(params.start_date) : undefined;
          const endDate = params.end_date ? new Date(params.end_date) : undefined;

          const whereClause: any = {
            agent_id: agentId,
            type_transaction: "entree",
            type_operation: "versement_agent",
          };

          if (startDate) whereClause.date_transaction = { gte: startDate };
          if (endDate) {
            whereClause.date_transaction = {
              ...whereClause.date_transaction,
              lte: endDate,
            };
          }

          const [aggregate, count, lastTransaction] = await Promise.all([
            prisma.cash_transactions.aggregate({
              _sum: { montant: true },
              _avg: { montant: true },
              where: whereClause,
            }),
            prisma.cash_transactions.count({ where: whereClause }),
            prisma.cash_transactions.findFirst({
              where: whereClause,
              orderBy: { date_transaction: "desc" },
            }),
          ]);

          return [{
            total_verse: Number(aggregate._sum.montant || 0),
            nombre_versements: count,
            moyenne_versement: Number(aggregate._avg.montant || 0),
            dernier_versement: lastTransaction?.date_transaction || null,
          }];
        }

        case "delete_location_safely": {
          const locationId = params.location_id;
          
          await prisma.$transaction(async (tx) => {
            await tx.paiements_cautions.deleteMany({ where: { location_id: locationId } });
            await tx.paiements_locations.deleteMany({ where: { location_id: locationId } });
            await tx.locations.delete({ where: { id: locationId } });
          });

          app.io?.emit("db-change", { table: "locations", action: "delete" });
          return true;
        }

        case "calculate_solde_droit_terre": {
          const souscriptionId = params.souscription_uuid || params.souscription_id;
          const pay = await prisma.paiements_droit_terre.aggregate({
            _sum: { montant: true },
            where: { souscription_id: souscriptionId },
          });
          return Number(pay._sum.montant || 0);
        }

        case "reconstruct_land_rights_config": {
          // Reconstruct land rights configuration for all mise_en_garde subscriptions
          const souscriptions = await prisma.souscriptions.findMany({
            where: { type_souscription: "mise_en_garde" },
          });

          for (const sub of souscriptions) {
            if (sub.date_debut && sub.periode_finition_mois) {
              const dateFinFinition = new Date(sub.date_debut);
              dateFinFinition.setMonth(dateFinFinition.getMonth() + sub.periode_finition_mois);
              
              const dateDebutDroitTerre = new Date(dateFinFinition);
              dateDebutDroitTerre.setDate(dateDebutDroitTerre.getDate() + 1);

              await prisma.souscriptions.update({
                where: { id: sub.id },
                data: {
                  date_fin_finition: dateFinFinition,
                  date_debut_droit_terre: dateDebutDroitTerre,
                },
              });
            }
          }

          return { status: "ok", count: souscriptions.length };
        }

        case "create_missing_august_payments": {
          // Placeholder for creating missing payments
          return { status: "ok" };
        }

        case "generate_echeances_droit_terre": {
          const souscriptionId = params.souscription_id;
          const souscription = await prisma.souscriptions.findUnique({
            where: { id: souscriptionId },
          });

          if (!souscription || souscription.type_souscription !== "mise_en_garde") {
            return { status: "skipped", reason: "Not a mise_en_garde subscription" };
          }

          if (!souscription.date_debut_droit_terre || !souscription.montant_droit_terre_mensuel) {
            return { status: "skipped", reason: "Missing droit terre configuration" };
          }

          // Generate 240 monthly payments (20 years)
          const echeances = [];
          let currentDate = new Date(souscription.date_debut_droit_terre);

          for (let i = 1; i <= 240; i++) {
            echeances.push({
              souscription_id: souscriptionId,
              numero_echeance: i,
              date_echeance: new Date(currentDate),
              montant: souscription.montant_droit_terre_mensuel,
              statut: "en_attente",
            });
            currentDate.setMonth(currentDate.getMonth() + 1);
          }

          await prisma.echeances_droit_terre.createMany({
            data: echeances,
            skipDuplicates: true,
          });

          return { status: "ok", count: echeances.length };
        }

        default: {
          reply.code(501);
          return { error: `RPC ${fn} not implemented` };
        }
      }
    } catch (error: any) {
      req.log.error(error);
      reply.code(500);
      return { error: error.message || "rpc error" };
    }
  });
}
