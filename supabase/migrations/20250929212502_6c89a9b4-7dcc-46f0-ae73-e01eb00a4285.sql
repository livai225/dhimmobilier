-- Copier montant_mensuel vers montant_droit_terre_mensuel pour les souscriptions en phase droit_terre
-- sans montant de droit de terre configuré
UPDATE souscriptions
SET montant_droit_terre_mensuel = montant_mensuel
WHERE phase_actuelle = 'droit_terre'
  AND montant_droit_terre_mensuel IS NULL
  AND montant_mensuel IS NOT NULL
  AND montant_mensuel > 0;