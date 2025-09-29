-- Step 1: Mass update of montant_droit_terre_mensuel from montant_mensuel
UPDATE public.souscriptions 
SET 
  montant_droit_terre_mensuel = montant_mensuel,
  updated_at = now()
WHERE montant_droit_terre_mensuel IS NULL OR montant_droit_terre_mensuel = 0;

-- Step 2: Reconstruct land rights configuration and dates
SELECT public.reconstruct_land_rights_config();

-- Step 3: Update phases for historical subscriptions that should be in droit_terre phase
UPDATE public.souscriptions 
SET 
  phase_actuelle = 'droit_terre',
  updated_at = now()
WHERE type_souscription IN ('historique', 'mise_en_garde')
  AND date_debut_droit_terre IS NOT NULL 
  AND date_debut_droit_terre <= CURRENT_DATE
  AND phase_actuelle != 'droit_terre';

-- Step 4: Verification - Create a summary of the updates
DO $$
DECLARE
  total_updated INTEGER;
  historical_count INTEGER;
  mise_en_garde_count INTEGER;
BEGIN
  -- Count total subscriptions with montant_droit_terre_mensuel now filled
  SELECT COUNT(*) INTO total_updated 
  FROM public.souscriptions 
  WHERE montant_droit_terre_mensuel IS NOT NULL AND montant_droit_terre_mensuel > 0;
  
  -- Count by subscription type
  SELECT COUNT(*) INTO historical_count 
  FROM public.souscriptions 
  WHERE type_souscription = 'historique' AND montant_droit_terre_mensuel > 0;
  
  SELECT COUNT(*) INTO mise_en_garde_count 
  FROM public.souscriptions 
  WHERE type_souscription = 'mise_en_garde' AND montant_droit_terre_mensuel > 0;
  
  RAISE NOTICE 'Migration completed successfully:';
  RAISE NOTICE '- Total subscriptions with land rights amount: %', total_updated;
  RAISE NOTICE '- Historical subscriptions: %', historical_count;
  RAISE NOTICE '- Mise en garde subscriptions: %', mise_en_garde_count;
END $$;