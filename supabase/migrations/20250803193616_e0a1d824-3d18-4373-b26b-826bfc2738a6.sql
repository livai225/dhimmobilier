-- Supprimer toutes les politiques RLS strictes et créer des politiques permissives
DROP POLICY IF EXISTS "Authenticated users can access proprietes" ON public.proprietes;
DROP POLICY IF EXISTS "Authenticated users can access types_proprietes" ON public.types_proprietes;

-- Créer des politiques permissives pour permettre tous les accès
CREATE POLICY "Allow all access to proprietes" 
ON public.proprietes 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all access to types_proprietes" 
ON public.types_proprietes 
FOR ALL 
USING (true)
WITH CHECK (true);