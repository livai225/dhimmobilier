-- Supprimer toutes les politiques RLS strictes pour les tables liées aux propriétés
DROP POLICY IF EXISTS "Authenticated users can access locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated users can access souscriptions" ON public.souscriptions;
DROP POLICY IF EXISTS "Authenticated users can access paiements_locations" ON public.paiements_locations;
DROP POLICY IF EXISTS "Authenticated users can access paiements_souscriptions" ON public.paiements_souscriptions;
DROP POLICY IF EXISTS "Authenticated users can access recus" ON public.recus;

-- Créer des politiques permissives pour permettre tous les accès
CREATE POLICY "Allow all access to locations" 
ON public.locations 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all access to souscriptions" 
ON public.souscriptions 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all access to paiements_locations" 
ON public.paiements_locations 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all access to paiements_souscriptions" 
ON public.paiements_souscriptions 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all access to recus" 
ON public.recus 
FOR ALL 
USING (true)
WITH CHECK (true);