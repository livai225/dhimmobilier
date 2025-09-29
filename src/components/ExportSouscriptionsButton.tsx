import { ButtonHTMLAttributes, useState } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface ExportSouscriptionsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
}

export function ExportSouscriptionsButton({ label = "Exporter toutes les souscriptions", ...props }: ExportSouscriptionsButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // Récupérer toutes les souscriptions avec les informations complètes
      const { data: souscriptions, error } = await supabase
        .from("souscriptions")
        .select(`
          id,
          client_id,
          propriete_id,
          prix_total,
          apport_initial,
          montant_mensuel,
          nombre_mois,
          date_debut,
          solde_restant,
          periode_finition_mois,
          date_fin_finition,
          date_debut_droit_terre,
          montant_droit_terre_mensuel,
          montant_souscris,
          statut,
          type_souscription,
          phase_actuelle,
          type_bien,
          created_at,
          updated_at,
          clients!inner(
            id,
            nom,
            prenom,
            email,
            telephone_principal,
            adresse
          ),
          proprietes!inner(
            id,
            nom,
            adresse,
            zone,
            usage,
            surface,
            loyer_mensuel,
            prix_achat,
            agent_id,
            agents_recouvrement(
              nom,
              prenom,
              code_agent
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!souscriptions || souscriptions.length === 0) {
        toast({
          title: "Aucune donnée",
          description: "Aucune souscription à exporter.",
          variant: "destructive",
        });
        return;
      }

      // Préparer les données pour l'export Excel
      const excelData = souscriptions.map((sub) => ({
        // Identifiants
        "ID_Souscription": sub.id,
        "ID_Client": sub.client_id,
        "ID_Propriete": sub.propriete_id,
        
        // Informations client
        "Client_Nom": sub.clients?.nom || "",
        "Client_Prenom": sub.clients?.prenom || "",
        "Client_Email": sub.clients?.email || "",
        "Client_Telephone": sub.clients?.telephone_principal || "",
        "Client_Adresse": sub.clients?.adresse || "",
        
        // Informations propriété
        "Propriete_Nom": sub.proprietes?.nom || "",
        "Propriete_Adresse": sub.proprietes?.adresse || "",
        "Propriete_Zone": sub.proprietes?.zone || "",
        "Propriete_Usage": sub.proprietes?.usage || "",
        "Propriete_Surface": sub.proprietes?.surface || "",
        "Propriete_Loyer_Mensuel": sub.proprietes?.loyer_mensuel || "",
        "Propriete_Prix_Achat": sub.proprietes?.prix_achat || "",
        
        // Informations agent
        "Agent_Nom": sub.proprietes?.agents_recouvrement?.nom || "",
        "Agent_Prenom": sub.proprietes?.agents_recouvrement?.prenom || "",
        "Agent_Code": sub.proprietes?.agents_recouvrement?.code_agent || "",
        
        // Informations souscription
        "Type_Souscription": sub.type_souscription,
        "Statut": sub.statut,
        "Phase_Actuelle": sub.phase_actuelle,
        "Prix_Total": sub.prix_total,
        "Apport_Initial": sub.apport_initial,
        "Montant_Mensuel": sub.montant_mensuel,
        "Nombre_Mois": sub.nombre_mois,
        "Solde_Restant": sub.solde_restant,
        "Montant_Souscris": sub.montant_souscris || 0,
        
        // Dates importantes
        "Date_Debut": sub.date_debut ? new Date(sub.date_debut).toLocaleDateString('fr-FR') : "",
        "Date_Fin_Finition": sub.date_fin_finition ? new Date(sub.date_fin_finition).toLocaleDateString('fr-FR') : "",
        "Date_Debut_Droit_Terre": sub.date_debut_droit_terre ? new Date(sub.date_debut_droit_terre).toLocaleDateString('fr-FR') : "",
        "Periode_Finition_Mois": sub.periode_finition_mois || "",
        
        // Droits de terre actuels
        "Type_Bien_Actuel": sub.type_bien || "",
        "Montant_Droit_Terre_Mensuel_Actuel": sub.montant_droit_terre_mensuel || 0,
        
        // Colonnes pour modifications (vides)
        "Nouveau_Type_Bien": "",
        "Nouveau_Montant_Droit_Terre": "",
        "Commentaire_Modification": "",
        
        // Colonnes de calcul automatique (formules Excel)
        "Calcul_Terrain": "=IF(Nouveau_Type_Bien=\"terrain\", 15000, \"\")",
        "Calcul_Villa": "=IF(Nouveau_Type_Bien=\"villa\", 25000, \"\")",
        "Calcul_Appartement": "=IF(Nouveau_Type_Bien=\"appartement\", 20000, \"\")",
        "Calcul_Commercial": "=IF(Nouveau_Type_Bien=\"commercial\", 30000, \"\")",
        
        // Métadonnées
        "Date_Creation": sub.created_at ? new Date(sub.created_at).toLocaleDateString('fr-FR') : "",
        "Date_Modification": sub.updated_at ? new Date(sub.updated_at).toLocaleDateString('fr-FR') : "",
      }));

      // Créer le fichier Excel
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Définir la largeur des colonnes
      const colWidths = [
        { wch: 15 }, // ID_Souscription
        { wch: 15 }, // ID_Client
        { wch: 15 }, // ID_Propriete
        { wch: 20 }, // Client_Nom
        { wch: 20 }, // Client_Prenom
        { wch: 25 }, // Client_Email
        { wch: 15 }, // Client_Telephone
        { wch: 30 }, // Client_Adresse
        { wch: 25 }, // Propriete_Nom
        { wch: 30 }, // Propriete_Adresse
        { wch: 15 }, // Propriete_Zone
        { wch: 15 }, // Propriete_Usage
        { wch: 12 }, // Propriete_Surface
        { wch: 15 }, // Propriete_Loyer_Mensuel
        { wch: 15 }, // Propriete_Prix_Achat
        { wch: 15 }, // Agent_Nom
        { wch: 15 }, // Agent_Prenom
        { wch: 12 }, // Agent_Code
        { wch: 18 }, // Type_Souscription
        { wch: 12 }, // Statut
        { wch: 15 }, // Phase_Actuelle
        { wch: 15 }, // Prix_Total
        { wch: 15 }, // Apport_Initial
        { wch: 15 }, // Montant_Mensuel
        { wch: 12 }, // Nombre_Mois
        { wch: 15 }, // Solde_Restant
        { wch: 15 }, // Montant_Souscris
        { wch: 12 }, // Date_Debut
        { wch: 15 }, // Date_Fin_Finition
        { wch: 18 }, // Date_Debut_Droit_Terre
        { wch: 15 }, // Periode_Finition_Mois
        { wch: 15 }, // Type_Bien_Actuel
        { wch: 20 }, // Montant_Droit_Terre_Mensuel_Actuel
        { wch: 20 }, // Nouveau_Type_Bien
        { wch: 25 }, // Nouveau_Montant_Droit_Terre
        { wch: 30 }, // Commentaire_Modification
        { wch: 15 }, // Calcul_Terrain
        { wch: 15 }, // Calcul_Villa
        { wch: 18 }, // Calcul_Appartement
        { wch: 18 }, // Calcul_Commercial
        { wch: 15 }, // Date_Creation
        { wch: 18 }, // Date_Modification
      ];
      
      worksheet['!cols'] = colWidths;

      // Ajouter des styles pour les en-têtes
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellAddress]) continue;
        worksheet[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "E2E8F0" } },
        };
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Souscriptions");

      // Ajouter une feuille d'instructions
      const instructionsData = [
        ["INSTRUCTIONS POUR LA MODIFICATION DES DROITS DE TERRE"],
        [""],
        ["1. Colonnes importantes pour modification:"],
        ["   - Nouveau_Type_Bien: Saisir 'terrain', 'villa', 'appartement', ou 'commercial'"],
        ["   - Nouveau_Montant_Droit_Terre: Ou saisir directement un montant personnalisé"],
        [""],
        ["2. Barème par défaut:"],
        ["   - Terrain: 15,000 FCFA/mois"],
        ["   - Villa: 25,000 FCFA/mois"],
        ["   - Appartement: 20,000 FCFA/mois"],
        ["   - Commercial: 30,000 FCFA/mois"],
        [""],
        ["3. Les colonnes Calcul_* se remplissent automatiquement selon le type choisi"],
        [""],
        ["4. Après modification, réimporter ce fichier dans l'application"],
        [""],
        ["5. Les colonnes avec ID_* ne doivent pas être modifiées"],
      ];

      const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
      instructionsSheet['!cols'] = [{ wch: 80 }];
      XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

      const filename = `souscriptions_export_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export réussi",
        description: `${souscriptions.length} souscriptions exportées dans ${filename}`,
      });

    } catch (error) {
      console.error("Error exporting souscriptions:", error);
      toast({
        title: "Erreur d'export",
        description: "Impossible d'exporter les souscriptions.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleExport}
      disabled={isExporting}
      {...props}
    >
      <Download className="mr-2 h-4 w-4" />
      {isExporting ? "Export en cours..." : label}
    </Button>
  );
}