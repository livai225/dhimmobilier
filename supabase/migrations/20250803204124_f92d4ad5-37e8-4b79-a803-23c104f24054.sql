-- Create table for "droit de terre" pricing scale
CREATE TABLE public.bareme_droits_terre (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_bien TEXT NOT NULL UNIQUE,
  montant_mensuel NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default pricing scale
INSERT INTO public.bareme_droits_terre (type_bien, montant_mensuel, description) VALUES
('Atelier', 10000, 'Atelier - 10 000 FCFA/mois'),
('Chambre salon', 15000, 'Chambre salon - 15 000 FCFA/mois'),
('2 chambres salon', 30000, '2 chambres salon - 30 000 FCFA/mois'),
('3 chambres salon', 45000, '3 chambres salon - 45 000 FCFA/mois'),
('Magasin (petit)', 10000, 'Magasin petit - 10 000 FCFA/mois'),
('Magasin (grand)', 20000, 'Magasin grand - 20 000 FCFA/mois');

-- Add new fields to souscriptions table for "mise en garde" system
ALTER TABLE public.souscriptions 
ADD COLUMN type_souscription TEXT NOT NULL DEFAULT 'classique',
ADD COLUMN periode_finition_mois INTEGER DEFAULT 9,
ADD COLUMN date_fin_finition DATE,
ADD COLUMN date_debut_droit_terre DATE,
ADD COLUMN montant_droit_terre_mensuel NUMERIC DEFAULT 0,
ADD COLUMN phase_actuelle TEXT NOT NULL DEFAULT 'souscription',
ADD COLUMN type_bien TEXT;

-- Create table for "droit de terre" payment schedule
CREATE TABLE public.echeances_droit_terre (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  souscription_id UUID NOT NULL,
  numero_echeance INTEGER NOT NULL,
  date_echeance DATE NOT NULL,
  montant NUMERIC NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  date_paiement DATE,
  montant_paye NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.bareme_droits_terre ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.echeances_droit_terre ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all access to bareme_droits_terre" 
ON public.bareme_droits_terre 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all access to echeances_droit_terre" 
ON public.echeances_droit_terre 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create function to calculate phase dates
CREATE OR REPLACE FUNCTION public.calculate_souscription_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate end of finishing period
  IF NEW.type_souscription = 'mise_en_garde' AND NEW.date_debut IS NOT NULL THEN
    NEW.date_fin_finition = NEW.date_debut + (NEW.periode_finition_mois || ' months')::INTERVAL;
    NEW.date_debut_droit_terre = NEW.date_fin_finition + INTERVAL '1 day';
  END IF;
  
  -- Set droit de terre amount based on property type
  IF NEW.type_bien IS NOT NULL THEN
    SELECT montant_mensuel INTO NEW.montant_droit_terre_mensuel
    FROM public.bareme_droits_terre
    WHERE type_bien = NEW.type_bien;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic date calculation
CREATE TRIGGER calculate_souscription_dates_trigger
BEFORE INSERT OR UPDATE ON public.souscriptions
FOR EACH ROW
EXECUTE FUNCTION public.calculate_souscription_dates();

-- Create function to generate droit de terre payment schedule
CREATE OR REPLACE FUNCTION public.generate_echeances_droit_terre(souscription_uuid UUID)
RETURNS VOID AS $$
DECLARE
  sub_record RECORD;
  echeance_date DATE;
  i INTEGER;
BEGIN
  -- Get subscription details
  SELECT * INTO sub_record
  FROM public.souscriptions
  WHERE id = souscription_uuid;
  
  -- Only generate for "mise en garde" subscriptions
  IF sub_record.type_souscription = 'mise_en_garde' AND sub_record.date_debut_droit_terre IS NOT NULL THEN
    -- Generate 240 monthly payments (20 years)
    echeance_date := sub_record.date_debut_droit_terre;
    
    FOR i IN 1..240 LOOP
      INSERT INTO public.echeances_droit_terre (
        souscription_id,
        numero_echeance,
        date_echeance,
        montant
      ) VALUES (
        souscription_uuid,
        i,
        echeance_date,
        sub_record.montant_droit_terre_mensuel
      );
      
      -- Move to next month
      echeance_date := echeance_date + INTERVAL '1 month';
    END LOOP;
    
    -- Update subscription phase
    UPDATE public.souscriptions
    SET phase_actuelle = 'droit_terre'
    WHERE id = souscription_uuid;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for updated_at on new tables
CREATE TRIGGER update_bareme_droits_terre_updated_at
BEFORE UPDATE ON public.bareme_droits_terre
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_echeances_droit_terre_updated_at
BEFORE UPDATE ON public.echeances_droit_terre
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();