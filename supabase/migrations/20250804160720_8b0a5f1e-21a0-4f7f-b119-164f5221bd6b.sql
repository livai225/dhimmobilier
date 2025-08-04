-- Créer un client par défaut pour les paiements de factures
INSERT INTO public.clients (
  id,
  nom,
  prenom,
  email,
  telephone_principal,
  adresse
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Système',
  'Paiements Factures',
  'factures@systeme.local',
  'N/A',
  'Paiements de factures automatiques'
) ON CONFLICT (id) DO NOTHING;