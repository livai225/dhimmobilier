-- Create table for subscription installments
CREATE TABLE public.echeances_souscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  souscription_id UUID NOT NULL,
  numero_echeance INTEGER NOT NULL,
  date_echeance DATE NOT NULL,
  montant NUMERIC NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  montant_paye NUMERIC DEFAULT 0,
  date_paiement DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.echeances_souscriptions ENABLE ROW LEVEL SECURITY;

-- Create policy for subscription installments
CREATE POLICY "Allow all access to echeances_souscriptions" 
ON public.echeances_souscriptions 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create function to generate subscription installments
CREATE OR REPLACE FUNCTION public.generate_echeances_souscription(souscription_uuid uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  sub_record RECORD;
  echeance_date DATE;
  i INTEGER;
  montant_echeance NUMERIC;
BEGIN
  -- Get subscription details
  SELECT * INTO sub_record
  FROM public.souscriptions
  WHERE id = souscription_uuid;
  
  -- Check if subscription has remaining balance and monthly payment defined
  IF sub_record.solde_restant > 0 AND sub_record.montant_mensuel > 0 AND sub_record.nombre_mois > 0 THEN
    -- Calculate installment amount
    montant_echeance := sub_record.solde_restant / sub_record.nombre_mois;
    
    -- Start from subscription start date
    echeance_date := sub_record.date_debut;
    
    -- Generate installments based on nombre_mois
    FOR i IN 1..sub_record.nombre_mois LOOP
      INSERT INTO public.echeances_souscriptions (
        souscription_id,
        numero_echeance,
        date_echeance,
        montant
      ) VALUES (
        souscription_uuid,
        i,
        echeance_date,
        montant_echeance
      );
      
      -- Move to next month
      echeance_date := echeance_date + INTERVAL '1 month';
    END LOOP;
  END IF;
END;
$function$;

-- Create trigger for updated_at
CREATE TRIGGER update_echeances_souscriptions_updated_at
BEFORE UPDATE ON public.echeances_souscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update MODESTE KOKO's subscription to have proper payment terms
UPDATE public.souscriptions 
SET 
  nombre_mois = 10,
  montant_mensuel = 250000
WHERE client_id IN (
  SELECT id FROM public.clients 
  WHERE nom = 'KOKO' AND prenom = 'MODESTE'
) AND solde_restant > 0;