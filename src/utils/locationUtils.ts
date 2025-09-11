/**
 * Utility functions for location debt and payment calculations
 */

export interface LocationWithPayments {
  id: string;
  loyer_mensuel: number;
  date_debut: string;
  type_contrat: string;
  paiements_locations?: Array<{ montant: number }>;
}

/**
 * Calculate real debt for a location based on elapsed time and payments
 */
export function calculateLocationDebt(location: LocationWithPayments): number {
  if (!location?.loyer_mensuel || !location?.date_debut) return 0;

  const startDate = new Date(location.date_debut);
  const currentDate = new Date();
  
  // Calculate months elapsed since start
  const yearsElapsed = currentDate.getFullYear() - startDate.getFullYear();
  const monthsInCurrentYear = currentDate.getMonth() - startDate.getMonth();
  
  // Calculate total amount due based on contract type
  let totalDue: number;
  
  if (location.type_contrat === 'historique') {
    // Historical contracts: 12 months per year from the start
    const totalMonthsElapsed = yearsElapsed * 12 + monthsInCurrentYear;
    totalDue = Math.max(0, totalMonthsElapsed * location.loyer_mensuel);
  } else {
    // New contracts: 10 months first year, 12 months subsequent years
    if (yearsElapsed === 0) {
      // First year: debt = rent × 10 (because 2 months advance already paid)
      totalDue = location.loyer_mensuel * 10;
    } else {
      // Subsequent years: debt = (complete years × rent × 12) + (first year 10 months) + (current year months × rent)
      totalDue = (location.loyer_mensuel * 10) + // First year (10 months)
                 ((yearsElapsed - 1) * location.loyer_mensuel * 12) + // Complete subsequent years
                 (monthsInCurrentYear * location.loyer_mensuel); // Months in current year
    }
  }
  
  // Calculate total paid
  const totalPaid = location.paiements_locations?.reduce((sum, p) => sum + Number(p.montant), 0) || 0;
  
  // Return remaining debt (minimum 0)
  return Math.max(0, totalDue - totalPaid);
}

/**
 * Calculate payment progress for a location
 */
export function calculateLocationProgress(location: LocationWithPayments) {
  if (!location?.loyer_mensuel) return { percentage: 0, currentYear: 1, yearProgress: 0 };
  
  const totalPaid = location.paiements_locations?.reduce((sum, p) => sum + Number(p.montant), 0) || 0;
  
  // Determine current year and calculate progress based on contract type
  let currentYear = 1;
  let yearlyDue: number;
  let accumulatedDue: number;
  
  if (location.type_contrat === 'historique') {
    // Historical contracts: 12 months per year from the start
    yearlyDue = location.loyer_mensuel * 12;
    accumulatedDue = yearlyDue;
    
    // Find which year we're currently paying for
    while (totalPaid >= accumulatedDue && currentYear < 20) { // Max 20 years
      currentYear++;
      accumulatedDue += yearlyDue;
    }
    
    // Calculate progress for current year
    const previousYearsDue = (currentYear - 1) * yearlyDue;
    const currentYearPaid = totalPaid - previousYearsDue;
    const currentYearDue = yearlyDue;
    const yearProgress = Math.min((currentYearPaid / currentYearDue) * 100, 100);
    
    return { 
      percentage: yearProgress, 
      currentYear, 
      yearProgress: Math.round(yearProgress),
      currentYearPaid,
      currentYearDue
    };
  } else {
    // New contracts: 10 months first year, 12 months subsequent years
    yearlyDue = location.loyer_mensuel * 10; // First year: 10 months
    accumulatedDue = yearlyDue;
    
    // Find which year we're currently paying for
    while (totalPaid >= accumulatedDue && currentYear < 20) { // Max 20 years
      currentYear++;
      yearlyDue = location.loyer_mensuel * 12; // Subsequent years: 12 months
      accumulatedDue += yearlyDue;
    }
    
    // Calculate progress for current year
    const previousYearsDue = currentYear === 1 ? 0 : 
      (location.loyer_mensuel * 10) + ((currentYear - 2) * location.loyer_mensuel * 12);
    const currentYearPaid = totalPaid - previousYearsDue;
    const currentYearDue = currentYear === 1 ? location.loyer_mensuel * 10 : location.loyer_mensuel * 12;
    const yearProgress = Math.min((currentYearPaid / currentYearDue) * 100, 100);
    
    return { 
      percentage: yearProgress, 
      currentYear, 
      yearProgress: Math.round(yearProgress),
      currentYearPaid,
      currentYearDue
    };
  }
}