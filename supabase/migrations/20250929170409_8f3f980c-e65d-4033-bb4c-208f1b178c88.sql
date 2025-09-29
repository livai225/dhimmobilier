-- Correction des dates de début des droits de terre pour permettre l'analyse des paiements manquants

-- Pour les souscriptions historiques, nous devons fixer des dates de début dans le passé
-- afin que l'analyse des paiements manquants puisse détecter les impayés

UPDATE public.souscriptions 
SET 
  date_debut_droit_terre = CASE 
    WHEN type_souscription = 'historique' THEN 
      -- Définir la date de début des droits de terre à janvier 2024 pour les souscriptions historiques
      -- Cela permettra d'avoir des mois de paiements dus depuis janvier 2024
      '2024-01-01'::date
    WHEN type_souscription = 'mise_en_garde' THEN 
      -- Pour mise en garde : date_debut + periode_finition_mois
      date_debut + (COALESCE(periode_finition_mois, 9) || ' months')::INTERVAL
    ELSE 
      -- Autres types : garder la logique actuelle ou fixer à janvier 2024
      '2024-01-01'::date
  END,
  -- Mettre à jour aussi la date de fin de finition pour les mise en garde
  date_fin_finition = CASE 
    WHEN type_souscription = 'mise_en_garde' THEN 
      date_debut + (COALESCE(periode_finition_mois, 9) || ' months')::INTERVAL
    ELSE 
      date_fin_finition
  END,
  -- S'assurer que la phase est correcte
  phase_actuelle = 'droit_terre',
  updated_at = now()
WHERE date_debut_droit_terre IS NOT NULL;

-- Vérification des résultats après correction
SELECT 
  type_souscription,
  COUNT(*) as nombre,
  MIN(date_debut_droit_terre) as min_debut_droit_terre,
  MAX(date_debut_droit_terre) as max_debut_droit_terre,
  COUNT(CASE WHEN date_debut_droit_terre <= CURRENT_DATE THEN 1 END) as eligible_maintenant
FROM souscriptions 
GROUP BY type_souscription;