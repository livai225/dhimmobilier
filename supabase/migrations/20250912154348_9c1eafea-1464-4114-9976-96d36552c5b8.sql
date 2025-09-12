-- Add type_souscription field to differentiate historical vs new subscriptions
ALTER TABLE public.souscriptions 
ADD COLUMN IF NOT EXISTS type_souscription TEXT NOT NULL DEFAULT 'nouveau';

-- Add a comment to the column
COMMENT ON COLUMN public.souscriptions.type_souscription IS 'Type de souscription: nouveau (default), historique';