-- Add RPC function for caution payments with cash
CREATE OR REPLACE FUNCTION public.pay_caution_with_cash(
  p_location_id UUID,
  p_montant NUMERIC,
  p_date_paiement DATE,
  p_mode_paiement TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Paiement caution'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
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
  
  -- Record cash transaction (outflow)
  v_transaction_id := public.record_cash_transaction(
    p_type_transaction := 'sortie',
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
$$;