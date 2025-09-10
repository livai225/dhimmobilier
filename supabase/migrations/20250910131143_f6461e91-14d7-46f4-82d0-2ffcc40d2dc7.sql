-- Add username and password_hash to users table
ALTER TABLE public.users 
ADD COLUMN username text UNIQUE,
ADD COLUMN password_hash text;

-- Create user_permissions table for granular permissions
CREATE TABLE public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_name text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_name)
);

-- Enable RLS on user_permissions
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for user_permissions
CREATE POLICY "Allow all access to user_permissions" 
ON public.user_permissions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for updated_at on user_permissions
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for clarity
COMMENT ON TABLE public.user_permissions IS 'Granular permissions for individual users';
COMMENT ON COLUMN public.user_permissions.permission_name IS 'Name of the permission (e.g., can_create_clients, can_create_properties)';
COMMENT ON COLUMN public.user_permissions.granted IS 'Whether this permission is granted to the user';

-- Insert available permissions as reference (these will be the available options)
-- This helps maintain consistency in permission names
CREATE TABLE public.available_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on available_permissions
ALTER TABLE public.available_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for available_permissions
CREATE POLICY "Allow all access to available_permissions" 
ON public.available_permissions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Insert the available permissions
INSERT INTO public.available_permissions (name, display_name, description, category) VALUES
('can_create_clients', 'Créer des clients', 'Permet de créer de nouveaux clients', 'creation'),
('can_create_properties', 'Créer des propriétés', 'Permet de créer de nouvelles propriétés', 'creation'),
('can_create_suppliers', 'Créer des fournisseurs', 'Permet de créer de nouveaux fournisseurs', 'creation'),
('can_create_invoices', 'Créer des factures', 'Permet de créer de nouvelles factures fournisseurs', 'creation'),
('can_create_agents', 'Créer des agents', 'Permet de créer de nouveaux agents de recouvrement', 'creation');