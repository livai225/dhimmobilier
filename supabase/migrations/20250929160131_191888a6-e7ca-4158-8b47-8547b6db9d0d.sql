-- First check the actual values 
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN montant_droit_terre_mensuel IS NULL THEN 1 END) as null_count,
  COUNT(CASE WHEN montant_droit_terre_mensuel = 0 THEN 1 END) as zero_count
FROM souscriptions;

-- Update all records where montant_droit_terre_mensuel is NULL
UPDATE souscriptions 
SET montant_droit_terre_mensuel = montant_mensuel
WHERE montant_droit_terre_mensuel IS NULL;

-- Verify the results
SELECT 
  COUNT(*) as total_souscriptions,
  COUNT(CASE WHEN montant_droit_terre_mensuel IS NOT NULL THEN 1 END) as populated_count,
  AVG(montant_droit_terre_mensuel) as avg_montant
FROM souscriptions;