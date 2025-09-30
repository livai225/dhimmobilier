import { format } from "date-fns";
import { fr } from "date-fns/locale";

export interface MonthOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Génère les options de mois pour les sélecteurs de paiement
 * @param startYear - Année de début (par défaut: année courante)
 * @param endYear - Année de fin (par défaut: année courante + 1)
 * @param paidMonths - Liste des mois déjà payés (optionnel)
 * @returns Array d'options de mois
 */
export function generateMonthOptions(
  startYear?: number,
  endYear?: number,
  paidMonths: string[] = []
): MonthOption[] {
  const months: MonthOption[] = [];
  const currentYear = new Date().getFullYear();
  const start = startYear || currentYear;
  const end = endYear || currentYear + 1;

  // Générer tous les mois pour les années spécifiées, en commençant toujours par janvier
  for (let year = start; year <= end; year++) {
    for (let month = 0; month < 12; month++) {
      const date = new Date(year, month, 1);
      const monthValue = format(date, "yyyy-MM");
      const isPaid = paidMonths.includes(monthValue);
      
      months.push({
        value: monthValue,
        label: `${format(date, "MMMM yyyy", { locale: fr })}${isPaid ? " • déjà payé" : ""}`,
        disabled: false // Permettre la sélection même des mois payés
      });
    }
  }

  return months;
}

/**
 * Génère les options de mois pour les années courante et suivante
 * @param paidMonths - Liste des mois déjà payés (optionnel)
 * @returns Array d'options de mois
 */
export function generateCurrentYearMonthOptions(paidMonths: string[] = []): MonthOption[] {
  const months: MonthOption[] = [];
  const currentYear = new Date().getFullYear();
  
  // Générer tous les mois pour l'année courante et suivante, en commençant par janvier
  for (let year = currentYear; year <= currentYear + 1; year++) {
    for (let month = 0; month < 12; month++) {
      const date = new Date(year, month, 1);
      const monthValue = format(date, "yyyy-MM");
      const isPaid = paidMonths.includes(monthValue);
      
      months.push({
        value: monthValue,
        label: `${format(date, "MMMM yyyy", { locale: fr })}${isPaid ? " • déjà payé" : ""}`,
        disabled: false
      });
    }
  }

  return months;
}

/**
 * Génère les options de mois pour une période étendue (20 ans)
 * @param startDate - Date de début du contrat
 * @param paidMonths - Liste des mois déjà payés (optionnel)
 * @returns Array d'options de mois
 */
export function generateExtendedMonthOptions(
  startDate: Date,
  paidMonths: string[] = []
): MonthOption[] {
  const months: MonthOption[] = [];
  const startYear = startDate.getFullYear();
  // Commencer toujours en janvier de l'année de début
  const startMonth = 0; // Janvier
  const TOTAL_MONTHS = 240; // 20 ans

  for (let i = 0; i < TOTAL_MONTHS; i++) {
    const date = new Date(startYear, startMonth + i, 1);
    const monthValue = format(date, "yyyy-MM");
    const isPaid = paidMonths.includes(monthValue);
    
    months.push({
      value: monthValue,
      label: `${format(date, "MMMM yyyy", { locale: fr })}${isPaid ? " • déjà payé" : ""}`,
      disabled: false
    });
  }

  return months;
}

/**
 * Génère les options de mois pour les 12 derniers mois
 * @returns Array d'options de mois
 */
export function generateLast12MonthsOptions(): MonthOption[] {
  const months: MonthOption[] = [];
  const now = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthValue = format(date, "yyyy-MM");
    
    months.push({
      value: monthValue,
      label: format(date, "MMMM yyyy", { locale: fr })
    });
  }
  
  return months;
}

/**
 * Génère les options de mois pour les années courante et précédente
 * @returns Array d'options de mois
 */
export function generateCurrentAndPreviousYearOptions(): MonthOption[] {
  const months: MonthOption[] = [];
  const currentYear = new Date().getFullYear();
  
  // Année courante
  for (let month = 0; month < 12; month++) {
    const date = new Date(currentYear, month, 1);
    const monthValue = format(date, "yyyy-MM");
    
    months.push({
      value: monthValue,
      label: format(date, "MMMM yyyy", { locale: fr })
    });
  }
  
  // Année précédente
  for (let month = 0; month < 12; month++) {
    const date = new Date(currentYear - 1, month, 1);
    const monthValue = format(date, "yyyy-MM");
    
    months.push({
      value: monthValue,
      label: format(date, "MMMM yyyy", { locale: fr })
    });
  }
  
  return months;
}
