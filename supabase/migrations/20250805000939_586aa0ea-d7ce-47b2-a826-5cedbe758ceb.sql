-- Simplify the land right payment system
-- Add a new table for simplified land right payments
CREATE TABLE IF NOT EXISTS public.paiements_droit_terre (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  souscription_id UUID NOT NULL,
  montant NUMERIC NOT NULL,
  date_paiement DATE NOT NULL,
  mode_paiement TEXT,
  reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.paiements_droit_terre ENABLE ROW LEVEL SECURITY;

-- Create policy for land right payments
CREATE POLICY "Allow all access to paiements_droit_terre" 
ON public.paiements_droit_terre 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add a function to calculate remaining balance for land rights
CREATE OR REPLACE FUNCTION public.calculate_solde_droit_terre(souscription_uuid uuid)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $function$
DECLARE
  total_a_payer NUMERIC;
  total_paye NUMERIC;
  nb_mois_ecoules INTEGER;
  montant_mensuel NUMERIC;
  date_debut DATE;
BEGIN
  -- Get subscription details
  SELECT 
    montant_droit_terre_mensuel,
    date_debut_droit_terre
  INTO montant_mensuel, date_debut
  FROM public.souscriptions
  WHERE id = souscription_uuid;
  
  -- Calculate months elapsed since start of land rights
  IF date_debut IS NOT NULL THEN
    nb_mois_ecoules := GREATEST(0, 
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_debut)) * 12 + 
      EXTRACT(MONTH FROM AGE(CURRENT_DATE, date_debut))
    );
  ELSE
    nb_mois_ecoules := 0;
  END IF;
  
  -- Calculate total amount due so far
  total_a_payer := montant_mensuel * nb_mois_ecoules;
  
  -- Calculate total paid
  SELECT COALESCE(SUM(montant), 0) INTO total_paye
  FROM public.paiements_droit_terre 
  WHERE souscription_id = souscription_uuid;
  
  -- Return remaining balance (can be negative if overpaid)
  RETURN total_a_payer - total_paye;
END;
$function$;