-- Add fields for the 5-month deposit process to locations table
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS garantie_2_mois NUMERIC DEFAULT 0;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS loyer_avance_2_mois NUMERIC DEFAULT 0;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS frais_agence_1_mois NUMERIC DEFAULT 0;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS caution_totale NUMERIC DEFAULT 0;

-- Update the calculate_location_dette function to handle the new 5-month deposit process
CREATE OR REPLACE FUNCTION public.calculate_location_dette()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  total_paye DECIMAL;
  mois_ecoules INTEGER;
  montant_du DECIMAL;
BEGIN
  -- Calculer le nombre de mois écoulés depuis le début
  mois_ecoules = EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.date_debut)) * 12 + 
                 EXTRACT(MONTH FROM AGE(CURRENT_DATE, NEW.date_debut));
  
  -- Calculer le montant total payé pour cette location (hors caution initiale)
  SELECT COALESCE(SUM(montant), 0) INTO total_paye
  FROM public.paiements_locations 
  WHERE location_id = NEW.id;
  
  -- Calculer le montant dû (loyer mensuel * mois écoulés)
  -- La caution de 5 mois couvre les premières échéances
  IF mois_ecoules <= 5 THEN
    -- Pendant les 5 premiers mois, pas de dette car la caution couvre
    NEW.dette_totale = 0;
  ELSE
    -- Après 5 mois, calculer la dette sur les mois restants
    montant_du = NEW.loyer_mensuel * (mois_ecoules - 5);
    NEW.dette_totale = GREATEST(0, montant_du - total_paye);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for automatic dette calculation
DROP TRIGGER IF EXISTS calculate_location_dette_trigger ON public.locations;
CREATE TRIGGER calculate_location_dette_trigger
  BEFORE INSERT OR UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_location_dette();

-- Create trigger to update location dette when payments are made
CREATE OR REPLACE FUNCTION public.update_location_on_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Update the location to recalculate dette
  UPDATE public.locations 
  SET updated_at = now()
  WHERE id = NEW.location_id;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS update_location_on_payment_trigger ON public.paiements_locations;
CREATE TRIGGER update_location_on_payment_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.paiements_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_location_on_payment();