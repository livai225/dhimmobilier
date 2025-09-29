-- Direct update with explicit condition check
UPDATE souscriptions SET montant_droit_terre_mensuel = montant_mensuel WHERE id IN (
  SELECT id FROM souscriptions WHERE montant_droit_terre_mensuel IS NULL LIMIT 5
);

-- Check results
SELECT id, montant_mensuel, montant_droit_terre_mensuel 
FROM souscriptions 
WHERE montant_droit_terre_mensuel IS NOT NULL 
LIMIT 5;