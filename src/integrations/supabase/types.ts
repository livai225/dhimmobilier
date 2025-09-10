export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agents_recouvrement: {
        Row: {
          adresse: string | null
          code_agent: string
          commission_pourcentage: number | null
          created_at: string
          date_embauche: string
          email: string | null
          id: string
          nom: string
          prenom: string
          salaire_base: number | null
          statut: string
          telephone: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          code_agent: string
          commission_pourcentage?: number | null
          created_at?: string
          date_embauche?: string
          email?: string | null
          id?: string
          nom: string
          prenom: string
          salaire_base?: number | null
          statut?: string
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          code_agent?: string
          commission_pourcentage?: number | null
          created_at?: string
          date_embauche?: string
          email?: string | null
          id?: string
          nom?: string
          prenom?: string
          salaire_base?: number | null
          statut?: string
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          nom: string
          prix_reference: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          nom: string
          prix_reference?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          nom?: string
          prix_reference?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      available_permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_name: string
          id: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
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
      caisse_balance: {
        Row: {
          created_at: string
          derniere_maj: string
          id: string
          solde_courant: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          derniere_maj?: string
          id?: string
          solde_courant?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          derniere_maj?: string
          id?: string
          solde_courant?: number
          updated_at?: string
        }
        Relationships: []
      }
      cash_transactions: {
        Row: {
          agent_id: string | null
          beneficiaire: string | null
          created_at: string
          created_by: string | null
          date_transaction: string
          description: string | null
          heure_transaction: string
          id: string
          montant: number
          piece_justificative: string | null
          reference_operation: string | null
          solde_apres: number
          solde_avant: number
          type_operation: string
          type_transaction: string
        }
        Insert: {
          agent_id?: string | null
          beneficiaire?: string | null
          created_at?: string
          created_by?: string | null
          date_transaction?: string
          description?: string | null
          heure_transaction?: string
          id?: string
          montant: number
          piece_justificative?: string | null
          reference_operation?: string | null
          solde_apres: number
          solde_avant: number
          type_operation: string
          type_transaction: string
        }
        Update: {
          agent_id?: string | null
          beneficiaire?: string | null
          created_at?: string
          created_by?: string | null
          date_transaction?: string
          description?: string | null
          heure_transaction?: string
          id?: string
          montant?: number
          piece_justificative?: string | null
          reference_operation?: string | null
          solde_apres?: number
          solde_avant?: number
          type_operation?: string
          type_transaction?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_recouvrement"
            referencedColumns: ["id"]
          },
        ]
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
      receipt_counters: {
        Row: {
          date_key: string
          last_number: number
          prefix: string
        }
        Insert: {
          date_key: string
          last_number?: number
          prefix: string
        }
        Update: {
          date_key?: string
          last_number?: number
          prefix?: string
        }
        Relationships: []
      }
      recus: {
        Row: {
          client_id: string | null
          created_at: string
          date_generation: string
          id: string
          meta: Json | null
          montant_total: number
          numero: string
          periode_debut: string | null
          periode_fin: string | null
          reference_id: string
          type_operation: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          date_generation?: string
          id?: string
          meta?: Json | null
          montant_total: number
          numero: string
          periode_debut?: string | null
          periode_fin?: string | null
          reference_id: string
          type_operation: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          date_generation?: string
          id?: string
          meta?: Json | null
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
      user_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          actif: boolean
          created_at: string
          email: string | null
          id: string
          nom: string
          password_hash: string | null
          prenom: string
          role: Database["public"]["Enums"]["user_role"]
          telephone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          actif?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          password_hash?: string | null
          prenom: string
          role?: Database["public"]["Enums"]["user_role"]
          telephone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          actif?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          password_hash?: string | null
          prenom?: string
          role?: Database["public"]["Enums"]["user_role"]
          telephone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      ventes: {
        Row: {
          agent_id: string | null
          article_id: string
          cash_transaction_id: string | null
          created_at: string
          date_vente: string
          description: string | null
          id: string
          montant: number
          quantite: number | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          article_id: string
          cash_transaction_id?: string | null
          created_at?: string
          date_vente?: string
          description?: string | null
          id?: string
          montant: number
          quantite?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          article_id?: string
          cash_transaction_id?: string | null
          created_at?: string
          date_vente?: string
          description?: string | null
          id?: string
          montant?: number
          quantite?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventes_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_recouvrement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_cash_transaction_id_fkey"
            columns: ["cash_transaction_id"]
            isOneToOne: false
            referencedRelation: "cash_transactions"
            referencedColumns: ["id"]
          },
        ]
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
      can_make_payment: {
        Args: { amount: number }
        Returns: boolean
      }
      fix_negative_balances: {
        Args: Record<PropertyKey, never>
        Returns: {
          ancien_solde: number
          facture_id: string
          nouveau_solde: number
        }[]
      }
      fix_souscription_balances: {
        Args: Record<PropertyKey, never>
        Returns: {
          ancien_solde: number
          nouveau_solde: number
          souscription_id: string
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
      generate_receipt_number: {
        Args: { p_type_operation: string }
        Returns: string
      }
      get_agent_statistics: {
        Args: { agent_uuid: string; end_date?: string; start_date?: string }
        Returns: {
          dernier_versement: string
          moyenne_versement: number
          nombre_versements: number
          total_verse: number
        }[]
      }
      get_current_cash_balance: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_solde_caisse_entreprise: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      pay_caution_with_cash: {
        Args: {
          p_date_paiement: string
          p_description?: string
          p_location_id: string
          p_mode_paiement?: string
          p_montant: number
          p_reference?: string
        }
        Returns: string
      }
      pay_droit_terre_with_cash: {
        Args: {
          p_date_paiement: string
          p_description?: string
          p_mode_paiement?: string
          p_montant: number
          p_reference?: string
          p_souscription_id: string
        }
        Returns: string
      }
      pay_facture_with_cash: {
        Args: {
          p_date_paiement: string
          p_description?: string
          p_facture_id: string
          p_mode_paiement?: string
          p_montant: number
          p_reference?: string
        }
        Returns: string
      }
      pay_location_with_cash: {
        Args: {
          p_date_paiement: string
          p_description?: string
          p_location_id: string
          p_mode_paiement?: string
          p_montant: number
          p_reference?: string
        }
        Returns: string
      }
      pay_souscription_with_cash: {
        Args: {
          p_date_paiement: string
          p_description?: string
          p_mode_paiement?: string
          p_montant: number
          p_reference?: string
          p_souscription_id: string
        }
        Returns: string
      }
      recalculate_cash_balances: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      record_cash_transaction: {
        Args: {
          p_agent_id?: string
          p_beneficiaire?: string
          p_description?: string
          p_montant: number
          p_piece_justificative?: string
          p_reference_operation?: string
          p_type_operation: string
          p_type_transaction: string
        }
        Returns: string
      }
      record_sale_with_cash: {
        Args: {
          p_agent_id?: string
          p_article_id: string
          p_date_vente?: string
          p_description?: string
          p_montant: number
          p_quantite?: number
        }
        Returns: string
      }
    }
    Enums: {
      user_role: "admin" | "comptable" | "secretaire"
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
    Enums: {
      user_role: ["admin", "comptable", "secretaire"],
    },
  },
} as const
