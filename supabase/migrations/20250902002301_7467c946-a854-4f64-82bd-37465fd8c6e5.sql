-- Fix cash flow logic: client payments should be "sortie" from physical cash
-- Agent deposits should be "entree" to physical cash
-- Company expenses should not affect physical cash

-- 1. Update record_cash_transaction function with corrected logic
CREATE OR REPLACE FUNCTION public.record_cash_transaction(
  p_type_transaction text, 
  p_montant numeric, 
  p_type_operation text, 
  p_agent_id uuid DEFAULT NULL::uuid, 
  p_beneficiaire text DEFAULT NULL::text, 
  p_reference_operation uuid DEFAULT NULL::uuid, 
  p_description text DEFAULT NULL::text, 
  p_piece_justificative text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction_id UUID;
  v_solde_avant NUMERIC;
  v_solde_apres NUMERIC;
  v_impacts_cash BOOLEAN;
BEGIN
  -- Current balance snapshot
  v_solde_avant := public.get_current_cash_balance();

  -- Physical cash (caisse versement) is impacted by:
  --   - Agent deposits (entree): cash coming into the physical box
  --   - Client payments (sortie): cash taken from the physical box for company
  --   - Caution payouts (sortie): cash going out to advance a caution
  -- Physical cash is NOT impacted by company expenses (they use company balance)
  v_impacts_cash := (
    p_type_transaction = 'entree' AND p_type_operation = 'versement_agent'
  ) OR (
    p_type_transaction = 'sortie' AND p_type_operation IN (
      'paiement_souscription', 
      'paiement_loyer', 
      'paiement_droit_terre', 
      'paiement_caution'
    )
  );

  -- Calculate new balance only if it impacts physical cash
  IF v_impacts_cash THEN
    IF p_type_transaction = 'entree' THEN
      v_solde_apres := v_solde_avant + p_montant;
    ELSE -- sortie
      v_solde_apres := v_solde_avant - p_montant;
    END IF;
  ELSE
    -- Non-cash impacting operations keep the same balance
    v_solde_apres := v_solde_avant;
  END IF;

  -- Insert the transaction record with balance snapshot
  INSERT INTO public.cash_transactions (
    type_transaction,
    montant,
    type_operation,
    agent_id,
    beneficiaire,
    reference_operation,
    description,
    piece_justificative,
    solde_avant,
    solde_apres
  ) VALUES (
    p_type_transaction,
    p_montant,
    p_type_operation,
    p_agent_id,
    p_beneficiaire,
    p_reference_operation,
    p_description,
    p_piece_justificative,
    v_solde_avant,
    v_solde_apres
  ) RETURNING id INTO v_transaction_id;

  -- Update the cash balance ONLY when the operation impacts physical cash
  IF v_impacts_cash THEN
    UPDATE public.caisse_balance 
    SET solde_courant = v_solde_apres,
        derniere_maj = now(),
        updated_at = now()
    WHERE id = (SELECT id FROM public.caisse_balance ORDER BY updated_at DESC LIMIT 1);
  END IF;

  RETURN v_transaction_id;
END;
$function$;

-- 2. Update payment functions to record client payments as "sortie"
CREATE OR REPLACE FUNCTION public.pay_souscription_with_cash(
  p_souscription_id uuid, 
  p_montant numeric, 
  p_date_paiement date, 
  p_mode_paiement text DEFAULT NULL::text, 
  p_reference text DEFAULT NULL::text, 
  p_description text DEFAULT 'Paiement souscription'::text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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

  -- Record cash transaction as SORTIE (cash taken from physical box for company)
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
$function$;

CREATE OR REPLACE FUNCTION public.pay_location_with_cash(
  p_location_id uuid, 
  p_montant numeric, 
  p_date_paiement date, 
  p_mode_paiement text DEFAULT NULL::text, 
  p_reference text DEFAULT NULL::text, 
  p_description text DEFAULT 'Paiement loyer'::text
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

  -- Record cash transaction as SORTIE (cash taken from physical box for company)
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
$function$;

CREATE OR REPLACE FUNCTION public.pay_droit_terre_with_cash(
  p_souscription_id uuid, 
  p_montant numeric, 
  p_date_paiement date, 
  p_mode_paiement text DEFAULT NULL::text, 
  p_reference text DEFAULT NULL::text, 
  p_description text DEFAULT 'Paiement droit de terre'::text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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

  -- Record cash transaction as SORTIE (cash taken from physical box for company)
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
$function$;

-- 3. Update company balance function - agent deposits should NOT count as revenue
CREATE OR REPLACE FUNCTION public.get_solde_caisse_entreprise()
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  total_revenus NUMERIC := 0;
  total_depenses NUMERIC := 0;
  solde_entreprise NUMERIC := 0;
BEGIN
  -- Calculate total revenues from CLIENT PAYMENTS ONLY (not agent deposits)
  -- Locations
  SELECT COALESCE(SUM(montant), 0) INTO total_revenus
  FROM public.paiements_locations;
  
  -- Souscriptions
  total_revenus := total_revenus + COALESCE((
    SELECT SUM(montant) FROM public.paiements_souscriptions
  ), 0);
  
  -- Droit de terre
  total_revenus := total_revenus + COALESCE((
    SELECT SUM(montant) FROM public.paiements_droit_terre
  ), 0);

  -- Company expenses
  -- Supplier invoices (amounts paid)
  SELECT COALESCE(SUM(montant_paye), 0) INTO total_depenses
  FROM public.factures_fournisseurs;
  
  -- Other company expenses from cash transactions (exclude agent deposits and client payment transfers)
  total_depenses := total_depenses + COALESCE((
    SELECT SUM(montant) 
    FROM public.cash_transactions 
    WHERE type_operation = 'depense_entreprise'
      AND reference_operation IS NULL
  ), 0);
  
  -- Calculate company net balance (revenue - expenses)
  solde_entreprise := total_revenus - total_depenses;
  
  RETURN solde_entreprise;
END;
$function$;

-- 4. Fix historical data - correct existing transactions
-- First, identify and fix incorrectly classified transactions
UPDATE public.cash_transactions 
SET type_transaction = 'sortie'
WHERE type_operation IN ('paiement_souscription', 'paiement_loyer', 'paiement_droit_terre')
  AND type_transaction = 'entree';

-- 5. Recalculate all cash balances from scratch
-- Create a function to recalculate balances
CREATE OR REPLACE FUNCTION public.recalculate_cash_balances()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  transaction_record RECORD;
  running_balance NUMERIC := 0;
BEGIN
  -- Start with 0 balance
  running_balance := 0;
  
  -- Process all transactions in chronological order
  FOR transaction_record IN 
    SELECT id, type_transaction, montant, type_operation
    FROM public.cash_transactions 
    ORDER BY created_at ASC
  LOOP
    -- Update solde_avant
    UPDATE public.cash_transactions 
    SET solde_avant = running_balance
    WHERE id = transaction_record.id;
    
    -- Calculate new balance only for cash-impacting operations
    IF (transaction_record.type_transaction = 'entree' AND transaction_record.type_operation = 'versement_agent') OR
       (transaction_record.type_transaction = 'sortie' AND transaction_record.type_operation IN (
         'paiement_souscription', 'paiement_loyer', 'paiement_droit_terre', 'paiement_caution'
       )) THEN
      
      IF transaction_record.type_transaction = 'entree' THEN
        running_balance := running_balance + transaction_record.montant;
      ELSE -- sortie
        running_balance := running_balance - transaction_record.montant;
      END IF;
    END IF;
    
    -- Update solde_apres
    UPDATE public.cash_transactions 
    SET solde_apres = running_balance
    WHERE id = transaction_record.id;
  END LOOP;
  
  -- Update the current cash balance
  UPDATE public.caisse_balance 
  SET solde_courant = running_balance,
      derniere_maj = now(),
      updated_at = now()
  WHERE id = (SELECT id FROM public.caisse_balance ORDER BY updated_at DESC LIMIT 1);
  
  -- If no balance record exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.caisse_balance (solde_courant, derniere_maj)
    VALUES (running_balance, now());
  END IF;
END;
$function$;

-- Execute the balance recalculation
SELECT public.recalculate_cash_balances();