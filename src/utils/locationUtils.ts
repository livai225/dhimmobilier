export function calculateLocationDebt(
  location: any,
  payments: Array<{ montant: number }> = []
): number {
  if (!location?.loyer_mensuel) return 0;

  const startDate = new Date(location.date_debut);
  const currentDate = new Date();
  const monthsElapsed = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                       (currentDate.getMonth() - startDate.getMonth()) + 1;

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.montant), 0);
  
  let totalDue: number;

  if (location.type_contrat === 'historique') {
    // Historical contracts: 12 months per year from the start
    const yearsElapsed = Math.floor(monthsElapsed / 12);
    const remainingMonths = monthsElapsed % 12;
    totalDue = (yearsElapsed * location.loyer_mensuel * 12) + (remainingMonths * location.loyer_mensuel);
  } else {
    // New contracts: 10 months first year, then 12 months per year
    if (monthsElapsed <= 12) {
      // First year: only charge for 10 months max
      totalDue = Math.min(monthsElapsed, 10) * location.loyer_mensuel;
    } else {
      // After first year: 10 months for first year + 12 months per subsequent year
      const additionalYears = Math.floor((monthsElapsed - 12) / 12);
      const remainingMonthsAfterFirstYear = (monthsElapsed - 12) % 12;
      totalDue = (location.loyer_mensuel * 10) + // First year (10 months)
                 (additionalYears * location.loyer_mensuel * 12) + // Complete additional years
                 (remainingMonthsAfterFirstYear * location.loyer_mensuel); // Remaining months in current year
    }
  }

  return Math.max(0, totalDue - totalPaid);
}

export function calculateLocationProgress(
  location: any,
  payments: Array<{ montant: number }> = []
): { percentage: number; currentYear: number; yearProgress: number; currentYearPaid: number; currentYearDue: number } {
  if (!location?.loyer_mensuel) return { percentage: 0, currentYear: 1, yearProgress: 0, currentYearPaid: 0, currentYearDue: 0 };
  
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.montant), 0);
  
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