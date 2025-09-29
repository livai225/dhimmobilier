-- Update montant_droit_terre_mensuel for all subscriptions
UPDATE souscriptions 
SET 
  montant_droit_terre_mensuel = montant_mensuel,
  updated_at = now()
WHERE montant_droit_terre_mensuel IS NULL OR montant_droit_terre_mensuel = 0;

-- Verify the update
SELECT 
  COUNT(*) as total_updated,
  AVG(montant_droit_terre_mensuel) as avg_amount,
  MIN(montant_droit_terre_mensuel) as min_amount,
  MAX(montant_droit_terre_mensuel) as max_amount
FROM souscriptions 
WHERE montant_droit_terre_mensuel IS NOT NULL AND montant_droit_terre_mensuel > 0;