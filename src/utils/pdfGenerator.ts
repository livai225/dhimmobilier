import jsPDF from "jspdf";
import { ReceiptWithDetails } from "@/hooks/useReceipts";

// Helper function to generate a single receipt stub
const generateSingleReceipt = (
  doc: jsPDF, 
  receipt: ReceiptWithDetails, 
  yOffset: number,
  stubType: "CLIENT" | "ENTREPRISE",
  logoDataUrl?: string
) => {
  // Couleurs et constantes
  const primaryColor = '#2563eb';
  
  const formatCurrency = (amount: number) => {
    const formattedNumber = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(amount || 0)
      .replace(/\s/g, ' ');
    return `${formattedNumber} FCFA`;
  };
  
  // Logo (if provided) - positioned in top left
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 7, yOffset + 6, 18, 18);
    } catch (error) {
      console.error('Error adding logo to PDF:', error);
    }
  }
  
  // Header avec fond coloré (compact) - with space for logo
  doc.setFillColor('#1e40af');
  doc.rect(28, yOffset + 5, 115, 15, 'F');
  doc.setTextColor('#ffffff');
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("REÇU DE PAIEMENT", 85.5, yOffset + 14, { align: "center" });
  
  // Stub type indicator
  doc.setFontSize(8);
  doc.text(`EXEMPLAIRE ${stubType}`, 85.5, yOffset + 18, { align: "center" });
  
  // Receipt number et date
  doc.setTextColor('#000000');
  doc.setFontSize(9);
  doc.text(`N° ${receipt.numero}`, 7, yOffset + 28);
  doc.text(`${new Date(receipt.date_generation).toLocaleDateString("fr-FR")}`, 120, yOffset + 28);
  
  // Bénéficiaire info (compact)
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor('#6b7280');
  doc.text("Bénéficiaire:", 7, yOffset + 34);
  doc.setTextColor('#000000');
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const clientName = receipt.type_operation === "versement_agent"
    ? ((receipt as any).meta?.beneficiaire || `${receipt.client?.nom || ""} ${receipt.client?.prenom || ""}`.trim() || "Agent")
    : receipt.type_operation === "paiement_facture"
    ? ((receipt as any).meta?.fournisseur_nom || "Fournisseur")
    : `${receipt.client?.nom || ""} ${receipt.client?.prenom || ""}`.trim();
  doc.text(clientName, 7, yOffset + 40);

  if (receipt.client?.telephone_principal && receipt.type_operation !== "versement_agent" && receipt.type_operation !== "paiement_facture") {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(receipt.client.telephone_principal, 7, yOffset + 46);
  }
  
  // Property info (if applicable)
  if (receipt.property_name && receipt.type_operation !== "versement_agent") {
    doc.setFontSize(8);
    doc.setTextColor('#6b7280');
    doc.text(`Propriété: ${receipt.property_name}`, 7, yOffset + 52);
    doc.setTextColor('#000000');
  }
  
  // Operation type badge
  const operationTypes: Record<string, string> = {
    location: "Paiement de loyer",
    caution_location: "Caution de location", 
    apport_souscription: "Apport de location",
    droit_terre: "Droit de terre",
    paiement_facture: "Paiement de facture",
    versement_agent: "Versement agent"
  };
  
  const operationColors: Record<string, string> = {
    location: '#3b82f6',
    caution_location: '#10b981',
    apport_souscription: '#8b5cf6',
    droit_terre: '#f59e0b',
    paiement_facture: '#ef4444',
    versement_agent: '#6366f1'
  };
  
  const baseLabel = operationTypes[receipt.type_operation] || receipt.type_operation;
  const operationColor = operationColors[receipt.type_operation] || '#6b7280';
  
  doc.setFillColor(operationColor);
  doc.roundedRect(7, yOffset + 58, 130, 8, 2, 2, 'F');
  doc.setTextColor('#ffffff');
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(baseLabel, 9, yOffset + 63);
  
  // Payment details
  doc.setTextColor('#000000');
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  
  let detailY = yOffset + 72;
  if (receipt.mode_paiement) {
    const modeText = receipt.mode_paiement === 'especes' || receipt.mode_paiement === 'espece' ? 'Espèces' :
                    receipt.mode_paiement === 'cheque' ? 'Chèque' :
                    receipt.mode_paiement === 'virement' ? 'Virement' :
                    receipt.mode_paiement === 'mobile_money' ? 'Mobile Money' :
                    receipt.mode_paiement === 'carte' ? 'Carte bancaire' :
                    receipt.mode_paiement;
    doc.text(`Mode: ${modeText}`, 7, detailY);
    detailY += 7;
  }

  if (receipt.periode_debut) {
    let periodeText = `Période: ${new Date(receipt.periode_debut).toLocaleDateString("fr-FR")}`;
    if (receipt.periode_fin) {
      periodeText += ` au ${new Date(receipt.periode_fin).toLocaleDateString("fr-FR")}`;
    }
    doc.text(periodeText, 7, detailY);
    detailY += 7;
  }
  
  // Amount (highlighted)
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor);
  doc.text(`${formatCurrency(Number(receipt.montant_total))}`, 7, detailY + 5);
  
  // Payment status
  if (receipt.type_operation !== 'versement_agent') {
    const isComplete = receipt.is_payment_complete;
    const statusText = isComplete ? "COMPLET" : "PARTIEL";
    const statusColor = isComplete ? '#10b981' : '#f59e0b';
    
    doc.setFillColor(statusColor);
    doc.roundedRect(105, detailY - 2, 35, 6, 1, 1, 'F');
    doc.setTextColor('#ffffff');
    doc.setFontSize(7);
    doc.text(statusText, 107, detailY + 1);
  }
  
  // Signature area
  doc.setTextColor('#000000');
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Signature:", 7, yOffset + 95);
  doc.line(25, yOffset + 95, 135, yOffset + 95);
  
  // Footer
  doc.setTextColor('#6b7280');
  doc.setFontSize(7);
  doc.text("Ce reçu fait foi de paiement", 74, yOffset + 103, { align: "center" });
};

export const generateReceiptPDF = (receipt: ReceiptWithDetails, logoDataUrl?: string) => {
  // Create custom format for dual receipt (148mm x 210mm - A5 portrait for better readability)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [148, 210]
  });
  
  // Generate client copy
  generateSingleReceipt(doc, receipt, 0, "CLIENT", logoDataUrl);
  
  // Add cut line between receipts
  doc.setDrawColor('#cccccc');
  doc.setLineWidth(0.3);
  // Dotted line
  for (let x = 5; x < 143; x += 3) {
    doc.line(x, 105, x + 1, 105);
  }
  doc.setFontSize(6);
  doc.setTextColor('#888888');
  doc.text("✂ DÉCOUPER ICI ✂", 74, 103, { align: "center" });
  
  // Generate enterprise copy
  generateSingleReceipt(doc, receipt, 105, "ENTREPRISE", logoDataUrl);
  
  return doc;
};

// Load image as DataURL for jsPDF
const loadImageAsDataURL = async (url: string): Promise<string> => {
  // Si c'est déjà un data URL (base64), le retourner directement
  if (url.startsWith('data:')) {
    return url;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch image: ${res.statusText}`);
    }
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image as DataURL"));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error loading image:", error);
    throw error;
  }
};

// Download receipt as PDF (dual-stub format)
export const downloadReceiptPDF = async (receipt: ReceiptWithDetails, logoUrl?: string) => {
  try {
    const logoDataUrl = logoUrl ? await loadImageAsDataURL(logoUrl) : undefined;
    const doc = generateReceiptPDF(receipt, logoDataUrl);
    const filename = `recu_${receipt.numero}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error("Error generating receipt PDF:", error);
    const doc = generateReceiptPDF(receipt);
    const filename = `recu_${receipt.numero}.pdf`;
    doc.save(filename);
  }
};

// Print receipt PDF (dual-stub format)
export const printReceiptPDF = async (receipt: ReceiptWithDetails, logoUrl?: string) => {
  try {
    const logoDataUrl = logoUrl ? await loadImageAsDataURL(logoUrl) : undefined;
    const doc = generateReceiptPDF(receipt, logoDataUrl);
    
    // Try to print automatically
    const pdfBlob = doc.output("blob");
    const blobUrl = URL.createObjectURL(pdfBlob);
    
    const printWindow = window.open(blobUrl, "_blank");
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  } catch (error) {
    console.error("Error printing receipt PDF:", error);
    // Fallback without logo
    const doc = generateReceiptPDF(receipt);
    const pdfBlob = doc.output("blob");
    const blobUrl = URL.createObjectURL(pdfBlob);
    
    const printWindow = window.open(blobUrl, "_blank");
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }
};