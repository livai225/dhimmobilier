-- Adjust record_cash_transaction so company expenses do NOT decrease cash balance
CREATE OR REPLACE FUNCTION public.record_cash_transaction(
  p_type_transaction TEXT,
  p_montant NUMERIC,
  p_type_operation TEXT,
  p_agent_id UUID DEFAULT NULL,
  p_beneficiaire TEXT DEFAULT NULL,
  p_reference_operation UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_piece_justificative TEXT DEFAULT NULL
)
RETURNS UUID
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

  -- Only cash entries should impact "solde caisse versement"
  -- Company expenses (sorties) must NOT decrease the cash balance
  v_impacts_cash := (p_type_transaction = 'entree');

  IF v_impacts_cash THEN
    -- Entries increase physical cash
    v_solde_apres := v_solde_avant + p_montant;
  ELSE
    -- For sorties (company expenses), do NOT change cash balance and do NOT block on funds
    v_solde_apres := v_solde_avant;
  END IF;

  -- Insert the transaction record (keep a snapshot of balance before/after)
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

-- Recalculate cash balance to remove previous deductions from expenses
WITH recalculated AS (
  SELECT COALESCE(SUM(CASE WHEN type_transaction = 'entree' THEN montant ELSE 0 END), 0) AS new_balance
  FROM public.cash_transactions
)
UPDATE public.caisse_balance cb
SET solde_courant = r.new_balance,
    derniere_maj = now(),
    updated_at = now()
FROM recalculated r
WHERE cb.id = (SELECT id FROM public.caisse_balance ORDER BY updated_at DESC LIMIT 1);
