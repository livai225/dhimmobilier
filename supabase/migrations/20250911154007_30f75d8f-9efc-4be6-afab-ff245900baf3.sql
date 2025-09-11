-- Add type_contrat field to locations table for historical vs new contracts
ALTER TABLE public.locations 
ADD COLUMN type_contrat text NOT NULL DEFAULT 'nouveau';

-- Add comment for clarity
COMMENT ON COLUMN public.locations.type_contrat IS 'Type de contrat: nouveau (avec caution) ou historique (sans caution)';

-- Update existing locations to be 'nouveau' type
UPDATE public.locations SET type_contrat = 'nouveau' WHERE type_contrat IS NULL;