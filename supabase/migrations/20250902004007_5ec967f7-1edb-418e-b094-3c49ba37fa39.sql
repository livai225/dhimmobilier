-- Update get_solde_caisse_entreprise to include caution payments as company revenue
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
  -- Calculate total revenues from CLIENT PAYMENTS AND CAUTION ADVANCES
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
  
  -- Caution payments recorded in cash transactions
  total_revenus := total_revenus + COALESCE((
    SELECT SUM(montant)
    FROM public.cash_transactions
    WHERE type_operation = 'paiement_caution'
  ), 0);

  -- Company expenses
  -- Supplier invoices (amounts paid)
  SELECT COALESCE(SUM(montant_paye), 0) INTO total_depenses
  FROM public.factures_fournisseurs;
  
  -- Include ALL company expenses recorded in cash_transactions as 'depense_entreprise'
  total_depenses := total_depenses + COALESCE((
    SELECT SUM(montant) 
    FROM public.cash_transactions 
    WHERE type_operation = 'depense_entreprise'
  ), 0);
  
  -- Calculate company net balance (revenue - expenses)
  solde_entreprise := total_revenus - total_depenses;
  
  RETURN solde_entreprise;
END;
$function$;