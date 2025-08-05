-- Create a function to validate payment amounts
CREATE OR REPLACE FUNCTION public.validate_payment_amount()
RETURNS TRIGGER AS $$
DECLARE
  total_paye_existant DECIMAL;
  montant_total_facture DECIMAL;
  nouveau_total_paye DECIMAL;
BEGIN
  -- Get the total amount of the invoice
  SELECT montant_total INTO montant_total_facture
  FROM public.factures_fournisseurs 
  WHERE id = NEW.facture_id;
  
  -- Calculate existing payments for this invoice
  SELECT COALESCE(SUM(montant), 0) INTO total_paye_existant
  FROM public.paiements_factures 
  WHERE facture_id = NEW.facture_id;
  
  -- Calculate new total with the new payment
  nouveau_total_paye := total_paye_existant + NEW.montant;
  
  -- Check if new total exceeds invoice amount
  IF nouveau_total_paye > montant_total_facture THEN
    RAISE EXCEPTION 'Le montant du paiement (%) dépasse le solde restant de la facture. Montant total: %, Déjà payé: %, Solde restant: %',
      NEW.montant,
      montant_total_facture,
      total_paye_existant,
      (montant_total_facture - total_paye_existant);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate payments before insertion
CREATE TRIGGER validate_payment_before_insert
  BEFORE INSERT ON public.paiements_factures
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_amount();

-- Create a function to fix existing negative balances
CREATE OR REPLACE FUNCTION public.fix_negative_balances()
RETURNS TABLE(facture_id uuid, ancien_solde numeric, nouveau_solde numeric) AS $$
DECLARE
  facture_record RECORD;
  total_paye DECIMAL;
  excedent DECIMAL;
  paiement_record RECORD;
BEGIN
  -- Find all invoices with negative balances
  FOR facture_record IN 
    SELECT id, numero, montant_total, solde
    FROM public.factures_fournisseurs
    WHERE solde < 0
  LOOP
    -- Calculate actual total paid
    SELECT COALESCE(SUM(montant), 0) INTO total_paye
    FROM public.paiements_factures 
    WHERE paiements_factures.facture_id = facture_record.id;
    
    -- If overpaid, remove excess payments (starting with the most recent)
    IF total_paye > facture_record.montant_total THEN
      excedent := total_paye - facture_record.montant_total;
      
      -- Delete or reduce payments to fix the excess
      FOR paiement_record IN 
        SELECT id, montant 
        FROM public.paiements_factures 
        WHERE paiements_factures.facture_id = facture_record.id 
        ORDER BY created_at DESC
      LOOP
        IF excedent <= 0 THEN
          EXIT;
        END IF;
        
        IF paiement_record.montant <= excedent THEN
          -- Delete the entire payment
          DELETE FROM public.paiements_factures WHERE id = paiement_record.id;
          excedent := excedent - paiement_record.montant;
        ELSE
          -- Reduce the payment amount
          UPDATE public.paiements_factures 
          SET montant = montant - excedent
          WHERE id = paiement_record.id;
          excedent := 0;
        END IF;
      END LOOP;
    END IF;
    
    -- Return the correction details
    facture_id := facture_record.id;
    ancien_solde := facture_record.solde;
    nouveau_solde := facture_record.montant_total - (
      SELECT COALESCE(SUM(montant), 0) 
      FROM public.paiements_factures 
      WHERE paiements_factures.facture_id = facture_record.id
    );
    
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;