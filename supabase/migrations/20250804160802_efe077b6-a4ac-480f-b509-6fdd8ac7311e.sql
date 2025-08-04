-- Créer un client par défaut pour les paiements de factures avec un numéro de téléphone valide
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
  '+221000000000',
  'Paiements de factures automatiques'
) ON CONFLICT (id) DO NOTHING;