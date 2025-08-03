-- Add montant_souscris column to souscriptions table to replace prix_total
ALTER TABLE public.souscriptions 
ADD COLUMN montant_souscris numeric DEFAULT 0;

-- Update existing records to copy prix_total to montant_souscris
UPDATE public.souscriptions 
SET montant_souscris = prix_total 
WHERE montant_souscris = 0 OR montant_souscris IS NULL;