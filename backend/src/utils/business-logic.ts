import { PrismaClient } from "@prisma/client";

// ============== RECEIPT NUMBER GENERATION ==============
// Préfixes pour les différents types de reçus
const RECEIPT_PREFIXES: Record<string, string> = {
  location: "REC-LOC",
  apport_souscription: "REC-SOUS",
  souscription: "REC-SOUS",
  droit_terre: "REC-DTER",
  paiement_facture: "REC-FACT",
  facture: "REC-FACT",
  caution_location: "REC-CAUT",
  caution: "REC-CAUT",
  versement_agent: "REC-VERS",
  vente: "REC-VENT",
  // Alias pour compatibilité
  paiement_loyer: "REC-LOC",
  paiement_souscription: "REC-SOUS",
  paiement_droit_terre: "REC-DTER",
};

/**
 * Génère un numéro de reçu séquentiel au format: PREFIX-YYMMDD-0001
 * Utilise une table de compteurs pour maintenir la séquence par jour et par type
 */
export async function generateReceiptNumber(prisma: PrismaClient, typeOperation: string): Promise<string> {
  const prefix = RECEIPT_PREFIXES[typeOperation] || "REC-GEN";
  const today = new Date();
  const dateKey = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const dateStr = today.toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD

  // Utiliser une transaction pour garantir l'unicité
  try {
    // Chercher ou créer le compteur
    let counter = await prisma.receipt_counters.findFirst({
      where: { date_key: dateKey, prefix },
    });

    let nextNumber: number;

    if (counter) {
      nextNumber = counter.last_number + 1;
      await prisma.receipt_counters.update({
        where: { id: counter.id },
        data: { last_number: nextNumber },
      });
    } else {
      nextNumber = 1;
      await prisma.receipt_counters.create({
        data: { date_key: dateKey, prefix, last_number: nextNumber },
      });
    }

    return `${prefix}-${dateStr}-${String(nextNumber).padStart(4, "0")}`;
  } catch (error) {
    // Fallback si la table n'existe pas
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}-${dateStr}-${timestamp}-${random}`;
  }
}

// ============== LOCATION DEBT CALCULATION ==============
/**
 * Calcule la dette d'une location basée sur la durée depuis la date de début
 * Logique:
 * - Année 1: 10 mois de loyer dus
 * - Années suivantes: 12 mois par année complète + mois écoulés de l'année en cours
 */
export function calculateLocationDebt(loyerMensuel: number, dateDebut: Date | string, totalPaye: number): number {
  const now = new Date();
  const debut = new Date(dateDebut);

  // Calculer la différence en mois
  const yearsDiff = now.getFullYear() - debut.getFullYear();
  const monthsDiff = now.getMonth() - debut.getMonth();
  const totalMonths = yearsDiff * 12 + monthsDiff;

  let detteTotale: number;

  if (totalMonths <= 0) {
    // Pas encore de dette
    detteTotale = 0;
  } else if (yearsDiff === 0) {
    // Première année: 10 mois maximum ou mois écoulés si moins
    const moisDus = Math.min(totalMonths, 10);
    detteTotale = loyerMensuel * moisDus;
  } else {
    // Années suivantes
    // Année 1: 10 mois
    // Années complètes après: 12 mois chacune
    // Année en cours: mois écoulés (max 12)
    const anneesCompletes = yearsDiff - 1;
    const moisAnneeEnCours = Math.min(monthsDiff + 12, 12); // +12 car monthsDiff peut être négatif
    detteTotale =
      loyerMensuel * 10 + // Première année
      loyerMensuel * 12 * anneesCompletes + // Années complètes
      loyerMensuel * Math.max(0, moisAnneeEnCours); // Année en cours
  }

  // Soustraire les paiements effectués
  return Math.max(0, detteTotale - totalPaye);
}

// ============== DROIT DE TERRE BALANCE CALCULATION ==============
/**
 * Calcule le solde des droits de terre pour une souscription
 * Basé sur: montant_mensuel * mois_écoulés - total_payé
 */
export function calculateDroitTerreSolde(
  montantMensuel: number,
  dateDebutDroitTerre: Date | string | null,
  totalPaye: number
): number {
  if (!dateDebutDroitTerre || !montantMensuel) {
    return 0;
  }

  const now = new Date();
  const debut = new Date(dateDebutDroitTerre);

  // Calculer le nombre de mois écoulés
  const yearsDiff = now.getFullYear() - debut.getFullYear();
  const monthsDiff = now.getMonth() - debut.getMonth();
  const totalMonths = Math.max(0, yearsDiff * 12 + monthsDiff + 1); // +1 car le mois courant compte

  const totalDu = montantMensuel * totalMonths;
  return totalDu - totalPaye; // Peut être négatif si trop-payé
}

// ============== SOUSCRIPTION DATES CALCULATION ==============
/**
 * Calcule les dates importantes pour une souscription de type mise_en_garde
 */
export function calculateSouscriptionDates(dateDebut: Date | string, periodeFinitionMois: number) {
  const dateFinFinition = new Date(dateDebut);
  dateFinFinition.setMonth(dateFinFinition.getMonth() + periodeFinitionMois);

  const dateDebutDroitTerre = new Date(dateFinFinition);
  dateDebutDroitTerre.setDate(dateDebutDroitTerre.getDate() + 1);

  return { dateFinFinition, dateDebutDroitTerre };
}

// ============== FACTURE VALIDATION ==============
/**
 * Valide qu'un paiement de facture ne dépasse pas le solde restant
 */
export function validateFacturePayment(montantTotal: number, montantDejaPaye: number, nouveauMontant: number) {
  const soldeRestant = montantTotal - montantDejaPaye;
  const maxAllowed = Math.max(0, soldeRestant);

  if (nouveauMontant > soldeRestant + 0.01) {
    // +0.01 pour tolérance d'arrondi
    return {
      valid: false,
      error: `Le montant (${nouveauMontant} FCFA) dépasse le solde restant (${soldeRestant} FCFA)`,
      maxAllowed,
    };
  }
  return { valid: true, maxAllowed };
}

// ============== ECHEANCIER GENERATION ==============
/**
 * Génère les échéances pour une souscription
 */
export function generateEcheancesSouscription(
  souscriptionId: string,
  soldeRestant: number,
  montantMensuel: number,
  nombreMois: number,
  dateDebut: Date | string
) {
  if (soldeRestant <= 0 || montantMensuel <= 0 || nombreMois <= 0) {
    return [];
  }

  const echeances = [];
  const montantEcheance = soldeRestant / nombreMois;
  let currentDate = new Date(dateDebut);

  for (let i = 1; i <= nombreMois; i++) {
    echeances.push({
      souscription_id: souscriptionId,
      numero_echeance: i,
      date_echeance: new Date(currentDate),
      montant: Math.round(montantEcheance * 100) / 100, // Arrondir à 2 décimales
      statut: "en_attente",
    });
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return echeances;
}

/**
 * Génère les échéances pour les droits de terre (20 ans = 240 mois)
 */
export function generateEcheancesDroitTerre(
  souscriptionId: string,
  montantMensuel: number,
  dateDebutDroitTerre: Date | string | null
) {
  if (!montantMensuel || !dateDebutDroitTerre) {
    return [];
  }

  const echeances = [];
  let currentDate = new Date(dateDebutDroitTerre);

  // 20 ans = 240 mois
  for (let i = 1; i <= 240; i++) {
    echeances.push({
      souscription_id: souscriptionId,
      numero_echeance: i,
      date_echeance: new Date(currentDate),
      montant: montantMensuel,
      statut: "en_attente",
    });
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return echeances;
}

// ============== RECEIPT META GENERATION ==============
/**
 * Génère les métadonnées pour un reçu de paiement de location
 */
export function generateLocationReceiptMeta(
  clientName: string,
  propertyName: string,
  remainingDebt: number,
  periodePaiement?: string
) {
  return {
    client_name: clientName,
    property_name: propertyName,
    remaining_debt: remainingDebt,
    status: remainingDebt <= 0 ? "solde" : "partiel",
    object_type: "location",
    periode_paiement: periodePaiement || null,
  };
}

/**
 * Génère les métadonnées pour un reçu de paiement de souscription
 */
export function generateSouscriptionReceiptMeta(
  clientName: string,
  propertyName: string,
  remainingBalance: number,
  periodePaiement?: string
) {
  return {
    client_name: clientName,
    property_name: propertyName,
    remaining_balance: remainingBalance,
    status: remainingBalance <= 0 ? "solde" : "partiel",
    object_type: "souscription",
    periode_paiement: periodePaiement || null,
  };
}

/**
 * Génère les métadonnées pour un reçu de paiement de facture
 */
export function generateFactureReceiptMeta(
  fournisseurName: string,
  factureNumero: string,
  montantTotal: number,
  remainingBalance: number,
  propertyName?: string
) {
  return {
    fournisseur_name: fournisseurName,
    facture_numero: factureNumero,
    montant_total: montantTotal,
    remaining_balance: remainingBalance,
    status: remainingBalance <= 0 ? "solde" : "partiel",
    property_name: propertyName || null,
    object_type: "facture",
  };
}
