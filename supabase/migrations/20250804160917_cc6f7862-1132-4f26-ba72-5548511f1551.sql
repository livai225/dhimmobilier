-- Générer le reçu manquant pour le paiement de facture
INSERT INTO public.recus (
  numero,
  client_id,
  reference_id,
  type_operation,
  montant_total,
  date_generation
) VALUES (
  'REC-FACT-250803-001',
  '00000000-0000-0000-0000-000000000000',
  '9d194f83-fc4b-4304-a724-af82aef7cf29',
  'paiement_facture',
  1500000,
  '2025-08-03'
);