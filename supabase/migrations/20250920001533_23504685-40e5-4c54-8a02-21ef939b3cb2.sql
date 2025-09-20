-- Supprimer les souscriptions historiques de droits de terre récemment importées
-- (créées aujourd'hui)
DELETE FROM public.souscriptions 
WHERE type_souscription = 'historique' 
  AND phase_actuelle = 'droit_terre' 
  AND DATE(created_at) = CURRENT_DATE;