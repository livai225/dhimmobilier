import jsPDF from "jspdf";
import { ReceiptWithDetails } from "@/hooks/useReceipts";

export const generateReceiptPDF = (receipt: ReceiptWithDetails) => {
  const doc = new jsPDF();
  
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
  
  const operationTypes = {
    location: "Paiement de loyer",
    caution_location: "Caution de location",
    apport_souscription: "Apport de souscription",
    droit_terre: "Droit de terre",
    paiement_facture: "Paiement de facture"
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
  doc.text(`MONTANT: ${receipt.montant_total.toLocaleString("fr-FR")} FCFA`, 20, 170);
  
  // Footer
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Ce reçu fait foi de paiement.", 105, 200, { align: "center" });
  doc.text("Merci pour votre confiance.", 105, 210, { align: "center" });
  
  return doc;
};

export const downloadReceiptPDF = (receipt: ReceiptWithDetails) => {
  const doc = generateReceiptPDF(receipt);
  doc.save(`recu_${receipt.numero}.pdf`);
};