import jsPDF from "jspdf";
import { ReceiptWithDetails } from "@/hooks/useReceipts";

export const generateReceiptPDF = (receipt: ReceiptWithDetails, logoDataUrl?: string) => {
  const doc = new jsPDF();
  
  // Couleurs et constantes
  const primaryColor = '#2563eb'; // blue-600
  const backgroundColor = '#f9fafb'; // gray-50
  const borderColor = '#e5e7eb'; // gray-200
  
  // Helper function pour ajouter des rectangles avec bordures
  const addCard = (x: number, y: number, width: number, height: number) => {
    doc.setFillColor(backgroundColor);
    doc.setDrawColor(borderColor);
    doc.rect(x, y, width, height, 'FD');
  };
  
  // Helper function pour badges colorés
  const addBadge = (text: string, x: number, y: number, bgColor: string, textColor: string = '#ffffff') => {
    doc.setFillColor(bgColor);
    doc.roundedRect(x, y, 40, 6, 2, 2, 'F');
    doc.setTextColor(textColor);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(text, x + 2, y + 4);
    doc.setTextColor('#000000'); // Reset to black
  };
  
  // Logo (optional)
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 14, 10, 30, 30);
    } catch (e) {
      // Ignore image errors silently
    }
  }
  
  // Header avec fond coloré
  doc.setFillColor('#1e40af'); // blue-800
  doc.rect(0, 45, 210, 25, 'F');
  doc.setTextColor('#ffffff');
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("REÇU DE PAIEMENT", 105, 60, { align: "center" });
  
  // Receipt number et date dans l'en-tête
  doc.setFontSize(12);
  doc.text(`N° ${receipt.numero}`, 20, 80);
  doc.text(`Date: ${new Date(receipt.date_generation).toLocaleDateString("fr-FR")}`, 140, 80);
  doc.setTextColor('#000000'); // Reset to black
  
  // Layout en deux colonnes comme la fiche détails
  let yPos = 90;
  const leftColumnX = 15;
  const rightColumnX = 110;
  const columnWidth = 85;
  const cardHeight = 45;
  
  // Carte 1: Informations Client/Agent/Fournisseur
  addCard(leftColumnX, yPos, columnWidth, cardHeight);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor('#6b7280'); // gray-500
  
  const headerText = receipt.type_operation === "versement_agent" ? "INFORMATIONS AGENT" : 
                    receipt.type_operation === "paiement_facture" ? "INFORMATIONS FOURNISSEUR" : 
                    "INFORMATIONS CLIENT";
  doc.text(headerText, leftColumnX + 3, yPos + 8);
  
  doc.setTextColor('#000000');
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  
  const clientName = `${receipt.client?.nom || ""} ${receipt.client?.prenom || ""}`.trim();
  doc.text(clientName, leftColumnX + 3, yPos + 16);
  
  let detailY = yPos + 24;
  if (receipt.client?.email) {
    doc.setFontSize(9);
    doc.setTextColor('#6b7280');
    doc.text(receipt.client.email, leftColumnX + 3, detailY);
    detailY += 6;
  }
  
  if (receipt.client?.telephone_principal) {
    doc.setFontSize(9);
    doc.setTextColor('#6b7280');
    doc.text(receipt.client.telephone_principal, leftColumnX + 3, detailY);
  }

  // Carte 2: Propriété concernée
  if (receipt.property_name && receipt.type_operation !== "versement_agent") {
    addCard(rightColumnX, yPos, columnWidth, cardHeight);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor('#6b7280');
    doc.text("PROPRIÉTÉ CONCERNÉE", rightColumnX + 3, yPos + 8);
    
    doc.setTextColor(primaryColor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(receipt.property_name, rightColumnX + 3, yPos + 16);
    
    let propDetailY = yPos + 24;
    if (receipt.property_address) {
      doc.setFontSize(9);
      doc.setTextColor('#6b7280');
      doc.text(receipt.property_address, rightColumnX + 3, propDetailY);
      propDetailY += 6;
    }
    
    if (receipt.type_bien) {
      doc.setFontSize(9);
      doc.setTextColor('#6b7280');
      doc.text(`Type: ${receipt.type_bien}`, rightColumnX + 3, propDetailY);
    }
  }
  
  // Deuxième ligne de cartes
  yPos += 55;
  
  // Carte 3: Contexte de l'opération
  addCard(leftColumnX, yPos, columnWidth, cardHeight);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor('#6b7280');
  doc.text("CONTEXTE DE L'OPÉRATION", leftColumnX + 3, yPos + 8);
  
  // Badge coloré pour le type d'opération
  const operationColors: Record<string, string> = {
    location: '#3b82f6', // blue-500
    caution_location: '#10b981', // green-500
    apport_souscription: '#8b5cf6', // purple-500
    droit_terre: '#f59e0b', // orange-500
    paiement_facture: '#ef4444', // red-500
    versement_agent: '#6366f1' // indigo-500
  };
  
  const operationTypes: Record<string, string> = {
    location: "Paiement de loyer",
    caution_location: "Caution de location", 
    apport_souscription: "Apport de souscription",
    droit_terre: "Droit de terre",
    paiement_facture: "Paiement de facture",
    versement_agent: "Versement agent"
  };
  
  const baseLabel = operationTypes[receipt.type_operation] || receipt.type_operation;
  const operationColor = operationColors[receipt.type_operation] || '#6b7280';
  
  // Badge avec la couleur appropriée
  doc.setFillColor(operationColor);
  doc.roundedRect(leftColumnX + 3, yPos + 12, 75, 8, 2, 2, 'F');
  doc.setTextColor('#ffffff');
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(baseLabel, leftColumnX + 5, yPos + 17.5);
  
  // Détails contextuels
  let contextY = yPos + 25;
  doc.setTextColor('#000000');
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  if (receipt.mode_paiement) {
    const modeText = receipt.mode_paiement === 'especes' || receipt.mode_paiement === 'espece' ? 'Espèces' :
                    receipt.mode_paiement === 'cheque' ? 'Chèque' :
                    receipt.mode_paiement === 'virement' ? 'Virement' :
                    receipt.mode_paiement === 'mobile_money' ? 'Mobile Money' :
                    receipt.mode_paiement === 'carte' ? 'Carte bancaire' :
                    receipt.mode_paiement;
    doc.text(`Mode: ${modeText}`, leftColumnX + 3, contextY);
  }

  if (receipt.periode_debut) {
    let periodeText = `Période: ${new Date(receipt.periode_debut).toLocaleDateString("fr-FR")}`;
    if (receipt.periode_fin) {
      periodeText += ` au ${new Date(receipt.periode_fin).toLocaleDateString("fr-FR")}`;
    }
    doc.text(periodeText, leftColumnX + 3, contextY + 6);
  }

  // Carte 4: Récapitulatif financier
  addCard(rightColumnX, yPos, columnWidth, cardHeight + 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor('#6b7280');
  doc.text("RÉCAPITULATIF FINANCIER", rightColumnX + 3, yPos + 8);
  
  // Statut avec badge coloré
  if (receipt.type_operation !== 'versement_agent') {
    const isComplete = receipt.is_payment_complete;
    const statusText = isComplete ? "COMPLET" : "PARTIEL";
    const statusColor = isComplete ? '#10b981' : '#f59e0b'; // green or orange
    
    doc.setFillColor(statusColor);
    doc.roundedRect(rightColumnX + 3, yPos + 12, 30, 6, 2, 2, 'F');
    doc.setTextColor('#ffffff');
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(statusText, rightColumnX + 5, yPos + 16);
  }

  // Montant principal
  doc.setTextColor('#000000');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const formatCurrency = (amount: number) => {
    const formattedNumber = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(amount || 0)
      .replace(/\s/g, ' ');
    return `${formattedNumber} FCFA`;
  };
  doc.text(`${formatCurrency(Number(receipt.montant_total))}`, rightColumnX + 3, yPos + 28);
  
  // Ajuster la position pour la suite
  yPos += 75;

  // Section détails financiers dans une carte pleine largeur
  const financialCardHeight = 45;
  addCard(leftColumnX, yPos, 180, financialCardHeight);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor('#6b7280');
  doc.text("DÉTAILS FINANCIERS", leftColumnX + 3, yPos + 8);
  
  doc.setTextColor('#000000');
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  let financialY = yPos + 16;
  const addFinancialLine = (label: string, value?: number | null, isBold: boolean = false) => {
    if (value !== undefined && value !== null && !isNaN(Number(value))) {
      if (isBold) doc.setFont("helvetica", "bold");
      doc.text(`${label}: ${formatCurrency(Number(value))}`, leftColumnX + 3, financialY);
      if (isBold) doc.setFont("helvetica", "normal");
      financialY += 6;
    }
  };

  if (receipt.type_operation === 'location') {
    const leftColX = leftColumnX + 3;
    const rightColX = leftColumnX + 93;
    let leftY = yPos + 16;
    let rightY = yPos + 16;
    
    if ((receipt as any).loyer_mensuel) {
      doc.text(`Loyer mensuel: ${formatCurrency((receipt as any).loyer_mensuel)}`, leftColX, leftY);
      leftY += 6;
    }
    if ((receipt as any).location_total_paye) {
      doc.text(`Déjà payé: ${formatCurrency((receipt as any).location_total_paye)}`, leftColX, leftY);
      leftY += 6;
    }
    doc.text(`Ce paiement: ${formatCurrency(Number(receipt.montant_total))}`, rightColX, rightY);
    rightY += 6;
    if ((receipt as any).remaining_balance !== undefined) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor('#f59e0b');
      doc.text(`Dette restante: ${formatCurrency((receipt as any).remaining_balance)}`, rightColX, rightY);
      doc.setTextColor('#000000');
      doc.setFont("helvetica", "normal");
    }
  } else if (receipt.type_operation === 'apport_souscription') {
    const leftColX = leftColumnX + 3;
    const rightColX = leftColumnX + 93;
    let leftY = yPos + 16;
    let rightY = yPos + 16;
    
    if ((receipt as any).souscription_prix_total) {
      doc.text(`Prix total: ${formatCurrency((receipt as any).souscription_prix_total)}`, leftColX, leftY);
      leftY += 6;
    }
    if ((receipt as any).souscription_total_paye) {
      doc.text(`Déjà payé: ${formatCurrency((receipt as any).souscription_total_paye)}`, leftColX, leftY);
      leftY += 6;
    }
    doc.text(`Ce paiement: ${formatCurrency(Number(receipt.montant_total))}`, rightColX, rightY);
    rightY += 6;
    if ((receipt as any).remaining_balance !== undefined) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor('#f59e0b');
      doc.text(`Solde restant: ${formatCurrency((receipt as any).remaining_balance)}`, rightColX, rightY);
      doc.setTextColor('#000000');
      doc.setFont("helvetica", "normal");
    }
  } else if (receipt.type_operation === 'droit_terre') {
    const leftColX = leftColumnX + 3;
    const rightColX = leftColumnX + 93;
    let leftY = yPos + 16;
    let rightY = yPos + 16;
    
    if ((receipt as any).droit_terre_mensuel) {
      doc.text(`Montant prévu/mois: ${formatCurrency((receipt as any).droit_terre_mensuel)}`, leftColX, leftY);
      leftY += 6;
    }
    if ((receipt as any).droit_terre_total_paye) {
      doc.text(`Total déjà payé: ${formatCurrency((receipt as any).droit_terre_total_paye)}`, leftColX, leftY);
    }
    doc.text(`Ce paiement: ${formatCurrency(Number(receipt.montant_total))}`, rightColX, rightY);
  } else if (receipt.type_operation === 'caution_location') {
    const leftColX = leftColumnX + 3;
    const rightColX = leftColumnX + 93;
    let leftY = yPos + 16;
    let rightY = yPos + 16;
    
    if ((receipt as any).caution_totale) {
      doc.text(`Caution requise: ${formatCurrency((receipt as any).caution_totale)}`, leftColX, leftY);
      leftY += 6;
    }
    if ((receipt as any).caution_total_paye) {
      doc.text(`Déjà payé: ${formatCurrency((receipt as any).caution_total_paye)}`, leftColX, leftY);
    }
    doc.text(`Ce paiement: ${formatCurrency(Number(receipt.montant_total))}`, rightColX, rightY);
    rightY += 6;
    if ((receipt as any).remaining_balance !== undefined) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor('#f59e0b');
      doc.text(`Solde restant: ${formatCurrency((receipt as any).remaining_balance)}`, rightColX, rightY);
      doc.setTextColor('#000000');
      doc.setFont("helvetica", "normal");
    }
  }
  
  yPos += financialCardHeight + 10;

  // Historique des paiements dans une carte
  if (receipt.payment_history && receipt.payment_history.length > 0) {
    const historyCardHeight = Math.min(receipt.payment_history.length * 6 + 20, 60);
    addCard(leftColumnX, yPos, 180, historyCardHeight);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor('#6b7280');
    doc.text("HISTORIQUE DES PAIEMENTS", leftColumnX + 3, yPos + 8);
    
    doc.setTextColor('#000000');
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let historyY = yPos + 16;

    const maxHistoryLines = Math.min(receipt.payment_history.length, 8);
    for (let i = 0; i < maxHistoryLines; i++) {
      const payment = receipt.payment_history[i];
      const dateStr = new Date(payment.date).toLocaleDateString("fr-FR");
      const amountStr = formatCurrency(payment.montant);
      const currentIndicator = payment.is_current ? " ← ce paiement" : "";
      const modeStr = payment.mode ? ` (${payment.mode})` : "";
      
      if (payment.is_current) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor('#2563eb');
      }
      
      doc.text(`${dateStr} - ${amountStr}${modeStr}${currentIndicator}`, leftColumnX + 3, historyY);
      
      if (payment.is_current) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor('#000000');
      }
      
      historyY += 6;
    }

    if (receipt.payment_history.length > maxHistoryLines) {
      doc.setTextColor('#6b7280');
      doc.text(`+ ${receipt.payment_history.length - maxHistoryLines} autres paiements`, leftColumnX + 3, historyY);
      doc.setTextColor('#000000');
    }
    
    yPos += historyCardHeight + 10;
  }

  // Échéances enregistrées (seulement pour droit de terre)
  if (receipt.type_operation === 'droit_terre' && receipt.echeances && receipt.echeances.length > 0) {
    const echeanceCardHeight = Math.min(receipt.echeances.length * 6 + 20, 50);
    addCard(leftColumnX, yPos, 180, echeanceCardHeight);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor('#6b7280');
    doc.text("ÉCHÉANCES ENREGISTRÉES", leftColumnX + 3, yPos + 8);
    
    doc.setTextColor('#000000');
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let echeanceY = yPos + 16;

    const maxEcheances = Math.min(receipt.echeances.length, 5);
    for (let i = 0; i < maxEcheances; i++) {
      const echeance = receipt.echeances[i];
      const dateStr = new Date(echeance.date).toLocaleDateString("fr-FR");
      const amountStr = formatCurrency(echeance.montant);
      const statutStr = echeance.statut === 'paye' ? ' ✓' : ' •';
      
      if (echeance.statut === 'paye') {
        doc.setTextColor('#10b981'); // green
      }
      
      doc.text(`Éch. ${echeance.numero} - ${dateStr} - ${amountStr}${statutStr}`, leftColumnX + 3, echeanceY);
      
      if (echeance.statut === 'paye') {
        doc.setTextColor('#000000');
      }
      
      echeanceY += 6;
    }

    if (receipt.echeances.length > maxEcheances) {
      doc.setTextColor('#6b7280');
      doc.text(`+ ${receipt.echeances.length - maxEcheances} autres échéances`, leftColumnX + 3, echeanceY);
      doc.setTextColor('#000000');
    }
    
    yPos += echeanceCardHeight + 10;
  }

  // Section signatures avec cartes élégantes
  const signatureY = Math.min(Math.max(yPos + 15, 230), 260);
  
  // Carte signature client
  addCard(leftColumnX, signatureY, 85, 25);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor('#6b7280');
  doc.text("SIGNATURE CLIENT", leftColumnX + 3, signatureY + 8);
  doc.setDrawColor('#000000');
  doc.line(leftColumnX + 3, signatureY + 18, leftColumnX + 82, signatureY + 18);
  
  // Carte signature caisse
  addCard(rightColumnX, signatureY, 85, 25);
  doc.setTextColor('#6b7280');
  doc.text("SIGNATURE CAISSE", rightColumnX + 3, signatureY + 8);
  doc.line(rightColumnX + 3, signatureY + 18, rightColumnX + 82, signatureY + 18);

  // Footer avec style moderne
  const footerY = signatureY + 35;
  doc.setFillColor('#f3f4f6'); // gray-100
  doc.rect(0, footerY, 210, 15, 'F');
  
  doc.setTextColor('#374151'); // gray-700
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Ce reçu fait foi de paiement.", 105, footerY + 6, { align: "center" });
  doc.text("Merci pour votre confiance.", 105, footerY + 12, { align: "center" });
  
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