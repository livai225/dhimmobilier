-- Plan de correction complet pour générer les paiements et reçus de droit de terre

-- ÉTAPE 1: Correction des souscriptions défaillantes
-- Mettre à jour les souscriptions importées récemment qui ont des problèmes de configuration

UPDATE public.souscriptions 
SET 
  montant_droit_terre_mensuel = 25000,
  phase_actuelle = 'droit_terre',
  updated_at = now()
WHERE type_souscription = 'mise_en_garde'
  AND type_bien = 'terrain'
  AND (montant_droit_terre_mensuel IS NULL OR montant_droit_terre_mensuel = 0)
  AND phase_actuelle = 'souscription'
  AND date_debut_droit_terre IS NOT NULL
  AND created_at >= CURRENT_DATE - INTERVAL '2 days'; -- Souscriptions récentes

-- ÉTAPE 2: Génération des paiements d'août avec reçus automatiques
DO $$
DECLARE
  subs_record RECORD;
  payment_date DATE := '2024-08-15';
  payments_created INTEGER := 0;
BEGIN
  -- Pour chaque souscription de droit de terre maintenant correctement configurée
  FOR subs_record IN 
    SELECT s.id, s.montant_droit_terre_mensuel, c.nom as client_nom, c.prenom as client_prenom
    FROM public.souscriptions s
    JOIN public.clients c ON c.id = s.client_id  
    WHERE s.type_souscription = 'mise_en_garde'
      AND s.phase_actuelle = 'droit_terre'
      AND s.montant_droit_terre_mensuel = 25000
      AND s.date_debut_droit_terre IS NOT NULL
      AND s.created_at >= CURRENT_DATE - INTERVAL '2 days'
  LOOP
    -- Vérifier s'il n'y a pas déjà un paiement pour août
    IF NOT EXISTS (
      SELECT 1 FROM public.paiements_droit_terre 
      WHERE souscription_id = subs_record.id 
        AND date_paiement BETWEEN '2024-08-01' AND '2024-08-31'
    ) THEN
      
      -- Insérer le paiement d'août (le trigger créera automatiquement le reçu)
      INSERT INTO public.paiements_droit_terre (
        souscription_id,
        montant,
        date_paiement,
        mode_paiement,
        reference
      ) VALUES (
        subs_record.id,
        subs_record.montant_droit_terre_mensuel,
        payment_date,
        'espece',
        'Paiement août 2024 - droit de terre'
      );
      
      payments_created := payments_created + 1;
      
      RAISE NOTICE 'Paiement août créé pour souscription % (client: % %) - montant: %', 
        subs_record.id, 
        COALESCE(subs_record.client_prenom, ''), 
        subs_record.client_nom,
        subs_record.montant_droit_terre_mensuel;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Total des paiements créés: %', payments_created;
END $$;