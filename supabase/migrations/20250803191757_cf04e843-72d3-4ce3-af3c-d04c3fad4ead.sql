-- Ajouter les nouveaux types de propriétés manquants
INSERT INTO public.types_proprietes (nom, description) VALUES
('Maison', 'Maison individuelle'),
('Appartement', 'Logement dans un immeuble'),
('Magasin', 'Local commercial pour vente au détail')
ON CONFLICT (nom) DO NOTHING;