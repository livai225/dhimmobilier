-- Fix payment logic: all payments reduce cash but are categorized differently
-- Location, souscription, droit terre payments: cash outflow but recorded as revenue
-- Invoice payments: cash outflow recorded as expense

CREATE OR REPLACE FUNCTION public.pay_location_with_cash(
  p_location_id UUID,
  p_montant NUMERIC,
  p_date_paiement DATE,
  p_mode_paiement TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Paiement loyer'
) RETURNS UUID
LANGUAGE plpgsql
SET search_path TO public
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

  -- Record cash transaction (outflow but revenue)
  v_transaction_id := public.record_cash_transaction(
    p_type_transaction := 'sortie',
    p_montant := p_montant,
    p_type_operation := 'paiement_loyer',
    p_agent_id := NULL,
    p_beneficiaire := v_location_record.prenom || ' ' || v_location_record.nom,
    p_reference_operation := p_location_id,
    p_description := p_description || ' - ' || v_location_record.propriete_nom,
    p_piece_justificative := p_reference
  );

  -- Record location payment
  INSERT INTO public.paiements_locations (location_id, montant, date_paiement, mode_paiement, reference)
  VALUES (p_location_id, p_montant, p_date_paiement, p_mode_paiement, p_reference);

  RETURN v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_souscription_with_cash(
  p_souscription_id UUID,
  p_montant NUMERIC,
  p_date_paiement DATE,
  p_mode_paiement TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Paiement souscription'
) RETURNS UUID
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_transaction_id UUID;
  v_souscription_record RECORD;
BEGIN
  -- Get subscription details
  SELECT s.*, c.nom, c.prenom, p.nom as propriete_nom
  INTO v_souscription_record
  FROM public.souscriptions s
  JOIN public.clients c ON s.client_id = c.id
  JOIN public.proprietes p ON s.propriete_id = p.id
  WHERE s.id = p_souscription_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Souscription introuvable'; 
  END IF;

  -- Record cash transaction (outflow but revenue)
  v_transaction_id := public.record_cash_transaction(
    p_type_transaction := 'sortie',
    p_montant := p_montant,
    p_type_operation := 'paiement_souscription',
    p_agent_id := NULL,
    p_beneficiaire := v_souscription_record.prenom || ' ' || v_souscription_record.nom,
    p_reference_operation := p_souscription_id,
    p_description := p_description || ' - ' || v_souscription_record.propriete_nom,
    p_piece_justificative := p_reference
  );

  -- Record subscription payment
  INSERT INTO public.paiements_souscriptions (souscription_id, montant, date_paiement, mode_paiement, reference)
  VALUES (p_souscription_id, p_montant, p_date_paiement, p_mode_paiement, p_reference);

  RETURN v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_droit_terre_with_cash(
  p_souscription_id UUID,
  p_montant NUMERIC,
  p_date_paiement DATE,
  p_mode_paiement TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Paiement droit de terre'
) RETURNS UUID
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_transaction_id UUID;
  v_souscription_record RECORD;
BEGIN
  -- Get subscription details
  SELECT s.*, c.nom, c.prenom, p.nom as propriete_nom
  INTO v_souscription_record
  FROM public.souscriptions s
  JOIN public.clients c ON s.client_id = c.id
  JOIN public.proprietes p ON s.propriete_id = p.id
  WHERE s.id = p_souscription_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Souscription introuvable'; 
  END IF;

  -- Record cash transaction (outflow but revenue)
  v_transaction_id := public.record_cash_transaction(
    p_type_transaction := 'sortie',
    p_montant := p_montant,
    p_type_operation := 'paiement_droit_terre',
    p_agent_id := NULL,
    p_beneficiaire := v_souscription_record.prenom || ' ' || v_souscription_record.nom,
    p_reference_operation := p_souscription_id,
    p_description := p_description || ' - ' || v_souscription_record.propriete_nom,
    p_piece_justificative := p_reference
  );

  -- Record land rights payment
  INSERT INTO public.paiements_droit_terre (souscription_id, montant, date_paiement, mode_paiement, reference)
  VALUES (p_souscription_id, p_montant, p_date_paiement, p_mode_paiement, p_reference);

  RETURN v_transaction_id;
END;
$$;