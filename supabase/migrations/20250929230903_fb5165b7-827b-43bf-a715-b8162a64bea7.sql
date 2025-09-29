-- Add missing foreign key relationship between paiements_droit_terre and souscriptions
ALTER TABLE public.paiements_droit_terre 
ADD CONSTRAINT fk_paiements_droit_terre_souscription
FOREIGN KEY (souscription_id) 
REFERENCES public.souscriptions(id)
ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_paiements_droit_terre_souscription 
ON public.paiements_droit_terre(souscription_id);

CREATE INDEX IF NOT EXISTS idx_paiements_droit_terre_date 
ON public.paiements_droit_terre(date_paiement);

CREATE INDEX IF NOT EXISTS idx_paiements_locations_date
ON public.paiements_locations(date_paiement);

CREATE INDEX IF NOT EXISTS idx_souscriptions_propriete
ON public.souscriptions(propriete_id);

CREATE INDEX IF NOT EXISTS idx_locations_propriete
ON public.locations(propriete_id);