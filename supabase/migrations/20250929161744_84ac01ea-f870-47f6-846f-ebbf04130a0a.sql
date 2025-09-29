-- Mass update for ALL subscriptions
UPDATE souscriptions 
SET montant_droit_terre_mensuel = montant_mensuel;

-- Verify results immediately  
SELECT 
  COUNT(*) as total_updated,
  COUNT(CASE WHEN montant_droit_terre_mensuel > 0 THEN 1 END) as with_amount,
  AVG(montant_droit_terre_mensuel) as avg_amount
FROM souscriptions;