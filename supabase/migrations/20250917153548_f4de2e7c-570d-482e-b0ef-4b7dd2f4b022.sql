-- Correction des souscriptions de droit de terre pour génération automatique des reçus

-- Étape 1: Mettre à jour les souscriptions de type "mise_en_garde" importées récemment pour passer en phase droit de terre
UPDATE public.souscriptions 
SET 
  phase_actuelle = 'droit_terre',
  date_debut_droit_terre = date_debut, -- Utiliser la date de début comme début de droit de terre
  date_fin_finition = date_debut + INTERVAL '9 months' -- Période de finition de 9 mois par défaut
WHERE type_souscription = 'mise_en_garde'
  AND phase_actuelle = 'souscription' 
  AND montant_droit_terre_mensuel > 0
  AND created_at >= CURRENT_DATE - INTERVAL '1 day'; -- Seulement les imports récents

-- Étape 2: S'assurer que les barèmes de droit de terre existent
INSERT INTO public.bareme_droits_terre (type_bien, montant_mensuel, description)
VALUES 
  ('terrain', 25000, 'Droit de terre terrain standard'),
  ('parcelle', 25000, 'Droit de terre parcelle standard')
ON CONFLICT (type_bien) DO NOTHING;