-- Assouplir la validation des numéros de téléphone
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS valid_telephone_principal;

-- Nouvelle contrainte plus permissive
ALTER TABLE public.clients ADD CONSTRAINT valid_telephone_principal 
CHECK (telephone_principal IS NULL OR length(trim(telephone_principal)) >= 6);