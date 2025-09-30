-- Suppression des paiements groupés incorrects d'Ernest (2025-09-30)
-- Supprimer les paiements de locations avec periode_paiement = 2025-09-01 créés le 2025-09-30
DELETE FROM public.paiements_locations 
WHERE DATE(created_at) = '2025-09-30' 
  AND periode_paiement = '2025-09-01';

-- Supprimer les reçus générés pour ces paiements (type_operation = 'location' créés le 2025-09-30)
DELETE FROM public.recus 
WHERE type_operation = 'location' 
  AND DATE(date_generation) = '2025-09-30';

-- Supprimer les transactions de caisse de type paiement_loyer créées le 2025-09-30
-- MAIS GARDER le versement_agent d'Ernest
DELETE FROM public.cash_transactions 
WHERE DATE(date_transaction) = '2025-09-30' 
  AND type_operation = 'paiement_loyer';

-- Recalculer le solde de caisse en gardant uniquement le versement d'Ernest
-- Le versement d'Ernest était de 3,395,000 FCFA
UPDATE public.caisse_balance 
SET solde_courant = (
  SELECT COALESCE(SUM(
    CASE 
      WHEN type_transaction = 'entree' THEN montant 
      WHEN type_transaction = 'sortie' THEN -montant 
    END
  ), 0)
  FROM public.cash_transactions
  WHERE (type_transaction = 'entree' AND type_operation = 'versement_agent')
     OR (type_transaction = 'sortie' AND type_operation IN ('paiement_souscription', 'paiement_loyer', 'paiement_droit_terre', 'paiement_caution'))
),
derniere_maj = now(),
updated_at = now();

-- Recalculer les dettes des locations (trigger le calcul automatique)
UPDATE public.locations 
SET updated_at = now()
WHERE id IN (
  SELECT DISTINCT location_id 
  FROM public.paiements_locations 
  WHERE DATE(created_at) = '2025-09-30'
);