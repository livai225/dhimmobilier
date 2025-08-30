-- Add 'avance_caution' to allowed type_operation values
ALTER TABLE public.cash_transactions 
DROP CONSTRAINT cash_transactions_type_operation_check;

ALTER TABLE public.cash_transactions 
ADD CONSTRAINT cash_transactions_type_operation_check 
CHECK (type_operation = ANY (ARRAY[
  'versement_agent'::text, 
  'paiement_loyer'::text, 
  'paiement_droit_terre'::text, 
  'paiement_souscription'::text, 
  'depense_entreprise'::text, 
  'avance_caution'::text,
  'autre'::text
]));