-- Allow 'paiement_caution' in type_operation and switch caution RPC to record as ENTREE
ALTER TABLE public.cash_transactions 
DROP CONSTRAINT IF EXISTS cash_transactions_type_operation_check;

ALTER TABLE public.cash_transactions 
ADD CONSTRAINT cash_transactions_type_operation_check 
CHECK (type_operation = ANY (ARRAY[
  'versement_agent'::text, 
  'paiement_loyer'::text, 
  'paiement_droit_terre'::text, 
  'paiement_souscription'::text, 
  'depense_entreprise'::text, 
  'avance_caution'::text,
  'paiement_caution'::text,
  'autre'::text
]));

-- Update pay_caution_with_cash to record an ENTREE with type_operation 'paiement_caution'
CREATE OR REPLACE FUNCTION public.pay_caution_with_cash(
  p_location_id uuid, 
  p_montant numeric, 
  p_date_paiement date, 
  p_mode_paiement text DEFAULT NULL::text, 
  p_reference text DEFAULT NULL::text, 
  p_description text DEFAULT 'Encaissement caution location'::text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction_id UUID;
  v_location_record RECORD;
BEGIN
  -- Get location details
  SELECT l.*, c.nom, c.prenom, p.nom as propriete_nom
  INTO v_location_record
  FROM public.locations l
  JOIN public.clients c ON l.client_id = c.id
  JOIN public.proprietes p ON l.propriete_id = p.id
  WHERE l.id = p_location_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Location introuvable';
  END IF;
  
  -- Record cash transaction as ENTREE (encaissement de la caution par l'agence)
  v_transaction_id := public.record_cash_transaction(
    p_type_transaction := 'entree',
    p_montant := p_montant,
    p_type_operation := 'paiement_caution',
    p_agent_id := NULL,
    p_beneficiaire := v_location_record.prenom || ' ' || v_location_record.nom,
    p_reference_operation := p_location_id,
    p_description := p_description || ' - ' || v_location_record.propriete_nom,
    p_piece_justificative := p_reference
  );
  
  RETURN v_transaction_id;
END;
$function$;