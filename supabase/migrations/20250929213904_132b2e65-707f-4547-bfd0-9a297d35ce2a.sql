-- Mise à jour directe des montant_droit_terre_mensuel
UPDATE souscriptions
SET montant_droit_terre_mensuel = montant_mensuel,
    updated_at = now()
WHERE phase_actuelle = 'droit_terre'
  AND montant_droit_terre_mensuel IS NULL
  AND montant_mensuel IS NOT NULL
  AND montant_mensuel > 0;