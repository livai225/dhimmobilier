import jsPDF from "jspdf";
import { ReceiptWithDetails } from "@/hooks/useReceipts";

export const generateReceiptPDF = (receipt: ReceiptWithDetails, logoDataUrl?: string) => {
  const doc = new jsPDF();
  
  // Logo (optional)
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);
    } catch (e) {
      // Ignore image errors silently
    }
  }
  
  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("REÇU DE PAIEMENT", 105, 30, { align: "center" });
  
  // Receipt number
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`N° ${receipt.numero}`, 20, 50);
  doc.text(`Date: ${new Date(receipt.date_generation).toLocaleDateString("fr-FR")}`, 140, 50);
  
  // Client info
  doc.setFont("helvetica", "bold");
  doc.text("INFORMATIONS CLIENT", 20, 70);
  doc.setFont("helvetica", "normal");
  
  const clientName = `${receipt.client?.nom || ""} ${receipt.client?.prenom || ""}`.trim();
  doc.text(`Nom: ${clientName}`, 20, 85);
  
  if (receipt.client?.email) {
    doc.text(`Email: ${receipt.client.email}`, 20, 95);
  }
  
  if (receipt.client?.telephone_principal) {
    doc.text(`Téléphone: ${receipt.client.telephone_principal}`, 20, 105);
  }
  
  // Operation details
  doc.setFont("helvetica", "bold");
  doc.text("DÉTAILS DE L'OPÉRATION", 20, 125);
  doc.setFont("helvetica", "normal");
  
  const operationTypes: Record<string, string> = {
    location: "Paiement de loyer",
    caution_location: "Caution de location",
    apport_souscription: "Apport de souscription",
    droit_terre: "Droit de terre",
    paiement_facture: "Paiement de facture",
    versement_agent: "Versement agent"
  };
  
  doc.text(`Type: ${operationTypes[receipt.type_operation] || receipt.type_operation}`, 20, 140);
  
  if (receipt.periode_debut) {
    doc.text(`Période: ${new Date(receipt.periode_debut).toLocaleDateString("fr-FR")}`, 20, 150);
    if (receipt.periode_fin) {
      doc.text(` au ${new Date(receipt.periode_fin).toLocaleDateString("fr-FR")}`, 60, 150);
    }
  }
  
  // Amount
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const formatCurrency = (amount: number) => {
    const formattedNumber = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(amount || 0);
    return `${formattedNumber} F CFA`;
  };
  doc.text(`MONTANT: ${formatCurrency(Number(receipt.montant_total))}`, 20, 170);

  // Détails du paiement
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DÉTAIL DU PAIEMENT", 20, 185);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  let y = 195;
  const addLine = (label: string, value?: number | null) => {
    if (value !== undefined && value !== null && !isNaN(Number(value))) {
      doc.text(`${label}: ${formatCurrency(Number(value))}`, 20, y);
      y += 8;
    }
  };

  if (receipt.type_operation === 'location') {
    addLine('Loyer mensuel', (receipt as any).loyer_mensuel);
    const av = (receipt as any).location_avances || {};
    const avValues = [
      { label: 'Garantie 2 mois', value: av.garantie_2_mois },
      { label: 'Loyer d’avance 2 mois', value: av.loyer_avance_2_mois },
      { label: 'Frais agence 1 mois', value: av.frais_agence_1_mois },
      { label: 'Caution totale', value: av.caution_totale },
    ].filter(i => i.value && Number(i.value) > 0);

    if (avValues.length > 0) {
      doc.text("Avances initiales:", 20, y);
      y += 8;
      avValues.forEach(i => addLine(`- ${i.label}`, i.value));
    }

    addLine('Paiements cumulés', (receipt as any).location_total_paye);
    addLine('Ce paiement', Number(receipt.montant_total));
    addLine('Reste à payer (estimé)', (receipt as any).location_dette_restante);
  } else if (receipt.type_operation === 'apport_souscription') {
    addLine('Prix total', (receipt as any).souscription_prix_total);
    addLine('Apport initial', (receipt as any).souscription_apport_initial);
    addLine('Paiements cumulés', (receipt as any).souscription_total_paye);
    addLine('Ce paiement', Number(receipt.montant_total));
    addLine('Solde restant', (receipt as any).souscription_solde_restant);
  } else if (receipt.type_operation === 'droit_terre') {
    addLine('Mensualité droit de terre', (receipt as any).droit_terre_mensuel);
    addLine('Paiements cumulés', (receipt as any).droit_terre_total_paye);
    addLine('Ce paiement', Number(receipt.montant_total));
    addLine('Solde restant', (receipt as any).droit_terre_solde_restant);
  }

  // Section signatures (position dynamique)
  const signatureY = Math.min(Math.max(y + 10, 200), 260);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Signature Client", 30, signatureY);
  doc.text("Signature Caisse", 130, signatureY);

  // Lignes de signature
  doc.setFont("helvetica", "normal");
  doc.line(20, signatureY + 10, 80, signatureY + 10);
  doc.line(120, signatureY + 10, 180, signatureY + 10);

  // Footer
  const footerY1 = signatureY + 30;
  const footerY2 = signatureY + 40;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Ce reçu fait foi de paiement.", 105, footerY1, { align: "center" });
  doc.text("Merci pour votre confiance.", 105, footerY2, { align: "center" });
  
  return doc;
};

// Load image as DataURL for jsPDF
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

export const downloadReceiptPDF = async (receipt: ReceiptWithDetails) => {
  let logoDataUrl: string | undefined;
  try {
    logoDataUrl = await loadImageAsDataURL('/lovable-uploads/88feb91e-8b8d-4e58-9691-d95421a2c943.png');
  } catch {}
  const doc = generateReceiptPDF(receipt, logoDataUrl);
  doc.save(`recu_${receipt.numero}.pdf`);
};

export const printReceiptPDF = async (receipt: ReceiptWithDetails) => {
  let logoDataUrl: string | undefined;
  try {
    logoDataUrl = await loadImageAsDataURL('/lovable-uploads/88feb91e-8b8d-4e58-9691-d95421a2c943.png');
  } catch {}
  const doc = generateReceiptPDF(receipt, logoDataUrl);
  (doc as any).autoPrint?.();
  const blobUrl = doc.output('bloburl');
  const win = window.open(blobUrl);
  win?.focus();
};
