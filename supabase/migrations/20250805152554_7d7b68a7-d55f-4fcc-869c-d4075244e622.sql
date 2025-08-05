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
$function$

-- Create trigger on subscription payments
CREATE TRIGGER update_souscription_solde_after_payment
AFTER INSERT OR UPDATE OR DELETE ON public.paiements_souscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_souscription_solde();

-- Function to fix all existing subscription balances
CREATE OR REPLACE FUNCTION public.fix_souscription_balances()
RETURNS TABLE(souscription_id uuid, ancien_solde numeric, nouveau_solde numeric)
LANGUAGE plpgsql
AS $function$
DECLARE
  sub_record RECORD;
  total_paye DECIMAL;
  nouveau_solde DECIMAL;
BEGIN
  -- Loop through all subscriptions
  FOR sub_record IN 
    SELECT id, prix_total, solde_restant
    FROM public.souscriptions
  LOOP
    -- Calculate actual total paid
    SELECT COALESCE(SUM(montant), 0) INTO total_paye
    FROM public.paiements_souscriptions 
    WHERE paiements_souscriptions.souscription_id = sub_record.id;
    
    -- Calculate correct balance
    nouveau_solde := GREATEST(0, sub_record.prix_total - total_paye);
    
    -- Update if different
    IF nouveau_solde != sub_record.solde_restant THEN
      UPDATE public.souscriptions 
      SET solde_restant = nouveau_solde, updated_at = now()
      WHERE id = sub_record.id;
      
      -- Return the correction details
      souscription_id := sub_record.id;
      ancien_solde := sub_record.solde_restant;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$

-- Execute the balance correction for existing data
SELECT * FROM public.fix_souscription_balances();