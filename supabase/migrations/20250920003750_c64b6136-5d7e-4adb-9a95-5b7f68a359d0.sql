-- Ajouter le barème des droits de terre par défaut
INSERT INTO public.bareme_droits_terre (type_bien, montant_mensuel, description) 
VALUES 
  ('terrain', 15000, 'Droit de terre mensuel pour terrain'),
  ('maison', 20000, 'Droit de terre mensuel pour maison'),
  ('appartement', 18000, 'Droit de terre mensuel pour appartement')
ON CONFLICT (type_bien) DO UPDATE SET 
  montant_mensuel = EXCLUDED.montant_mensuel,
  description = EXCLUDED.description,
  updated_at = now();

-- Mettre à jour toutes les souscriptions existantes avec des droits de terre configurés
UPDATE public.souscriptions 
SET 
  montant_droit_terre_mensuel = CASE 
    WHEN type_bien = 'terrain' THEN 15000
    WHEN type_bien = 'maison' THEN 20000  
    WHEN type_bien = 'appartement' THEN 18000
    ELSE 15000 -- par défaut terrain
  END,
  updated_at = now()
WHERE montant_droit_terre_mensuel IS NULL OR montant_droit_terre_mensuel = 0;