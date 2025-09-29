-- Copier montant_mensuel vers montant_droit_terre_mensuel pour les souscriptions en phase droit_terre
-- sans montant de droit de terre configuré
UPDATE souscriptions
SET 
  montant_droit_terre_mensuel = montant_mensuel,
  updated_at = now()
WHERE phase_actuelle = 'droit_terre'
  AND (montant_droit_terre_mensuel IS NULL OR montant_droit_terre_mensuel <= 0);