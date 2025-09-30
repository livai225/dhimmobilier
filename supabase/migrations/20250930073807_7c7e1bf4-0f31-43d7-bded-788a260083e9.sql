-- Nettoyer les paiements en double existants avant d'ajouter les contraintes

-- 1. Supprimer les doublons de paiements_souscriptions en gardant le plus ancien
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY souscription_id, periode_paiement ORDER BY created_at ASC) as rn
  FROM public.paiements_souscriptions
  WHERE periode_paiement IS NOT NULL
)
DELETE FROM public.paiements_souscriptions
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 2. Supprimer les doublons de paiements_droit_terre en gardant le plus ancien
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY souscription_id, periode_paiement ORDER BY created_at ASC) as rn
  FROM public.paiements_droit_terre
  WHERE periode_paiement IS NOT NULL
)
DELETE FROM public.paiements_droit_terre
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 3. Supprimer les doublons de paiements_locations en gardant le plus ancien
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY location_id, periode_paiement ORDER BY created_at ASC) as rn
  FROM public.paiements_locations
  WHERE periode_paiement IS NOT NULL
)
DELETE FROM public.paiements_locations
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 4. Ajouter les contraintes uniques maintenant que les doublons sont nettoyés
CREATE UNIQUE INDEX IF NOT EXISTS unique_paiement_location_periode 
ON public.paiements_locations(location_id, periode_paiement)
WHERE periode_paiement IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_paiement_droit_terre_periode 
ON public.paiements_droit_terre(souscription_id, periode_paiement)
WHERE periode_paiement IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_paiement_souscription_periode 
ON public.paiements_souscriptions(souscription_id, periode_paiement)
WHERE periode_paiement IS NOT NULL;

COMMENT ON INDEX unique_paiement_location_periode IS 'Empêche les paiements en double pour la même location dans la même période';
COMMENT ON INDEX unique_paiement_droit_terre_periode IS 'Empêche les paiements en double pour le même droit de terre dans la même période';
COMMENT ON INDEX unique_paiement_souscription_periode IS 'Empêche les paiements en double pour la même souscription dans la même période';