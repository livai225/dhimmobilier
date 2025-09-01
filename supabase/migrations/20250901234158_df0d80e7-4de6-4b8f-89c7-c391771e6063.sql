-- Modify pay_facture_with_cash to NOT affect cash balance (only record company expense)
CREATE OR REPLACE FUNCTION public.pay_facture_with_cash(p_facture_id uuid, p_montant numeric, p_date_paiement date, p_mode_paiement text DEFAULT NULL::text, p_reference text DEFAULT NULL::text, p_description text DEFAULT 'Paiement facture fournisseur'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_facture_record RECORD;
BEGIN
  SELECT f.*, fr.nom as fournisseur_nom, p.nom as propriete_nom
  INTO v_facture_record
  FROM public.factures_fournisseurs f
  JOIN public.fournisseurs fr ON f.fournisseur_id = fr.id
  LEFT JOIN public.proprietes p ON f.propriete_id = p.id
  WHERE f.id = p_facture_id;
  
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Facture introuvable'; 
  END IF;

  IF p_montant > (v_facture_record.montant_total - v_facture_record.montant_paye) THEN
    RAISE EXCEPTION 'Le montant dépasse le solde restant de la facture';
  END IF;

  -- Record invoice payment directly (no cash_transactions impact on cash balance)
  INSERT INTO public.paiements_factures (facture_id, montant, date_paiement, mode_paiement, reference)
  VALUES (p_facture_id, p_montant, p_date_paiement, p_mode_paiement, p_reference);

  -- Return the payment ID (simulating transaction ID for consistency)
  RETURN (SELECT id FROM public.paiements_factures WHERE facture_id = p_facture_id ORDER BY created_at DESC LIMIT 1);
END;
$function$;

-- Clean up erroneous cash_transactions entries for invoice payments
DELETE FROM public.cash_transactions 
WHERE type_operation = 'depense_entreprise' 
  AND reference_operation IN (
    SELECT id FROM public.factures_fournisseurs
  );

-- Recalculate cash balance to correct "Solde caisse versement"
WITH corrected_balance AS (
  SELECT 
    COALESCE(SUM(CASE WHEN type_transaction = 'entree' THEN montant ELSE -montant END), 0) as new_balance
  FROM public.cash_transactions
  WHERE type_operation != 'depense_entreprise' OR reference_operation IS NULL
)
UPDATE public.caisse_balance 
SET 
  solde_courant = (SELECT new_balance FROM corrected_balance),
  updated_at = now()
WHERE id = (SELECT id FROM public.caisse_balance ORDER BY updated_at DESC LIMIT 1);