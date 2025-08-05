-- Function to update subscription balance after payment
CREATE OR REPLACE FUNCTION public.update_souscription_solde()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  total_paye DECIMAL;
  prix_total DECIMAL;
BEGIN
  -- Get subscription total price
  SELECT prix_total INTO prix_total
  FROM public.souscriptions 
  WHERE id = NEW.souscription_id;
  
  -- Calculate total paid for this subscription
  SELECT COALESCE(SUM(montant), 0) INTO total_paye
  FROM public.paiements_souscriptions 
  WHERE souscription_id = NEW.souscription_id;
  
  -- Update subscription with new balance
  UPDATE public.souscriptions 
  SET 
    solde_restant = GREATEST(0, prix_total - total_paye),
    updated_at = now()
  WHERE id = NEW.souscription_id;
  
  RETURN NEW;
END;
$function$;