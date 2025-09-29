-- Solution complète : désactiver trigger, UPDATE, réactiver trigger

-- 1. Désactiver temporairement le trigger
DROP TRIGGER IF EXISTS calculate_souscription_dates_trigger ON public.souscriptions;

-- 2. Exécuter l'UPDATE pour copier montant_mensuel vers montant_droit_terre_mensuel
UPDATE public.souscriptions 
SET montant_droit_terre_mensuel = montant_mensuel
WHERE montant_mensuel IS NOT NULL AND montant_mensuel > 0;

-- 3. Réactiver le trigger
CREATE TRIGGER calculate_souscription_dates_trigger
  BEFORE INSERT OR UPDATE ON public.souscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_souscription_dates();

-- 4. Peupler la table bareme_droits_terre avec des valeurs par défaut
INSERT INTO public.bareme_droits_terre (type_bien, montant_mensuel, description)
VALUES 
  ('terrain', 15000, 'Montant mensuel pour terrain'),
  ('maison', 20000, 'Montant mensuel pour maison'),
  ('appartement', 12000, 'Montant mensuel pour appartement'),
  ('commerce', 25000, 'Montant mensuel pour commerce')
ON CONFLICT DO NOTHING;

-- 5. Vérifier les résultats
SELECT 
  COUNT(*) as total_souscriptions,
  COUNT(CASE WHEN montant_droit_terre_mensuel > 0 THEN 1 END) as avec_montant_droit_terre,
  AVG(montant_droit_terre_mensuel) as montant_moyen
FROM public.souscriptions;