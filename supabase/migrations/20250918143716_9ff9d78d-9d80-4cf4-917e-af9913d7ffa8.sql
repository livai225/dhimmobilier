-- Script pour marquer les souscriptions historiques/importées comme entièrement payées
-- Cela concerne les souscriptions où les paiements déjà effectués couvrent le prix total

DO $$
DECLARE
  subscription_record RECORD;
  total_paye NUMERIC;
BEGIN
  -- Parcourir toutes les souscriptions de type 'mise_en_garde' (importées)
  FOR subscription_record IN 
    SELECT id, prix_total, solde_restant, type_souscription
    FROM public.souscriptions
    WHERE type_souscription IN ('mise_en_garde', 'historique')
  LOOP
    -- Calculer le total payé pour cette souscription
    SELECT COALESCE(SUM(montant), 0) INTO total_paye
    FROM public.paiements_souscriptions 
    WHERE souscription_id = subscription_record.id;
    
    -- Si le total payé est égal ou supérieur au prix total, 
    -- marquer la souscription comme entièrement payée
    IF total_paye >= subscription_record.prix_total THEN
      UPDATE public.souscriptions 
      SET 
        solde_restant = 0,
        updated_at = now()
      WHERE id = subscription_record.id;
      
      RAISE NOTICE 'Souscription % marquée comme payée (total payé: %, prix: %)', 
        subscription_record.id, total_paye, subscription_record.prix_total;
    END IF;
  END LOOP;
END $$;

-- Ajouter un nouveau type de souscription pour les imports historiques
DO $$
BEGIN
  -- Vérifier si on peut modifier le type enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'historique' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'souscription_type')
  ) THEN
    -- Comme on ne peut pas facilement modifier un enum, on utilisera des valeurs text existantes
    -- Mettre à jour les souscriptions importées avec un type plus approprié
    UPDATE public.souscriptions 
    SET type_souscription = 'historique'
    WHERE type_souscription = 'mise_en_garde' 
    AND solde_restant = 0;