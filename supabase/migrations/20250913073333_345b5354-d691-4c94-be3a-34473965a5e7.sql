-- Clean up custom permissions for the problematic accountant user
-- These permissions are causing privilege escalation
DELETE FROM user_permissions 
WHERE user_id = 'c202331d-02f3-4b29-94e5-4f9a698c3282' 
AND permission_name IN ('can_create_suppliers', 'can_create_invoices', 'can_create_clients');

-- Create a function to validate permissions based on user role
CREATE OR REPLACE FUNCTION validate_user_permission(user_id_param UUID, permission_name_param TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    CASE 
      WHEN permission_name_param IN ('can_create_suppliers', 'can_create_invoices', 'can_create_agents') THEN
        EXISTS (SELECT 1 FROM users WHERE id = user_id_param AND role = 'admin')
      ELSE TRUE
    END;
$$;

-- Add a check constraint using the function
ALTER TABLE user_permissions 
ADD CONSTRAINT check_role_based_permissions 
CHECK (validate_user_permission(user_id, permission_name));