export const formatCurrency = (amount?: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
  }).format(amount || 0).replace('XOF', 'FCFA');
};

export const formatDateFR = (date: string | Date) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR').format(d);
};

export const normalizeString = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
};

export const formatPhone = (phone?: string) => {
  if (!phone) return '';
  return phone.replace(/\s+/g, ' ').trim();
};
