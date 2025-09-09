-- Fix the cash_transactions constraint to allow 'vente' operations
ALTER TABLE public.cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_type_operation_check;

-- Add the updated constraint that includes 'vente'
ALTER TABLE public.cash_transactions 
ADD CONSTRAINT cash_transactions_type_operation_check 
CHECK (type_operation IN (
  'versement_agent',
  'paiement_souscription', 
  'paiement_loyer', 
  'paiement_droit_terre', 
  'paiement_caution',
  'depense_entreprise',
  'autre',
  'vente'
));