-- Configurer le barème des droits de terre avec les montants standards
INSERT INTO public.bareme_droits_terre (type_bien, montant_mensuel, description) VALUES
('villa', 50000, 'Villa - 50,000 FCFA/mois'),
('appartement', 30000, 'Appartement - 30,000 FCFA/mois'),
('terrain', 15000, 'Terrain - 15,000 FCFA/mois'),
('commerce', 40000, 'Local commercial - 40,000 FCFA/mois'),
('bureau', 35000, 'Bureau - 35,000 FCFA/mois')
ON CONFLICT (type_bien) DO UPDATE SET
  montant_mensuel = EXCLUDED.montant_mensuel,
  description = EXCLUDED.description;

-- Fonction pour reconstituer les configurations des droits de terre à partir des données Excel
CREATE OR REPLACE FUNCTION public.reconstruct_land_rights_config()
RETURNS TABLE(
  souscription_id uuid,
  ancien_montant numeric,
  nouveau_montant numeric,
  date_debut_droit_terre date,
  phase_mise_a_jour text
)
LANGUAGE plpgsql
AS $function$
DECLARE
  sub_record RECORD;
  montant_deduit NUMERIC;
  date_debut_calcule DATE;
BEGIN
  -- Parcourir toutes les souscriptions de type historique ou mise_en_garde
  FOR sub_record IN 
    SELECT s.id, s.montant_droit_terre_mensuel, s.date_debut, s.periode_finition_mois, s.phase_actuelle,
           s.type_souscription, s.type_bien
    FROM public.souscriptions s
    WHERE s.type_souscription IN ('historique', 'mise_en_garde')
      AND (s.montant_droit_terre_mensuel = 0 OR s.date_debut_droit_terre IS NULL)
  LOOP
    -- Déduire le montant mensuel à partir du barème par défaut selon le type de bien
    SELECT b.montant_mensuel INTO montant_deduit
    FROM public.bareme_droits_terre b
    WHERE b.type_bien = COALESCE(sub_record.type_bien, 'terrain');
    
    -- Si pas trouvé dans le barème, utiliser un montant par défaut
    IF montant_deduit IS NULL THEN
      montant_deduit := 15000; -- Montant par défaut pour terrain
    END IF;
    
    -- Calculer la date de début des droits de terre
    IF sub_record.type_souscription = 'mise_en_garde' THEN
      -- Pour mise en garde: date_debut + periode_finition_mois
      date_debut_calcule := sub_record.date_debut + (COALESCE(sub_record.periode_finition_mois, 9) || ' months')::INTERVAL;
    ELSE
      -- Pour historique: directement la date de début
      date_debut_calcule := sub_record.date_debut;
    END IF;
    
    -- Mettre à jour la souscription
    UPDATE public.souscriptions
    SET 
      montant_droit_terre_mensuel = montant_deduit,
      date_debut_droit_terre = date_debut_calcule,
      date_fin_finition = CASE 
        WHEN type_souscription = 'mise_en_garde' 
        THEN date_debut + (COALESCE(periode_finition_mois, 9) || ' months')::INTERVAL
        ELSE date_fin_finition
      END,
      phase_actuelle = CASE
        WHEN type_souscription = 'historique' THEN 'droit_terre'
        WHEN type_souscription = 'mise_en_garde' AND date_debut_calcule <= CURRENT_DATE THEN 'droit_terre'
        ELSE phase_actuelle
      END,
      updated_at = now()
    WHERE id = sub_record.id;
    
    -- Retourner les détails de la mise à jour
    souscription_id := sub_record.id;
    ancien_montant := sub_record.montant_droit_terre_mensuel;
    nouveau_montant := montant_deduit;
    date_debut_droit_terre := date_debut_calcule;
    phase_mise_a_jour := CASE
      WHEN sub_record.type_souscription = 'historique' THEN 'droit_terre'
      WHEN sub_record.type_souscription = 'mise_en_garde' AND date_debut_calcule <= CURRENT_DATE THEN 'droit_terre'
      ELSE sub_record.phase_actuelle
    END;
    
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- Fonction pour créer les paiements manquants d'août pour les droits de terre
CREATE OR REPLACE FUNCTION public.create_missing_august_payments()
RETURNS TABLE(
  souscription_id uuid,
  client_nom text,
  montant_cree numeric,
  date_paiement date
)
LANGUAGE plpgsql
AS $function$
DECLARE
  sub_record RECORD;
  existing_august_payment BOOLEAN;
BEGIN
  -- Parcourir toutes les souscriptions configurées pour les droits de terre
  FOR sub_record IN 
    SELECT s.id, s.montant_droit_terre_mensuel, c.nom, c.prenom
    FROM public.souscriptions s
    JOIN public.clients c ON s.client_id = c.id
    WHERE s.montant_droit_terre_mensuel > 0 
      AND s.date_debut_droit_terre IS NOT NULL
      AND s.phase_actuelle = 'droit_terre'
  LOOP
    -- Vérifier s'il existe déjà un paiement pour août 2024
    SELECT EXISTS(
      SELECT 1 FROM public.paiements_droit_terre
      WHERE souscription_id = sub_record.id
        AND EXTRACT(YEAR FROM date_paiement) = 2024
        AND EXTRACT(MONTH FROM date_paiement) = 8
    ) INTO existing_august_payment;
    
    -- Si pas de paiement d'août, en créer un
    IF NOT existing_august_payment THEN
      INSERT INTO public.paiements_droit_terre (
        souscription_id,
        montant,
        date_paiement,
        mode_paiement,
        reference
      ) VALUES (
        sub_record.id,
        sub_record.montant_droit_terre_mensuel,
        '2024-08-15'::date,
        'especes',
        'Import reconstruction - Paiement août 2024'
      );
      
      -- Retourner les détails
      souscription_id := sub_record.id;
      client_nom := sub_record.prenom || ' ' || sub_record.nom;
      montant_cree := sub_record.montant_droit_terre_mensuel;
      date_paiement := '2024-08-15'::date;
      
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;