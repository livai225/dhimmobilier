-- Activer RLS sur receipt_counters (problème critique)
ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;

-- Ajouter politique pour permettre l'accès aux compteurs de reçus
CREATE POLICY "Allow all access to receipt_counters" 
ON public.receipt_counters 
FOR ALL 
USING (true) 
WITH CHECK (true);