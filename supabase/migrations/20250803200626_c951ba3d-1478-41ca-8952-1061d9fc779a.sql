-- Create secteurs_activite table
CREATE TABLE public.secteurs_activite (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default activity sectors
INSERT INTO public.secteurs_activite (nom, description) VALUES
  ('Construction', 'Travaux de construction et rénovation'),
  ('Plomberie', 'Installation et réparation de plomberie'),
  ('Électricité', 'Installation et maintenance électrique'),
  ('Jardinage', 'Entretien espaces verts et jardinage'),
  ('Nettoyage', 'Services de nettoyage et entretien'),
  ('Sécurité', 'Systèmes de sécurité et surveillance'),
  ('Peinture', 'Travaux de peinture et décoration'),
  ('Menuiserie', 'Travaux de menuiserie et ameublement'),
  ('Climatisation', 'Installation et maintenance climatisation'),
  ('Autre', 'Autres services');

-- Add new columns to fournisseurs table
ALTER TABLE public.fournisseurs 
ADD COLUMN secteur_id UUID REFERENCES public.secteurs_activite(id),
ADD COLUMN site_web TEXT,
ADD COLUMN numero_tva TEXT,
ADD COLUMN note_performance INTEGER CHECK (note_performance >= 1 AND note_performance <= 5);

-- Enable RLS on secteurs_activite
ALTER TABLE public.secteurs_activite ENABLE ROW LEVEL SECURITY;

-- Create simple RLS policies for secteurs_activite
CREATE POLICY "Allow all access to secteurs_activite" 
ON public.secteurs_activite 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Update RLS policies for fournisseurs to be more flexible
DROP POLICY IF EXISTS "Authenticated users can access fournisseurs" ON public.fournisseurs;
CREATE POLICY "Allow all access to fournisseurs" 
ON public.fournisseurs 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Update RLS policies for factures_fournisseurs to be more flexible
DROP POLICY IF EXISTS "Authenticated users can access factures_fournisseurs" ON public.factures_fournisseurs;
CREATE POLICY "Allow all access to factures_fournisseurs" 
ON public.factures_fournisseurs 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Update RLS policies for paiements_factures to be more flexible
DROP POLICY IF EXISTS "Authenticated users can access paiements_factures" ON public.paiements_factures;
CREATE POLICY "Allow all access to paiements_factures" 
ON public.paiements_factures 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Improve the calculate_facture_solde function
CREATE OR REPLACE FUNCTION public.update_facture_totals()
RETURNS TRIGGER AS $$
DECLARE
  total_paye DECIMAL;
BEGIN
  -- Calculate total paid for this invoice
  SELECT COALESCE(SUM(montant), 0) INTO total_paye
  FROM public.paiements_factures 
  WHERE facture_id = NEW.facture_id;
  
  -- Update the invoice with new totals
  UPDATE public.factures_fournisseurs 
  SET 
    montant_paye = total_paye,
    solde = montant_total - total_paye,
    updated_at = now()
  WHERE id = NEW.facture_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update facture totals when payments are added/updated/deleted
DROP TRIGGER IF EXISTS update_facture_on_payment ON public.paiements_factures;
CREATE TRIGGER update_facture_on_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.paiements_factures
  FOR EACH ROW
  EXECUTE FUNCTION public.update_facture_totals();

-- Add function to generate invoice numbers
CREATE OR REPLACE FUNCTION public.generate_facture_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  year_suffix TEXT;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM '^FACT(\d+)-' FOR '#') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.factures_fournisseurs
  WHERE numero LIKE 'FACT%-' || year_suffix;
  
  RETURN 'FACT' || LPAD(next_number::TEXT, 4, '0') || '-' || year_suffix;
END;
$$ LANGUAGE plpgsql;