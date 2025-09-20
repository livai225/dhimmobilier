-- Mettre à jour les souscriptions historiques de droits de terre qui n'ont pas de montant_droit_terre_mensuel
-- En utilisant le prix_total divisé par 240 mois pour calculer le montant mensuel

UPDATE public.souscriptions 
SET montant_droit_terre_mensuel = prix_total / 240,
    montant_mensuel = prix_total / 240
WHERE type_souscription = 'historique' 
  AND phase_actuelle = 'droit_terre' 
  AND montant_droit_terre_mensuel IS NULL;