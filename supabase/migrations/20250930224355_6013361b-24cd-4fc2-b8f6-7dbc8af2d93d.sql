-- Drop existing restrictive policies on company_settings
DROP POLICY IF EXISTS "Only admins can insert company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Only admins can update company settings" ON public.company_settings;

-- Create new permissive policies for company_settings
CREATE POLICY "Allow insert company settings"
ON public.company_settings
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update company settings"
ON public.company_settings
FOR UPDATE
USING (true);

-- Drop existing restrictive storage policies
DROP POLICY IF EXISTS "Admins can upload company assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update company assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete company assets" ON storage.objects;

-- Create new permissive storage policies for company-assets bucket
CREATE POLICY "Allow upload company assets"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'company-assets');

CREATE POLICY "Allow update company assets"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'company-assets');

CREATE POLICY "Allow delete company assets"
ON storage.objects
FOR DELETE
USING (bucket_id = 'company-assets');