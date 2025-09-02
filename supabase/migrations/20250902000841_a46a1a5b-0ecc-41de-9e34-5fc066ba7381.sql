-- Fix cash flow classification and balances per plan
BEGIN;

-- 1) Update record_cash_transaction to impact physical cash only for entries and caution payouts
CREATE OR REPLACE FUNCTION public.record_cash_transaction(
  p_type_transaction text,
  p_montant numeric,
  p_type_operation text,
  p_agent_id uuid DEFAULT NULL::uuid,
  p_beneficiaire text DEFAULT NULL::text,
  p_reference_operation uuid DEFAULT NULL::uuid,
  p_description text DEFAULT NULL::text,
  p_piece_justificative text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_transaction_id UUID;
  v_solde_avant NUMERIC;
  v_solde_apres NUMERIC;
  v_impacts_cash BOOLEAN;
BEGIN
  -- Current balance snapshot
  v_solde_avant := public.get_current_cash_balance();

  -- Physical cash is impacted only by:
  --   - Entries (cash coming in)
  --   - Caution payouts (cash going out to advance a caution)
  v_impacts_cash := (
    p_type_transaction = 'entree'
  ) OR (
    p_type_transaction = 'sortie' AND p_type_operation IN ('paiement_caution')
  );

  IF p_type_transaction = 'entree' THEN
    v_solde_apres := v_solde_avant + p_montant;
  ELSIF p_type_transaction = 'sortie' AND p_type_operation IN ('paiement_caution') THEN
    v_solde_apres := v_solde_avant - p_montant;
  ELSE
    -- Company expenses or non-cash impacting sorties do not change physical cash
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

  -- Update the cash balance ONLY when the operation impacts cash
  IF v_impacts_cash THEN
    UPDATE public.caisse_balance 
    SET solde_courant = v_solde_apres,
        derniere_maj = now(),
        updated_at = now()
    WHERE id = (SELECT id FROM public.caisse_balance ORDER BY updated_at DESC LIMIT 1);
  END IF;

  RETURN v_transaction_id;
END;
$$;

-- 2) Payments from clients are cash entries (not sorties)
CREATE OR REPLACE FUNCTION public.pay_souscription_with_cash(
  p_souscription_id uuid,
  p_montant numeric,
  p_date_paiement date,
  p_mode_paiement text DEFAULT NULL::text,
  p_reference text DEFAULT NULL::text,
  p_description text DEFAULT 'Paiement souscription'::text
) RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
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

  -- Record cash transaction as ENTREE (incoming cash)
  v_transaction_id := public.record_cash_transaction(
    p_type_transaction := 'entree',
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
  p_souscription_id uuid,
  p_montant numeric,
  p_date_paiement date,
  p_mode_paiement text DEFAULT NULL::text,
  p_reference text DEFAULT NULL::text,
  p_description text DEFAULT 'Paiement droit de terre'::text
) RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
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

  -- Record cash transaction as ENTREE (incoming cash)
  v_transaction_id := public.record_cash_transaction(
    p_type_transaction := 'entree',
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

CREATE OR REPLACE FUNCTION public.pay_location_with_cash(
  p_location_id uuid,
  p_montant numeric,
  p_date_paiement date,
  p_mode_paiement text DEFAULT NULL::text,
  p_reference text DEFAULT NULL::text,
  p_description text DEFAULT 'Paiement loyer'::text
) RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
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

  -- Record cash transaction as ENTREE (incoming cash)
  v_transaction_id := public.record_cash_transaction(
    p_type_transaction := 'entree',
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

-- 3) Fix company balance computation (remove caution from revenues)
CREATE OR REPLACE FUNCTION public.get_solde_caisse_entreprise()
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_revenus NUMERIC := 0;
  total_depenses NUMERIC := 0;
  solde_entreprise NUMERIC := 0;
BEGIN
  -- Calculate total revenues from all sources (excluding caution payouts)
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
  
  -- Other company expenses from cash transactions (exclude invoice-linked outflows to avoid double count)
  total_depenses := total_depenses + COALESCE((
    SELECT SUM(montant) 
    FROM public.cash_transactions 
    WHERE type_operation = 'depense_entreprise'
      AND reference_operation IS NULL
  ), 0);
  
  -- Calculate company cash balance
  solde_entreprise := total_revenus - total_depenses;
  
  RETURN solde_entreprise;
END;
$$;

-- 4) Repair historical data classifications and recompute running balances
-- 4.1 Normalize transactions for client payments to be entries
UPDATE public.cash_transactions
SET type_transaction = 'entree'
WHERE type_operation IN ('paiement_souscription','paiement_loyer','paiement_droit_terre')
  AND type_transaction <> 'entree';

-- 4.2 Recompute solde_avant / solde_apres based on physical cash impacts
WITH ordered AS (
  SELECT
    id,
    created_at,
    montant::numeric,
    type_transaction,
    type_operation,
    CASE 
      WHEN type_transaction = 'entree' THEN montant
      WHEN type_transaction = 'sortie' AND type_operation = 'paiement_caution' THEN -montant
      ELSE 0
    END AS delta
  FROM public.cash_transactions
),
running AS (
  SELECT
    id,
    delta,
    SUM(delta) OVER (ORDER BY created_at, id) AS cumulative
  FROM ordered
)
UPDATE public.cash_transactions ct
SET 
  solde_avant = (r.cumulative - r.delta),
  solde_apres = r.cumulative
FROM running r
WHERE ct.id = r.id;

-- 4.3 Update latest caisse balance snapshot
WITH final_balance AS (
  SELECT COALESCE(SUM(
    CASE 
      WHEN type_transaction = 'entree' THEN montant
      WHEN type_transaction = 'sortie' AND type_operation = 'paiement_caution' THEN -montant
      ELSE 0
    END
  ), 0) AS balance
  FROM public.cash_transactions
)
UPDATE public.caisse_balance cb
SET solde_courant = fb.balance,
    derniere_maj = now(),
    updated_at = now()
FROM final_balance fb
WHERE cb.id = (SELECT id FROM public.caisse_balance ORDER BY updated_at DESC LIMIT 1);

COMMIT;