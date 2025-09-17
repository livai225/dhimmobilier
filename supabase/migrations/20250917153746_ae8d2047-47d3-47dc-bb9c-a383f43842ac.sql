-- Régénération des paiements de droit de terre d'août pour déclencher la création automatique des reçus

-- Identifier et traiter les souscriptions de droit de terre récemment importées
DO $$
DECLARE
  subs_record RECORD;
  montant_aout NUMERIC;
  payment_date DATE := '2024-08-15'; -- Date du paiement d'août
BEGIN
  -- Pour chaque souscription de droit de terre importée récemment et maintenant en bonne phase
  FOR subs_record IN 
    SELECT s.id, s.montant_droit_terre_mensuel, c.nom as client_nom, c.prenom as client_prenom
    FROM public.souscriptions s
    JOIN public.clients c ON c.id = s.client_id  
    WHERE s.type_souscription = 'mise_en_garde'
      AND s.phase_actuelle = 'droit_terre'
      AND s.montant_droit_terre_mensuel > 0
      AND s.created_at >= CURRENT_DATE - INTERVAL '1 day' -- Imports récents
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
        'Import août 2024 - droit de terre'
      );
      
      RAISE NOTICE 'Paiement août créé pour souscription % (client: % %) - montant: %', 
        subs_record.id, 
        COALESCE(subs_record.client_prenom, ''), 
        subs_record.client_nom,
        subs_record.montant_droit_terre_mensuel;
    END IF;
  END LOOP;
END $$;