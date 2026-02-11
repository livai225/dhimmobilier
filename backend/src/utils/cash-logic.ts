/**
 * Logique de gestion des caisses
 *
 * CAISSE VERSEMENT (caisse physique):
 * - ENTREES: versement_agent (agent dépose l'argent collecté)
 * - SORTIES: paiement_loyer, paiement_souscription, paiement_droit_terre, paiement_caution
 *            (l'argent est transféré de la caisse vers la comptabilité entreprise)
 *
 * CAISSE ENTREPRISE (comptabilité):
 * - REVENUS: paiement_loyer, paiement_souscription, paiement_droit_terre, paiement_caution, vente
 * - DEPENSES: depense_entreprise, paiement_facture, autre
 */

// Types d'opérations qui impactent la caisse physique (versement)
export const OPERATIONS_CAISSE_VERSEMENT = {
  ENTREES: ["versement_agent"],
  SORTIES: ["paiement_loyer", "paiement_souscription", "paiement_droit_terre", "paiement_caution"],
};

// Types d'opérations pour la caisse entreprise
export const OPERATIONS_CAISSE_ENTREPRISE = {
  REVENUS: ["paiement_loyer", "paiement_souscription", "paiement_droit_terre", "paiement_caution", "vente"],
  DEPENSES: ["depense_entreprise", "paiement_facture", "autre", "remboursement_caution"],
};

/**
 * Détermine si une opération impacte la caisse physique (versement)
 */
export function impactsCaisseVersement(typeOperation: string): boolean {
  return (
    OPERATIONS_CAISSE_VERSEMENT.ENTREES.includes(typeOperation) ||
    OPERATIONS_CAISSE_VERSEMENT.SORTIES.includes(typeOperation)
  );
}

/**
 * Détermine le type de transaction pour la caisse versement
 */
export function getCaisseVersementTransactionType(typeOperation: string): "entree" | "sortie" | null {
  if (OPERATIONS_CAISSE_VERSEMENT.ENTREES.includes(typeOperation)) {
    return "entree";
  }
  if (OPERATIONS_CAISSE_VERSEMENT.SORTIES.includes(typeOperation)) {
    return "sortie";
  }
  return null;
}

/**
 * Détermine si une opération est un revenu pour l'entreprise
 */
export function isRevenueEntreprise(typeOperation: string): boolean {
  return OPERATIONS_CAISSE_ENTREPRISE.REVENUS.includes(typeOperation);
}

/**
 * Détermine si une opération est une dépense pour l'entreprise
 */
export function isDepenseEntreprise(typeOperation: string): boolean {
  return OPERATIONS_CAISSE_ENTREPRISE.DEPENSES.includes(typeOperation);
}

/**
 * Met à jour le solde de la caisse versement
 */
export async function updateCaisseVersement(tx: any, montant: number, typeOperation: string) {
  const transactionType = getCaisseVersementTransactionType(typeOperation);

  // Si l'opération n'impacte pas la caisse versement
  if (!transactionType) {
    const current = await tx.caisse_balance.findFirst({
      orderBy: { updated_at: "desc" },
    });
    const solde = Number(current?.solde_courant || current?.balance || 0);
    return { solde_avant: solde, solde_apres: solde, impacts_caisse: false };
  }

  // Récupérer le solde actuel
  const current = await tx.caisse_balance.findFirst({
    orderBy: { updated_at: "desc" },
  });

  const solde_avant = Number(current?.solde_courant || current?.balance || 0);

  // Pour les sorties, vérifier que le solde est suffisant
  if (transactionType === "sortie" && solde_avant < montant) {
    throw new Error(
      `Solde insuffisant dans la caisse versement. Solde actuel: ${solde_avant.toLocaleString()} FCFA, Montant requis: ${montant.toLocaleString()} FCFA`
    );
  }

  // Calculer le nouveau solde
  const solde_apres =
    transactionType === "entree" ? solde_avant + montant : solde_avant - montant;

  // Mettre à jour la caisse
  if (current) {
    await tx.caisse_balance.update({
      where: { id: current.id },
      data: {
        solde_courant: solde_apres,
        balance: solde_apres,
        derniere_maj: new Date(),
      },
    });
  } else {
    await tx.caisse_balance.create({
      data: { solde_courant: solde_apres, balance: solde_apres },
    });
  }

  return { solde_avant, solde_apres, impacts_caisse: true };
}

/**
 * Vérifie si un paiement peut être effectué (solde suffisant)
 */
export async function canMakePayment(tx: any, montant: number): Promise<boolean> {
  const current = await tx.caisse_balance.findFirst({
    orderBy: { updated_at: "desc" },
  });
  const solde = Number(current?.solde_courant || current?.balance || 0);
  return solde >= montant;
}

/**
 * Calcule le solde entreprise (revenus - dépenses)
 */
export async function calculateSoldeEntreprise(prisma: any): Promise<number> {
  // Revenus: paiements clients
  const [paiementsLocations, paiementsSouscriptions, paiementsDroitTerre, ventes] =
    await Promise.all([
      prisma.paiements_locations.aggregate({ _sum: { montant: true } }),
      prisma.paiements_souscriptions.aggregate({ _sum: { montant: true } }),
      prisma.paiements_droit_terre.aggregate({ _sum: { montant: true } }),
      prisma.ventes.aggregate({ _sum: { montant: true } }),
    ]);

  // Revenus des cautions (paiements caution)
  const paiementsCautions = await prisma.paiements_cautions.aggregate({
    _sum: { montant: true },
  });

  // Dépenses: factures fournisseurs payées + dépenses entreprise
  const facturesPaid = await prisma.factures_fournisseurs.aggregate({
    _sum: { montant_paye: true },
  });

  // Dépenses autres (cash_transactions) - EXCLURE les transactions liées aux factures
  const depensesEntreprise = await prisma.cash_transactions.aggregate({
    _sum: { montant: true },
    where: {
      type_operation: { in: ["depense_entreprise", "autre"] },
      type_transaction: "sortie",
      type: { not: "facture" },
    },
  });

  const totalRevenus =
    Number(paiementsLocations._sum.montant || 0) +
    Number(paiementsSouscriptions._sum.montant || 0) +
    Number(paiementsDroitTerre._sum.montant || 0) +
    Number(paiementsCautions._sum.montant || 0) +
    Number(ventes._sum.montant || 0);

  const totalDepenses =
    Number(facturesPaid._sum.montant_paye || 0) +
    Number(depensesEntreprise._sum.montant || 0);

  return totalRevenus - totalDepenses;
}

/**
 * Calcule le solde disponible pour une période donnée (mois/année)
 */
export async function getSoldeByPeriode(
  tx: any,
  moisConcerne: string,
  anneeConcerne: number
): Promise<number> {
  // Calculer les entrées (versements) pour cette période
  const versements = await tx.cash_transactions.aggregate({
    _sum: { montant: true },
    where: {
      type_operation: "versement_agent",
      type_transaction: "entree",
      mois_concerne: moisConcerne,
      annee_concerne: anneeConcerne,
    },
  });

  // Calculer les sorties (paiements) pour cette période
  const paiements = await tx.cash_transactions.aggregate({
    _sum: { montant: true },
    where: {
      type_operation: {
        in: ["paiement_loyer", "paiement_droit_terre", "paiement_souscription", "paiement_caution"],
      },
      type_transaction: "sortie",
      mois_concerne: moisConcerne,
      annee_concerne: anneeConcerne,
    },
  });

  const totalVersements = Number(versements._sum.montant || 0);
  const totalPaiements = Number(paiements._sum.montant || 0);

  return totalVersements - totalPaiements;
}

/**
 * Vérifie si un paiement peut être effectué pour une période donnée
 */
export async function canMakePaymentForPeriode(
  tx: any,
  montant: number,
  moisConcerne: string,
  anneeConcerne: number
) {
  const soldeDisponible = await getSoldeByPeriode(tx, moisConcerne, anneeConcerne);
  return {
    canPay: soldeDisponible >= montant,
    soldeDisponible,
    soldeNecessaire: montant,
  };
}

/**
 * Recalcule tous les soldes de caisse à partir des transactions
 * Utile pour corriger des incohérences
 */
export async function recalculateCaisseBalances(prisma: any) {
  // Récupérer toutes les transactions triées par date
  const transactions = await prisma.cash_transactions.findMany({
    orderBy: [{ date_transaction: "asc" }, { created_at: "asc" }],
  });

  let solde = 0;
  let processed = 0;

  // Récupérer l'ancien solde
  const oldBalance = await prisma.caisse_balance.findFirst({
    orderBy: { updated_at: "desc" },
  });
  const ancienSolde = Number(oldBalance?.solde_courant || oldBalance?.balance || 0);

  // Recalculer chaque transaction
  for (const tx of transactions) {
    const typeOp = getCaisseVersementTransactionType(tx.type_operation);
    if (!typeOp) continue; // Cette opération n'impacte pas la caisse versement

    const montant = Number(tx.montant || 0);
    const solde_avant = solde;

    if (typeOp === "entree") {
      solde += montant;
    } else {
      solde -= montant;
    }

    // Mettre à jour la transaction avec les bons soldes
    await prisma.cash_transactions.update({
      where: { id: tx.id },
      data: { solde_avant, solde_apres: solde },
    });
    processed++;
  }

  // Mettre à jour le solde final
  if (oldBalance) {
    await prisma.caisse_balance.update({
      where: { id: oldBalance.id },
      data: { solde_courant: solde, balance: solde, derniere_maj: new Date() },
    });
  } else {
    await prisma.caisse_balance.create({
      data: { solde_courant: solde, balance: solde },
    });
  }

  return {
    ancien_solde: ancienSolde,
    nouveau_solde: solde,
    transactions_processed: processed,
  };
}
