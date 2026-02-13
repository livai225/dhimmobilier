export const formatCurrency = (amount?: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
  }).format(amount || 0).replace('XOF', 'FCFA');
};

// Parse a numeric value coming from forms / API (string, number, Prisma decimal-as-string, etc.).
export const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const n = Number(String(value).trim().replace(/,/g, ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const formatNumberFR = (value: unknown): string => {
  const n = toNumber(value);
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
};

export const formatFCFA = (value: unknown): string => `${formatNumberFR(value)} FCFA`;

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
