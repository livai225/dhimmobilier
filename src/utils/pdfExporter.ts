import jsPDF from 'jspdf';

interface ReportData {
  title: string;
  period: string;
  data: any;
}

export function exportToPDF(reportData: ReportData, filename: string) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text('DH Immobilier Pro', 20, 20);
  
  doc.setFontSize(16);
  doc.text(reportData.title, 20, 35);
  
  doc.setFontSize(12);
  doc.text(reportData.period, 20, 45);
  
  // Content based on report type
  let yPosition = 60;
  
  if (reportData.data.revenues) {
    // Financial report
    doc.setFontSize(14);
    doc.text('Résumé Financier', 20, yPosition);
    yPosition += 15;
    
    doc.setFontSize(10);
    doc.text(`Revenus Locations: ${reportData.data.revenues.locations.toLocaleString()} FCFA`, 20, yPosition);
    yPosition += 8;
    doc.text(`Revenus Souscriptions: ${reportData.data.revenues.souscriptions.toLocaleString()} FCFA`, 20, yPosition);
    yPosition += 8;
    doc.text(`Revenus Droits de Terre: ${reportData.data.revenues.droitsTerre.toLocaleString()} FCFA`, 20, yPosition);
    yPosition += 8;
    doc.text(`Total Revenus: ${reportData.data.revenues.total.toLocaleString()} FCFA`, 20, yPosition);
    yPosition += 15;
    
    doc.text(`Dépenses: ${reportData.data.expenses.toLocaleString()} FCFA`, 20, yPosition);
    yPosition += 8;
    doc.text(`Résultat Net: ${reportData.data.netResult.toLocaleString()} FCFA`, 20, yPosition);
    yPosition += 8;
    doc.text(`Marge: ${reportData.data.profitMargin.toFixed(1)}%`, 20, yPosition);
  }
  
  // Footer
  doc.setFontSize(8);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 20, 280);
  
  doc.save(filename);
}