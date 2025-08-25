-- Fix the type_operation for invoice payments in pay_facture_with_cash function
CREATE OR REPLACE FUNCTION public.pay_facture_with_cash(p_facture_id uuid, p_montant numeric, p_date_paiement date, p_mode_paiement text DEFAULT NULL::text, p_reference text DEFAULT NULL::text, p_description text DEFAULT 'Paiement facture fournisseur'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction_id UUID;
  v_facture_record RECORD;
BEGIN
  SELECT f.*, fr.nom as fournisseur_nom, p.nom as propriete_nom
  INTO v_facture_record
  FROM public.factures_fournisseurs f
  JOIN public.fournisseurs fr ON f.fournisseur_id = fr.id
  LEFT JOIN public.proprietes p ON f.propriete_id = p.id
  WHERE f.id = p_facture_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Facture introuvable'; END IF;

  IF p_montant > (v_facture_record.montant_total - v_facture_record.montant_paye) THEN
    RAISE EXCEPTION 'Le montant dépasse le solde restant de la facture';
  END IF;

  v_transaction_id := public.record_cash_transaction(
    p_type_transaction := 'sortie',
    p_montant := p_montant,
    p_type_operation := 'depense_entreprise',
    p_agent_id := NULL,
    p_beneficiaire := v_facture_record.fournisseur_nom,
    p_reference_operation := p_facture_id,
    p_description := p_description || ' N°' || v_facture_record.numero || CASE WHEN v_facture_record.propriete_nom IS NOT NULL THEN ' - ' || v_facture_record.propriete_nom ELSE '' END,
    p_piece_justificative := p_reference
  );

  INSERT INTO public.paiements_factures (facture_id, montant, date_paiement, mode_paiement, reference)
  VALUES (p_facture_id, p_montant, p_date_paiement, p_mode_paiement, p_reference);

  RETURN v_transaction_id;
END;
$function$;