import jsPDF from "jspdf";

interface FactureData {
  id: string;
  numero: string;
  date_facture: string;
  montant_total: number;
  montant_paye?: number | null;
  solde?: number | null;
  description?: string | null;
  fournisseur?: { nom?: string | null } | null;
  propriete?: { nom?: string | null } | null;
}

const formatCurrency = (amount?: number | null) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", minimumFractionDigits: 0 }).format(Number(amount || 0));

const loadImageAsDataURL = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generateInvoicePDF = async (facture: FactureData) => {
  const doc = new jsPDF();

  // Logo
  try {
    const logo = await loadImageAsDataURL('/lovable-uploads/88feb91e-8b8d-4e58-9691-d95421a2c943.png');
    doc.addImage(logo, 'PNG', 14, 10, 30, 30);
  } catch {}

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('FACTURE FOURNISSEUR', 105, 30, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° ${facture.numero}`, 20, 50);
  doc.text(`Date: ${new Date(facture.date_facture).toLocaleDateString('fr-FR')}`, 140, 50);

  // Fournisseur / Propriété
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMATIONS', 20, 70);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fournisseur: ${facture.fournisseur?.nom || '-'}`, 20, 85);
  doc.text(`Propriété: ${facture.propriete?.nom || '-'}`, 20, 95);

  // Montants
  doc.setFont('helvetica', 'bold');
  doc.text('MONTANTS', 20, 115);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total: ${formatCurrency(facture.montant_total)}`, 20, 130);
  doc.text(`Payé: ${formatCurrency(facture.montant_paye)}`, 20, 140);
  const solde = Number(facture.solde ?? (Number(facture.montant_total || 0) - Number(facture.montant_paye || 0)));
  doc.text(`Solde: ${formatCurrency(solde)}`, 20, 150);

  if (facture.description) {
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPTION', 20, 170);
    doc.setFont('helvetica', 'normal');
    const desc = doc.splitTextToSize(facture.description, 170);
    doc.text(desc, 20, 185);
  }

  // Footer
  doc.setFontSize(10);
  doc.text('Document généré automatiquement', 105, 280, { align: 'center' });

  return doc;
};

export const downloadInvoicePDF = async (facture: FactureData) => {
  const doc = await generateInvoicePDF(facture);
  doc.save(`facture_${facture.numero}.pdf`);
};
