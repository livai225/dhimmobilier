-- Update RLS policy to allow anonymous access for clients table
-- This is a temporary fix to allow client addition without authentication

DROP POLICY IF EXISTS "Authenticated users can access clients" ON public.clients;

CREATE POLICY "Allow all access to clients" 
ON public.clients 
FOR ALL 
USING (true) 
WITH CHECK (true);