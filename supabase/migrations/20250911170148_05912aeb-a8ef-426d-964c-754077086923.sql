-- Function to recalculate debts for all locations
CREATE OR REPLACE FUNCTION public.recalculate_all_location_debts()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Update all locations to trigger the calculate_location_dette function
  -- This will recalculate dette_totale for all contracts using the new logic
  UPDATE public.locations 
  SET updated_at = now();
  
  RAISE NOTICE 'Recalculated debts for all locations using new contract type logic';
END;
$function$;

-- Execute the function to recalculate all existing debts
SELECT public.recalculate_all_location_debts();