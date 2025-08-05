export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      bareme_droits_terre: {
        Row: {
          created_at: string
          description: string | null
          id: string
          montant_mensuel: number
          type_bien: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          montant_mensuel: number
          type_bien: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          montant_mensuel?: number
          type_bien?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          adresse: string | null
          contact_urgence_nom: string | null
          contact_urgence_relation: string | null
          contact_urgence_telephone: string | null
          created_at: string
          email: string | null
          id: string
          nom: string
          prenom: string | null
          telephone_principal: string | null
          telephone_secondaire_1: string | null
          telephone_secondaire_2: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_relation?: string | null
          contact_urgence_telephone?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          prenom?: string | null
          telephone_principal?: string | null
          telephone_secondaire_1?: string | null
          telephone_secondaire_2?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          contact_urgence_nom?: string | null
          contact_urgence_relation?: string | null
          contact_urgence_telephone?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          prenom?: string | null
          telephone_principal?: string | null
          telephone_secondaire_1?: string | null
          telephone_secondaire_2?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      echeances_droit_terre: {
        Row: {
          created_at: string
          date_echeance: string
          date_paiement: string | null
          id: string
          montant: number
          montant_paye: number | null
          numero_echeance: number
          souscription_id: string
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_echeance: string
          date_paiement?: string | null
          id?: string
          montant: number
          montant_paye?: number | null
          numero_echeance: number
          souscription_id: string
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_echeance?: string
          date_paiement?: string | null
          id?: string
          montant?: number
          montant_paye?: number | null
          numero_echeance?: number
          souscription_id?: string
          statut?: string
          updated_at?: string
        }
        Relationships: []
      }
      factures_fournisseurs: {
        Row: {
          created_at: string
          date_facture: string
          description: string | null
          fournisseur_id: string
          id: string
          montant_paye: number
          montant_total: number
          numero: string
          propriete_id: string | null
          solde: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_facture: string
          description?: string | null
          fournisseur_id: string
          id?: string
          montant_paye?: number
          montant_total?: number
          numero: string
          propriete_id?: string | null
          solde?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_facture?: string
          description?: string | null
          fournisseur_id?: string
          id?: string
          montant_paye?: number
          montant_total?: number
          numero?: string
          propriete_id?: string | null
          solde?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "factures_fournisseurs_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_fournisseurs_propriete_id_fkey"
            columns: ["propriete_id"]
            isOneToOne: false
            referencedRelation: "proprietes"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseurs: {
        Row: {
          adresse: string | null
          contact: string | null
          created_at: string
          email: string | null
          id: string
          nom: string
          note_performance: number | null
          numero_tva: string | null
          secteur_id: string | null
          site_web: string | null
          telephone: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          note_performance?: number | null
          numero_tva?: string | null
          secteur_id?: string | null
          site_web?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          note_performance?: number | null
          numero_tva?: string | null
          secteur_id?: string | null
          site_web?: string | null
          telephone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fournisseurs_secteur_id_fkey"
            columns: ["secteur_id"]
            isOneToOne: false
            referencedRelation: "secteurs_activite"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          caution: number
          caution_totale: number | null
          client_id: string
          created_at: string
          date_debut: string
          date_fin: string | null
          dette_totale: number
          frais_agence_1_mois: number | null
          garantie_2_mois: number | null
          id: string
          loyer_avance_2_mois: number | null
          loyer_mensuel: number
          propriete_id: string
          statut: string
          updated_at: string
        }
        Insert: {
          caution?: number
          caution_totale?: number | null
          client_id: string
          created_at?: string
          date_debut: string
          date_fin?: string | null
          dette_totale?: number
          frais_agence_1_mois?: number | null
          garantie_2_mois?: number | null
          id?: string
          loyer_avance_2_mois?: number | null
          loyer_mensuel: number
          propriete_id: string
          statut?: string
          updated_at?: string
        }
        Update: {
          caution?: number
          caution_totale?: number | null
          client_id?: string
          created_at?: string
          date_debut?: string
          date_fin?: string | null
          dette_totale?: number
          frais_agence_1_mois?: number | null
          garantie_2_mois?: number | null
          id?: string
          loyer_avance_2_mois?: number | null
          loyer_mensuel?: number
          propriete_id?: string
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_propriete_id_fkey"
            columns: ["propriete_id"]
            isOneToOne: false
            referencedRelation: "proprietes"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements_droit_terre: {
        Row: {
          created_at: string
          date_paiement: string
          id: string
          mode_paiement: string | null
          montant: number
          reference: string | null
          souscription_id: string
        }
        Insert: {
          created_at?: string
          date_paiement: string
          id?: string
          mode_paiement?: string | null
          montant: number
          reference?: string | null
          souscription_id: string
        }
        Update: {
          created_at?: string
          date_paiement?: string
          id?: string
          mode_paiement?: string | null
          montant?: number
          reference?: string | null
          souscription_id?: string
        }
        Relationships: []
      }
      paiements_factures: {
        Row: {
          created_at: string
          date_paiement: string
          facture_id: string
          id: string
          mode_paiement: string | null
          montant: number
          reference: string | null
        }
        Insert: {
          created_at?: string
          date_paiement: string
          facture_id: string
          id?: string
          mode_paiement?: string | null
          montant: number
          reference?: string | null
        }
        Update: {
          created_at?: string
          date_paiement?: string
          facture_id?: string
          id?: string
          mode_paiement?: string | null
          montant?: number
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_factures_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures_fournisseurs"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements_locations: {
        Row: {
          created_at: string
          date_paiement: string
          id: string
          location_id: string
          mode_paiement: string | null
          montant: number
          reference: string | null
        }
        Insert: {
          created_at?: string
          date_paiement: string
          id?: string
          location_id: string
          mode_paiement?: string | null
          montant: number
          reference?: string | null
        }
        Update: {
          created_at?: string
          date_paiement?: string
          id?: string
          location_id?: string
          mode_paiement?: string | null
          montant?: number
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paiements_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements_souscriptions: {
        Row: {
          created_at: string
          date_paiement: string
          id: string
          mode_paiement: string | null
          montant: number
          reference: string | null
          souscription_id: string
        }
        Insert: {
          created_at?: string
          date_paiement: string
          id?: string
          mode_paiement?: string | null
          montant: number
          reference?: string | null
          souscription_id: string
        }
        Update: {
          created_at?: string
          date_paiement?: string
          id?: string
          mode_paiement?: string | null
          montant?: number
          reference?: string | null
          souscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiements_souscriptions_souscription_id_fkey"
            columns: ["souscription_id"]
            isOneToOne: false
            referencedRelation: "souscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      proprietes: {
        Row: {
          adresse: string | null
          created_at: string
          droit_terre: number | null
          id: string
          loyer_mensuel: number | null
          montant_bail: number | null
          nom: string
          prix_achat: number | null
          statut: string | null
          surface: number | null
          type_id: string | null
          updated_at: string
          usage: string | null
          zone: string | null
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          droit_terre?: number | null
          id?: string
          loyer_mensuel?: number | null
          montant_bail?: number | null
          nom: string
          prix_achat?: number | null
          statut?: string | null
          surface?: number | null
          type_id?: string | null
          updated_at?: string
          usage?: string | null
          zone?: string | null
        }
        Update: {
          adresse?: string | null
          created_at?: string
          droit_terre?: number | null
          id?: string
          loyer_mensuel?: number | null
          montant_bail?: number | null
          nom?: string
          prix_achat?: number | null
          statut?: string | null
          surface?: number | null
          type_id?: string | null
          updated_at?: string
          usage?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proprietes_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "types_proprietes"
            referencedColumns: ["id"]
          },
        ]
      }
      recus: {
        Row: {
          client_id: string
          created_at: string
          date_generation: string
          id: string
          montant_total: number
          numero: string
          periode_debut: string | null
          periode_fin: string | null
          reference_id: string
          type_operation: string
        }
        Insert: {
          client_id: string
          created_at?: string
          date_generation?: string
          id?: string
          montant_total: number
          numero: string
          periode_debut?: string | null
          periode_fin?: string | null
          reference_id: string
          type_operation: string
        }
        Update: {
          client_id?: string
          created_at?: string
          date_generation?: string
          id?: string
          montant_total?: number
          numero?: string
          periode_debut?: string | null
          periode_fin?: string | null
          reference_id?: string
          type_operation?: string
        }
        Relationships: [
          {
            foreignKeyName: "recus_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      secteurs_activite: {
        Row: {
          created_at: string
          description: string | null
          id: string
          nom: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          nom: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
        }
        Relationships: []
      }
      souscriptions: {
        Row: {
          apport_initial: number
          client_id: string
          created_at: string
          date_debut: string
          date_debut_droit_terre: string | null
          date_fin_finition: string | null
          id: string
          montant_droit_terre_mensuel: number | null
          montant_mensuel: number
          montant_souscris: number | null
          nombre_mois: number
          periode_finition_mois: number | null
          phase_actuelle: string
          prix_total: number
          propriete_id: string
          solde_restant: number
          statut: string
          type_bien: string | null
          type_souscription: string
          updated_at: string
        }
        Insert: {
          apport_initial?: number
          client_id: string
          created_at?: string
          date_debut: string
          date_debut_droit_terre?: string | null
          date_fin_finition?: string | null
          id?: string
          montant_droit_terre_mensuel?: number | null
          montant_mensuel: number
          montant_souscris?: number | null
          nombre_mois: number
          periode_finition_mois?: number | null
          phase_actuelle?: string
          prix_total: number
          propriete_id: string
          solde_restant: number
          statut?: string
          type_bien?: string | null
          type_souscription?: string
          updated_at?: string
        }
        Update: {
          apport_initial?: number
          client_id?: string
          created_at?: string
          date_debut?: string
          date_debut_droit_terre?: string | null
          date_fin_finition?: string | null
          id?: string
          montant_droit_terre_mensuel?: number | null
          montant_mensuel?: number
          montant_souscris?: number | null
          nombre_mois?: number
          periode_finition_mois?: number | null
          phase_actuelle?: string
          prix_total?: number
          propriete_id?: string
          solde_restant?: number
          statut?: string
          type_bien?: string | null
          type_souscription?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "souscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "souscriptions_propriete_id_fkey"
            columns: ["propriete_id"]
            isOneToOne: false
            referencedRelation: "proprietes"
            referencedColumns: ["id"]
          },
        ]
      }
      types_proprietes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          nom: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          nom: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_solde_droit_terre: {
        Args: { souscription_uuid: string }
        Returns: number
      }
      fix_negative_balances: {
        Args: Record<PropertyKey, never>
        Returns: {
          facture_id: string
          ancien_solde: number
          nouveau_solde: number
        }[]
      }
      fix_souscription_balances: {
        Args: Record<PropertyKey, never>
        Returns: {
          souscription_id: string
          ancien_solde: number
          nouveau_solde: number
        }[]
      }
      generate_echeances_droit_terre: {
        Args: { souscription_uuid: string }
        Returns: undefined
      }
      generate_echeances_souscription: {
        Args: { souscription_uuid: string }
        Returns: undefined
      }
      generate_facture_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
