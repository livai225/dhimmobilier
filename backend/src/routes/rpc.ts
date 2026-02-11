import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { nanoid } from "nanoid";

const receiptNumber = () => `R-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const factureNumber = () => `F-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// Erreur métier avec code HTTP approprié
class BusinessError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "BusinessError";
    this.statusCode = statusCode;
  }
}

// Helpers pour créer des erreurs métier
const notFound = (resource: string) => new BusinessError(`${resource} introuvable`, 404);
const badRequest = (message: string) => new BusinessError(message, 400);

// Helper to normalize params (remove p_ prefix used by frontend)
function normalizeParams(params: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    const normalizedKey = key.startsWith("p_") ? key.slice(2) : key;
    normalized[normalizedKey] = value;
  }
  return normalized;
}

// Helper to validate required parameters
function validateRequired(params: Record<string, any>, required: string[]): string | null {
  for (const field of required) {
    if (params[field] === undefined || params[field] === null || params[field] === "") {
      return `Le paramètre '${field}' est requis`;
    }
  }
  return null;
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
  if (!current) {
    if (type === "sortie") {
      throw badRequest(
        `Solde insuffisant dans la caisse versement. Solde actuel: 0 FCFA, Montant requis: ${montant.toLocaleString()} FCFA`
      );
    }
    const created = await tx.caisse_balance.create({
      data: { solde_courant: montant, balance: montant },
    });
    return { solde_avant: 0, solde_apres: Number(created.solde_courant || created.balance || montant) };
  }

  // Lock the current balance row to avoid concurrent negative balances
  const lockedRows = await tx.$queryRaw<
    Array<{ solde_courant: number | null; balance: number | null }>
  >`SELECT solde_courant, balance FROM caisse_balance WHERE id = ${current.id} FOR UPDATE`;
  const locked = lockedRows[0];

  const solde_avant = Number(locked?.solde_courant ?? current.solde_courant ?? current.balance ?? 0);
  if (type === "sortie" && solde_avant < montant) {
    throw badRequest(
      `Solde insuffisant dans la caisse versement. Solde actuel: ${solde_avant.toLocaleString()} FCFA, Montant requis: ${montant.toLocaleString()} FCFA`
    );
  }

  if (type === "entree") {
    await tx.caisse_balance.update({
      where: { id: current.id },
      data: {
        solde_courant: { increment: montant },
        balance: { increment: montant },
        derniere_maj: new Date(),
      },
    });
  } else {
    await tx.caisse_balance.update({
      where: { id: current.id },
      data: {
        solde_courant: { decrement: montant },
        balance: { decrement: montant },
        derniere_maj: new Date(),
      },
    });
  }

  const solde_apres = type === "entree" ? solde_avant + montant : solde_avant - montant;
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
          // Calculer le solde entreprise depuis les tables de paiement réelles
          // REVENUS: paiements locations + souscriptions + droit terre + cautions + ventes
          const [revLocations, revSouscriptions, revDroitTerre, revCautions, revVentes] =
            await Promise.all([
              prisma.paiements_locations.aggregate({ _sum: { montant: true } }),
              prisma.paiements_souscriptions.aggregate({ _sum: { montant: true } }),
              prisma.paiements_droit_terre.aggregate({ _sum: { montant: true } }),
              prisma.paiements_cautions.aggregate({ _sum: { montant: true } }),
              prisma.ventes.aggregate({ _sum: { montant: true } }),
            ]);

          // DEPENSES: factures payées + dépenses entreprise (hors factures)
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
        }

        // ============== CASH TRANSACTIONS ==============
        case "record_cash_transaction": {
          // Validation du montant
          const montant = Number(params.montant || 0);
          if (montant <= 0) {
            reply.code(400);
            return { error: "Le montant doit être supérieur à 0" };
          }

          const typeTransaction = params.type_transaction || "entree";
          const agentId = params.agent_id || null;

          const result = await prisma.$transaction(async (tx) => {
            // Vérifier que l'agent existe si fourni
            if (agentId) {
              const agent = await tx.agents_recouvrement.findUnique({ where: { id: agentId } });
              if (!agent) {
                throw notFound("Agent");
              }
            }

            const { solde_avant, solde_apres } = await updateCashBalance(tx, montant, typeTransaction);

            const rec = await tx.cash_transactions.create({
              data: {
                montant,
                type_transaction: typeTransaction,
                type_operation: params.type_operation || "autre",
                agent_id: agentId,
                beneficiaire: params.beneficiaire || null,
                reference_operation: params.reference_operation || null,
                description: params.description || null,
                piece_justificative: params.piece_justificative || null,
                solde_avant,
                solde_apres,
                mode: params.mode || null,
                type: params.type || typeTransaction,
                reference: params.reference || null,
                mois_concerne: params.mois_concerne || null,
                annee_concerne: params.annee_concerne ? Number(params.annee_concerne) : null,
              },
            });

            // Create receipt for agent deposits (versement)
            if (typeTransaction === "entree" && (params.type_operation || "autre") === "versement_agent") {
              await tx.recus.create({
                data: {
                  numero: receiptNumber(),
                  client_id: null,
                  agent_id: agentId,
                  reference_id: rec.id,
                  type_operation: "versement_agent",
                  montant_total: montant,
                  meta: {
                    beneficiaire: params.beneficiaire || null,
                    description: params.description || null,
                    mois_concerne: params.mois_concerne || null,
                    annee_concerne: params.annee_concerne ? Number(params.annee_concerne) : null,
                  },
                },
              });
            }
            return rec.id;
          });

          app.io?.emit("db-change", { table: "cash_transactions", action: "insert" });
          return result;
        }

        case "record_sale_with_cash": {
          // Validation des paramètres
          const validationError = validateRequired(params, ["article_id", "montant"]);
          if (validationError) {
            reply.code(400);
            return { error: validationError };
          }

          const montant = Number(params.montant);
          if (montant <= 0) {
            reply.code(400);
            return { error: "Le montant doit être supérieur à 0" };
          }

          const result = await prisma.$transaction(async (tx) => {
            // Vérifier que l'article existe
            const article = await tx.articles.findUnique({ where: { id: params.article_id } });
            if (!article) {
              throw notFound("Article");
            }

            const sale = await tx.ventes.create({
              data: {
                article_id: params.article_id,
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
          // Validation des paramètres requis
          const validationError = validateRequired(params, ["location_id", "montant"]);
          if (validationError) {
            reply.code(400);
            return { error: validationError };
          }

          const montant = Number(params.montant);
          if (montant <= 0) {
            reply.code(400);
            return { error: "Le montant doit être supérieur à 0" };
          }

          const locationId = params.location_id;
          const clientId = params.client_id;

          const recuId = await prisma.$transaction(async (tx) => {
            // Vérifier que la location existe
            const location = await tx.locations.findUnique({ where: { id: locationId } });
            if (!location) {
              throw notFound("Location");
            }

            // Utiliser le client_id de la location si non fourni
            const finalClientId = clientId || location.client_id;

            // Create payment
            const payment = await tx.paiements_locations.create({
              data: {
                location_id: locationId,
                montant,
                date_paiement: params.date_paiement ? new Date(params.date_paiement) : new Date(),
                mode_paiement: params.mode_paiement || params.mode || "cash",
                reference: params.reference || null,
                mois_concerne: params.mois_concerne || null,
                annee_concerne: params.annee_concerne ? Number(params.annee_concerne) : null,
                import_tag: params.import_tag || null,
              },
            });

            // Update cash balance - SORTIE de la caisse versement (argent va en comptabilité)
            const { solde_avant, solde_apres } = await updateCashBalance(tx, montant, "sortie");

            // Record cash transaction
            await tx.cash_transactions.create({
              data: {
                montant,
                type_transaction: "sortie",
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
          // Validation des paramètres requis
          const validationError = validateRequired(params, ["souscription_id", "montant"]);
          if (validationError) {
            reply.code(400);
            return { error: validationError };
          }

          const montant = Number(params.montant);
          if (montant <= 0) {
            reply.code(400);
            return { error: "Le montant doit être supérieur à 0" };
          }

          const souscriptionId = params.souscription_id;
          const clientId = params.client_id;

          const recuId = await prisma.$transaction(async (tx) => {
            // Vérifier que la souscription existe
            const souscription = await tx.souscriptions.findUnique({ where: { id: souscriptionId } });
            if (!souscription) {
              throw notFound("Souscription");
            }

            // Utiliser le client_id de la souscription si non fourni
            const finalClientId = clientId || souscription.client_id;

            // Create payment
            const payment = await tx.paiements_souscriptions.create({
              data: {
                souscription_id: souscriptionId,
                montant,
                date_paiement: params.date_paiement ? new Date(params.date_paiement) : new Date(),
                mode_paiement: params.mode_paiement || params.mode || "cash",
                reference: params.reference || null,
                import_tag: params.import_tag || null,
              },
            });

            // Update souscription solde_restant
            await tx.souscriptions.update({
              where: { id: souscriptionId },
              data: { solde_restant: { decrement: montant } },
            });

            // Update cash balance - SORTIE de la caisse versement
            const { solde_avant, solde_apres } = await updateCashBalance(tx, montant, "sortie");

            // Record cash transaction
            await tx.cash_transactions.create({
              data: {
                montant,
                type_transaction: "sortie",
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
                type_operation: "apport_souscription",
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
          // Validation des paramètres requis
          const validationError = validateRequired(params, ["souscription_id", "montant"]);
          if (validationError) {
            reply.code(400);
            return { error: validationError };
          }

          const montant = Number(params.montant);
          if (montant <= 0) {
            reply.code(400);
            return { error: "Le montant doit être supérieur à 0" };
          }

          const souscriptionId = params.souscription_id;
          const clientId = params.client_id;

          const recuId = await prisma.$transaction(async (tx) => {
            // Vérifier que la souscription existe
            const souscription = await tx.souscriptions.findUnique({ where: { id: souscriptionId } });
            if (!souscription) {
              throw notFound("Souscription");
            }

            // Utiliser le client_id de la souscription si non fourni
            const finalClientId = clientId || souscription.client_id;

            // Create payment
            const payment = await tx.paiements_droit_terre.create({
              data: {
                souscription_id: souscriptionId,
                montant,
                date_paiement: params.date_paiement ? new Date(params.date_paiement) : new Date(),
                mode_paiement: params.mode_paiement || params.mode || "cash",
                reference: params.reference || null,
                annee_concerne: params.annee_concerne ? Number(params.annee_concerne) : null,
                import_tag: params.import_tag || null,
              },
            });

            // Update cash balance - SORTIE de la caisse versement
            const { solde_avant, solde_apres } = await updateCashBalance(tx, montant, "sortie");

            // Record cash transaction
            await tx.cash_transactions.create({
              data: {
                montant,
                type_transaction: "sortie",
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

        // ============== CANCEL IMPORT RECOUVREMENT ==============
        case "cancel_recouvrement_import": {
          const validationError = validateRequired(params, ["agent_id", "month", "year", "operation_type"]);
          if (validationError) {
            reply.code(400);
            return { error: validationError };
          }

          const agentId = params.agent_id;
          const operationType = params.operation_type;
          const year = Number(params.year);
          const rawMonth = Number(params.month);
          const monthIndex = rawMonth >= 1 && rawMonth <= 12 ? rawMonth - 1 : rawMonth;

          if (Number.isNaN(year) || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
            reply.code(400);
            return { error: "Mois ou année invalide" };
          }

          const startDate = new Date(year, monthIndex, 1, 0, 0, 0);
          const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59);

          const result = await prisma.$transaction(async (tx) => {
            let totalRefund = 0;
            let paymentsDeleted = 0;
            let receiptsDeleted = 0;
            let cashDeleted = 0;
            let contractsDeleted = 0;
            let propertiesDeleted = 0;
            let clientsDeleted = 0;

            if (operationType === "loyer") {
              const payments = await tx.paiements_locations.findMany({
                where: {
                  import_tag: "import",
                  date_paiement: { gte: startDate, lte: endDate },
                  location: { propriete: { agent_id: agentId } },
                },
                select: {
                  id: true,
                  montant: true,
                  location_id: true,
                  location: { select: { propriete_id: true, client_id: true } },
                },
              });

              const paymentIds = payments.map((p) => p.id);
              const locationIds = Array.from(new Set(payments.map((p) => p.location_id)));
              const propertyIds = Array.from(
                new Set(payments.map((p) => p.location.propriete_id).filter(Boolean))
              );
              const clientIds = Array.from(
                new Set(payments.map((p) => p.location.client_id).filter(Boolean))
              );

              totalRefund = payments.reduce((sum, p) => sum + Number(p.montant || 0), 0);

              if (paymentIds.length > 0) {
                const recuRes = await tx.recus.deleteMany({
                  where: { reference_id: { in: paymentIds }, type_operation: "location" },
                });
                receiptsDeleted = recuRes.count;

                const cashRes = await tx.cash_transactions.deleteMany({
                  where: {
                    reference_operation: { in: paymentIds },
                    type_operation: "paiement_loyer",
                  },
                });
                cashDeleted = cashRes.count;

                const payRes = await tx.paiements_locations.deleteMany({
                  where: { id: { in: paymentIds } },
                });
                paymentsDeleted = payRes.count;
              }

              if (locationIds.length > 0) {
                const locations = await tx.locations.findMany({
                  where: { id: { in: locationIds }, import_tag: "import" },
                  include: { _count: { select: { paiements: true, cautions: true } } },
                });
                const deletableLocationIds = locations
                  .filter((l) => l._count.paiements === 0 && l._count.cautions === 0)
                  .map((l) => l.id);

                if (deletableLocationIds.length > 0) {
                  const delRes = await tx.locations.deleteMany({
                    where: { id: { in: deletableLocationIds } },
                  });
                  contractsDeleted += delRes.count;
                }
              }

              if (propertyIds.length > 0) {
                const props = await tx.proprietes.findMany({
                  where: { id: { in: propertyIds }, import_tag: "import" },
                  include: { _count: { select: { locations: true, souscriptions: true } } },
                });
                const deletablePropIds = props
                  .filter((p) => p._count.locations === 0 && p._count.souscriptions === 0)
                  .map((p) => p.id);

                if (deletablePropIds.length > 0) {
                  const delRes = await tx.proprietes.deleteMany({
                    where: { id: { in: deletablePropIds } },
                  });
                  propertiesDeleted = delRes.count;
                }
              }

              if (clientIds.length > 0) {
                const clients = await tx.clients.findMany({
                  where: { id: { in: clientIds }, import_tag: "import" },
                  include: { _count: { select: { locations: true, souscriptions: true } } },
                });
                const deletableClientIds = clients
                  .filter((c) => c._count.locations === 0 && c._count.souscriptions === 0)
                  .map((c) => c.id);

                if (deletableClientIds.length > 0) {
                  const delRes = await tx.clients.deleteMany({
                    where: { id: { in: deletableClientIds } },
                  });
                  clientsDeleted = delRes.count;
                }
              }
            } else if (operationType === "droit_terre") {
              const payments = await tx.paiements_droit_terre.findMany({
                where: {
                  import_tag: "import",
                  date_paiement: { gte: startDate, lte: endDate },
                  souscription: { propriete: { agent_id: agentId } },
                },
                select: {
                  id: true,
                  montant: true,
                  souscription_id: true,
                  souscription: { select: { propriete_id: true, client_id: true } },
                },
              });

              const paymentIds = payments.map((p) => p.id);
              const souscriptionIds = Array.from(new Set(payments.map((p) => p.souscription_id)));
              const propertyIds = Array.from(
                new Set(payments.map((p) => p.souscription.propriete_id).filter(Boolean))
              );
              const clientIds = Array.from(
                new Set(payments.map((p) => p.souscription.client_id).filter(Boolean))
              );

              totalRefund = payments.reduce((sum, p) => sum + Number(p.montant || 0), 0);

              if (paymentIds.length > 0) {
                const recuRes = await tx.recus.deleteMany({
                  where: { reference_id: { in: paymentIds }, type_operation: "droit_terre" },
                });
                receiptsDeleted = recuRes.count;

                const cashRes = await tx.cash_transactions.deleteMany({
                  where: {
                    reference_operation: { in: paymentIds },
                    type_operation: "paiement_droit_terre",
                  },
                });
                cashDeleted = cashRes.count;

                const payRes = await tx.paiements_droit_terre.deleteMany({
                  where: { id: { in: paymentIds } },
                });
                paymentsDeleted = payRes.count;
              }

              if (souscriptionIds.length > 0) {
                const souscriptions = await tx.souscriptions.findMany({
                  where: { id: { in: souscriptionIds }, import_tag: "import" },
                  include: { _count: { select: { paiements: true, paiements_droit: true } } },
                });
                const deletableSouscriptionIds = souscriptions
                  .filter((s) => s._count.paiements === 0 && s._count.paiements_droit === 0)
                  .map((s) => s.id);

                if (deletableSouscriptionIds.length > 0) {
                  const delRes = await tx.souscriptions.deleteMany({
                    where: { id: { in: deletableSouscriptionIds } },
                  });
                  contractsDeleted += delRes.count;
                }
              }

              if (propertyIds.length > 0) {
                const props = await tx.proprietes.findMany({
                  where: { id: { in: propertyIds }, import_tag: "import" },
                  include: { _count: { select: { locations: true, souscriptions: true } } },
                });
                const deletablePropIds = props
                  .filter((p) => p._count.locations === 0 && p._count.souscriptions === 0)
                  .map((p) => p.id);

                if (deletablePropIds.length > 0) {
                  const delRes = await tx.proprietes.deleteMany({
                    where: { id: { in: deletablePropIds } },
                  });
                  propertiesDeleted = delRes.count;
                }
              }

              if (clientIds.length > 0) {
                const clients = await tx.clients.findMany({
                  where: { id: { in: clientIds }, import_tag: "import" },
                  include: { _count: { select: { locations: true, souscriptions: true } } },
                });
                const deletableClientIds = clients
                  .filter((c) => c._count.locations === 0 && c._count.souscriptions === 0)
                  .map((c) => c.id);

                if (deletableClientIds.length > 0) {
                  const delRes = await tx.clients.deleteMany({
                    where: { id: { in: deletableClientIds } },
                  });
                  clientsDeleted = delRes.count;
                }
              }
            } else {
              throw badRequest("Type d'opération invalide");
            }

            if (totalRefund > 0) {
              const { solde_avant, solde_apres } = await updateCashBalance(tx, totalRefund, "entree");
              await tx.cash_transactions.create({
                data: {
                  montant: totalRefund,
                  type_transaction: "entree",
                  type_operation: "annulation_import",
                  agent_id: agentId,
                  reference_operation: `${operationType}_${year}_${monthIndex + 1}`,
                  description: `Annulation import ${operationType} ${monthIndex + 1}/${year}`,
                  solde_avant,
                  solde_apres,
                  mode: "system",
                  type: "annulation_import",
                  mois_concerne: String(monthIndex + 1).padStart(2, "0"),
                  annee_concerne: year,
                },
              });
            }

            return {
              total_refunded: totalRefund,
              payments_deleted: paymentsDeleted,
              receipts_deleted: receiptsDeleted,
              cash_transactions_deleted: cashDeleted,
              contracts_deleted: contractsDeleted,
              properties_deleted: propertiesDeleted,
              clients_deleted: clientsDeleted,
            };
          });

          app.io?.emit("db-change", { table: "paiements_locations", action: "delete" });
          app.io?.emit("db-change", { table: "paiements_droit_terre", action: "delete" });
          app.io?.emit("db-change", { table: "locations", action: "delete" });
          app.io?.emit("db-change", { table: "souscriptions", action: "delete" });
          app.io?.emit("db-change", { table: "proprietes", action: "delete" });
          app.io?.emit("db-change", { table: "clients", action: "delete" });
          app.io?.emit("db-change", { table: "cash_transactions", action: "insert" });
          app.io?.emit("db-change", { table: "recus", action: "delete" });

          return result;
        }

        // ============== FACTURE PAYMENTS ==============
        case "pay_facture_with_cash": {
          // Validation des paramètres requis
          const validationError = validateRequired(params, ["facture_id", "montant"]);
          if (validationError) {
            reply.code(400);
            return { error: validationError };
          }

          const montant = Number(params.montant);
          if (montant <= 0) {
            reply.code(400);
            return { error: "Le montant doit être supérieur à 0" };
          }

          const factureId = params.facture_id;

          const recuId = await prisma.$transaction(async (tx) => {
            // Vérifier que la facture existe
            const facture = await tx.factures_fournisseurs.findUnique({ where: { id: factureId } });
            if (!facture) {
              throw notFound("Facture");
            }

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
                client_id: null,
                reference_id: payment.id,
                type_operation: "paiement_facture",
                montant_total: montant,
                meta: {
                  fournisseur_id: facture.fournisseur_id,
                  facture_id: factureId,
                },
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
            const cashTransaction = await tx.cash_transactions.create({
              data: {
                montant,
                type_transaction: "sortie",
                type_operation: "paiement_caution",
                reference_operation: payment.id,
                solde_avant,
                solde_apres,
                type: "caution",
                mode: params.mode_paiement || params.mode || "cash",
                reference: params.reference || payment.id,
              },
            });

            // Create receipt for caution payment
            await tx.recus.create({
              data: {
                numero: receiptNumber(),
                client_id: null,
                reference_id: cashTransaction.id,
                type_operation: "caution_location",
                montant_total: montant,
                meta: {
                  location_id: locationId || null,
                  reference_operation: payment.id,
                },
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

        // ============== MAINTENANCE ==============
        case "clear_financial_data_only": {
          await prisma.$transaction(async (tx) => {
            await tx.paiements_factures.deleteMany({});
            await tx.paiements_locations.deleteMany({});
            await tx.paiements_souscriptions.deleteMany({});
            await tx.paiements_droit_terre.deleteMany({});
            await tx.echeances_droit_terre.deleteMany({});
            await tx.cash_transactions.deleteMany({});
            await tx.recus.deleteMany({});
            await tx.factures_fournisseurs.deleteMany({});
            await tx.ventes.deleteMany({});

            const souscriptions = await tx.souscriptions.findMany({
              select: { id: true, prix_total: true },
            });
            for (const sub of souscriptions) {
              await tx.souscriptions.update({
                where: { id: sub.id },
                data: { solde_restant: Number(sub.prix_total || 0) },
              });
            }

            await tx.locations.updateMany({
              data: { updated_at: new Date() },
            });

            await tx.caisse_balance.deleteMany({});
            await tx.caisse_balance.create({
              data: { solde_courant: 0, balance: 0, derniere_maj: new Date() },
            });
          });

          app.io?.emit("db-change", { table: "cash_transactions", action: "delete" });
          app.io?.emit("db-change", { table: "recus", action: "delete" });
          return { success: true };
        }

        case "clear_financial_data": {
          await prisma.$transaction(async (tx) => {
            await tx.paiements_factures.deleteMany({});
            await tx.paiements_locations.deleteMany({});
            await tx.paiements_souscriptions.deleteMany({});
            await tx.paiements_droit_terre.deleteMany({});
            await tx.echeances_droit_terre.deleteMany({});
            await tx.cash_transactions.deleteMany({});
            await tx.recus.deleteMany({});
            await tx.factures_fournisseurs.deleteMany({});
            await tx.locations.deleteMany({});
            await tx.souscriptions.deleteMany({});

            await tx.caisse_balance.deleteMany({});
            await tx.caisse_balance.create({
              data: { solde_courant: 0, balance: 0, derniere_maj: new Date() },
            });
          });

          app.io?.emit("db-change", { table: "cash_transactions", action: "delete" });
          app.io?.emit("db-change", { table: "recus", action: "delete" });
          return { success: true };
        }

        case "clear_all_data": {
          await prisma.$transaction(async (tx) => {
            await tx.ventes.deleteMany({});
            await tx.recus.deleteMany({});
            await tx.paiements_factures.deleteMany({});
            await tx.paiements_locations.deleteMany({});
            await tx.paiements_souscriptions.deleteMany({});
            await tx.paiements_droit_terre.deleteMany({});
            await tx.echeances_droit_terre.deleteMany({});
            await tx.cash_transactions.deleteMany({});
            await tx.factures_fournisseurs.deleteMany({});
            await tx.locations.deleteMany({});
            await tx.souscriptions.deleteMany({});
            await tx.clients.deleteMany({});
            await tx.proprietes.deleteMany({});
            await tx.fournisseurs.deleteMany({});
            await tx.agents_recouvrement.deleteMany({});
            await tx.articles.deleteMany({});
            await tx.types_proprietes.deleteMany({});
            await tx.secteurs_activite.deleteMany({});
            await tx.bareme_droits_terre.deleteMany({});
            await tx.receipt_counters.deleteMany({});
            await tx.caisse_balance.deleteMany({});
            await tx.caisse_balance.create({
              data: { solde_courant: 0, balance: 0, derniere_maj: new Date() },
            });
          });

          app.io?.emit("db-change", { table: "cash_transactions", action: "delete" });
          app.io?.emit("db-change", { table: "recus", action: "delete" });
          return { success: true };
        }

        // ============== STATISTICS ==============
        case "getStats":
        case "get_stats": {
          const [
            clientsCount,
            proprietesCount,
            locationsCount,
            souscriptionsCount,
            caisseBalance,
          ] = await Promise.all([
            prisma.clients.count(),
            prisma.proprietes.count(),
            prisma.locations.count({ where: { statut: "active" } }),
            prisma.souscriptions.count({ where: { statut: "active" } }),
            prisma.caisse_balance.findFirst({ orderBy: { updated_at: "desc" } }),
          ]);

          return {
            clients: clientsCount,
            proprietes: proprietesCount,
            locations_actives: locationsCount,
            souscriptions_actives: souscriptionsCount,
            solde_caisse: Number(caisseBalance?.solde_courant || caisseBalance?.balance || 0),
          };
        }

        case "get_dashboard_stats": {
          const today = new Date();
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

          const [
            clientsCount,
            locationsActives,
            souscriptionsActives,
            caisseBalance,
            entreesMonth,
            sortiesMonth,
            impayesLocations,
          ] = await Promise.all([
            prisma.clients.count(),
            prisma.locations.count({ where: { statut: "active" } }),
            prisma.souscriptions.count({ where: { statut: "active" } }),
            prisma.caisse_balance.findFirst({ orderBy: { updated_at: "desc" } }),
            prisma.cash_transactions.aggregate({
              _sum: { montant: true },
              where: { type_transaction: "entree", date_transaction: { gte: startOfMonth } },
            }),
            prisma.cash_transactions.aggregate({
              _sum: { montant: true },
              where: { type_transaction: "sortie", date_transaction: { gte: startOfMonth } },
            }),
            prisma.locations.aggregate({
              _sum: { dette_totale: true },
              where: { statut: "active", dette_totale: { gt: 0 } },
            }),
          ]);

          return {
            clients_total: clientsCount,
            locations_actives: locationsActives,
            souscriptions_actives: souscriptionsActives,
            solde_caisse: Number(caisseBalance?.solde_courant || caisseBalance?.balance || 0),
            entrees_mois: Number(entreesMonth._sum.montant || 0),
            sorties_mois: Number(sortiesMonth._sum.montant || 0),
            impayes_locations: Number(impayesLocations._sum.dette_totale || 0),
          };
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

        // ============== DIAGNOSTIC & RECALCULATION ==============
        case "diagnose_caisse_versement": {
          // Calculer les totaux d'entrées et sorties pour la caisse versement
          const diagEntrees = await prisma.cash_transactions.aggregate({
            _sum: { montant: true },
            where: { type_operation: "versement_agent" },
          });
          // Paiements en sortie (correct)
          const diagSortiesCorrect = await prisma.cash_transactions.aggregate({
            _sum: { montant: true },
            where: {
              type_operation: {
                in: ["paiement_loyer", "paiement_souscription", "paiement_droit_terre", "paiement_caution"],
              },
              type_transaction: "sortie",
            },
          });
          // Paiements en entree (incorrect, avant correction)
          const diagSortiesIncorrect = await prisma.cash_transactions.aggregate({
            _sum: { montant: true },
            where: {
              type_operation: {
                in: ["paiement_loyer", "paiement_souscription", "paiement_droit_terre", "paiement_caution"],
              },
              type_transaction: "entree",
            },
          });

          const totalEntrees = Number(diagEntrees._sum.montant || 0);
          const totalSortiesCorrectes = Number(diagSortiesCorrect._sum.montant || 0);
          const totalSortiesIncorrectes = Number(diagSortiesIncorrect._sum.montant || 0);
          // Le vrai total des sorties = celles déjà corrigées + celles encore mal enregistrées
          const totalSorties = totalSortiesCorrectes + totalSortiesIncorrectes;

          // Solde actuel dans la table
          const diagBalance = await prisma.caisse_balance.findFirst({
            orderBy: { updated_at: "desc" },
          });
          const soldeActuel = Number(diagBalance?.solde_courant || diagBalance?.balance || 0);
          const soldeTheorique = totalEntrees - totalSorties;
          const difference = soldeActuel - soldeTheorique;

          // Transactions récentes (7 jours)
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const [versementsRecents, sortiesRecentes] = await Promise.all([
            prisma.cash_transactions.findMany({
              where: { type_operation: "versement_agent", date_transaction: { gte: sevenDaysAgo } },
              orderBy: { date_transaction: "desc" },
              take: 10,
              include: { agent: true },
            }),
            prisma.cash_transactions.findMany({
              where: {
                type_operation: { in: ["paiement_loyer", "paiement_souscription", "paiement_droit_terre", "paiement_caution"] },
                date_transaction: { gte: sevenDaysAgo },
              },
              orderBy: { date_transaction: "desc" },
              take: 10,
            }),
          ]);

          const nbTransactions = await prisma.cash_transactions.count();

          return {
            solde_actuel: soldeActuel,
            solde_theorique: soldeTheorique,
            total_entrees: totalEntrees,
            total_sorties: totalSorties,
            difference,
            transactions_analysees: nbTransactions,
            message: totalSortiesIncorrectes > 0
              ? `${totalSortiesIncorrectes.toLocaleString()} FCFA de paiements sont enregistrés en 'entree' au lieu de 'sortie'. Recalculation recommandée.`
              : Math.abs(difference) > 1
                ? `Écart de ${difference.toLocaleString()} FCFA détecté. Recalculation recommandée.`
                : "La caisse versement est cohérente.",
            versements_recents: versementsRecents.map((v: any) => ({
              agent: v.agent ? `${v.agent.prenom} ${v.agent.nom}` : (v.beneficiaire || "Agent"),
              date: v.date_transaction,
              montant: Number(v.montant),
              solde_apres: Number(v.solde_apres || 0),
            })),
            sorties_recentes: sortiesRecentes.map((s: any) => ({
              beneficiaire: s.beneficiaire || s.type_operation?.replace("paiement_", "") || "N/A",
              type: s.type_operation || "",
              date: s.date_transaction,
              montant: Number(s.montant),
              solde_apres: Number(s.solde_apres || 0),
            })),
          };
        }

        case "recalculate_caisse":
        case "recalculate_caisse_versement": {
          // Corriger les transactions mal enregistrées (paiements en entree → sortie)
          const wrongDirectionPayments = await prisma.cash_transactions.findMany({
            where: {
              type_operation: {
                in: ["paiement_loyer", "paiement_souscription", "paiement_droit_terre", "paiement_caution"],
              },
              type_transaction: "entree",
            },
          });

          // Corriger la direction
          for (const tx of wrongDirectionPayments) {
            await prisma.cash_transactions.update({
              where: { id: tx.id },
              data: { type_transaction: "sortie" },
            });
          }

          // Recalculer le solde de la caisse versement depuis toutes les transactions
          const allTransactions = await prisma.cash_transactions.findMany({
            orderBy: [{ date_transaction: "asc" }, { created_at: "asc" }],
          });

          let solde = 0;
          const OPERATIONS_CAISSE = {
            ENTREES: ["versement_agent"],
            SORTIES: ["paiement_loyer", "paiement_souscription", "paiement_droit_terre", "paiement_caution"],
          };

          for (const tx of allTransactions) {
            const isEntree = OPERATIONS_CAISSE.ENTREES.includes(tx.type_operation || "");
            const isSortie = OPERATIONS_CAISSE.SORTIES.includes(tx.type_operation || "");
            if (!isEntree && !isSortie) continue;

            const montant = Number(tx.montant || 0);
            const solde_avant = solde;

            if (isEntree) {
              solde += montant;
            } else {
              solde -= montant;
            }

            await prisma.cash_transactions.update({
              where: { id: tx.id },
              data: { solde_avant, solde_apres: solde },
            });
          }

          // Mettre à jour la caisse_balance
          const currentBalance = await prisma.caisse_balance.findFirst({
            orderBy: { updated_at: "desc" },
          });
          const ancienSolde = Number(currentBalance?.solde_courant || currentBalance?.balance || 0);

          if (currentBalance) {
            await prisma.caisse_balance.update({
              where: { id: currentBalance.id },
              data: { solde_courant: solde, balance: solde, derniere_maj: new Date() },
            });
          } else {
            await prisma.caisse_balance.create({
              data: { solde_courant: solde, balance: solde },
            });
          }

          app.io?.emit("db-change", { table: "cash_transactions", action: "update" });
          return {
            ancien_solde: ancienSolde,
            nouveau_solde: solde,
            transactions_corrigees: wrongDirectionPayments.length,
            transactions_processed: allTransactions.length,
          };
        }

        default: {
          reply.code(501);
          return { error: `RPC ${fn} not implemented` };
        }
      }
    } catch (error: any) {
      // Erreur métier avec code HTTP approprié
      if (error instanceof BusinessError) {
        reply.code(error.statusCode);
        return { error: error.message };
      }
      // Erreur technique (500)
      req.log.error(error);
      reply.code(500);
      return { error: error.message || "rpc error" };
    }
  });
}
