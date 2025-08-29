-- Free up some properties that don't have active locations
UPDATE public.proprietes 
SET statut = 'Libre', updated_at = now()
WHERE id NOT IN (
  SELECT DISTINCT propriete_id 
  FROM public.locations 
  WHERE statut = 'active'
) 
AND usage = 'Location'
AND statut = 'Occupé';

-- Add some test properties with Libre status for immediate testing
INSERT INTO public.proprietes (nom, adresse, zone, usage, statut, loyer_mensuel, surface) VALUES
('STUDIO TEST - COCODY', 'Cocody, Abidjan', 'Cocody', 'Location', 'Libre', 150000, 25),
('2 PIECES TEST - MARCORY', 'Marcory, Abidjan', 'Marcory', 'Location', 'Libre', 200000, 45),
('VILLA TEST - YOPOUGON', 'Yopougon, Abidjan', 'Yopougon', 'Location', 'Libre', 350000, 120);