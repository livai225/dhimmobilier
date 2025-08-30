-- Corriger pay_caution_with_cash pour traiter la caution comme une SORTIE de caisse
CREATE OR REPLACE FUNCTION public.pay_caution_with_cash(
  p_location_id uuid, 
  p_montant numeric, 
  p_date_paiement date, 
  p_mode_paiement text DEFAULT NULL::text, 
  p_reference text DEFAULT NULL::text, 
  p_description text DEFAULT 'Avance caution location'::text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction_id UUID;
  v_location_record RECORD;
  v_solde_actuel NUMERIC;
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
  
  -- Vérifier le solde disponible
  v_solde_actuel := public.get_current_cash_balance();
  IF v_solde_actuel < p_montant THEN
    RAISE EXCEPTION 'Solde insuffisant en caisse. Solde actuel: % FCFA, Montant requis: % FCFA', 
      v_solde_actuel, p_montant;
  END IF;
  
  -- Record cash transaction as SORTIE (avance de caution par l'agence)
  v_transaction_id := public.record_cash_transaction(
    p_type_transaction := 'sortie',
    p_montant := p_montant,
    p_type_operation := 'avance_caution',
    p_agent_id := NULL,
    p_beneficiaire := v_location_record.prenom || ' ' || v_location_record.nom,
    p_reference_operation := p_location_id,
    p_description := p_description || ' - ' || v_location_record.propriete_nom,
    p_piece_justificative := p_reference
  );
  
  RETURN v_transaction_id;
END;
$function$;