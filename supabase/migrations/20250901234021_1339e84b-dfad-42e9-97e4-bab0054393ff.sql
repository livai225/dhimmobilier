-- Fix double counting in company cash balance: exclude invoice-linked cash outflows
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
  -- Calculate total revenues from all sources
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
  
  -- Cautions (from cash transactions)
  total_revenus := total_revenus + COALESCE((
    SELECT SUM(montant) 
    FROM public.cash_transactions 
    WHERE type_operation = 'paiement_caution'
  ), 0);
  
  -- Calculate total company expenses
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
$function$;