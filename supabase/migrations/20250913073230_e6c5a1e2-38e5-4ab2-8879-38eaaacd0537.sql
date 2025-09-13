-- Clean up custom permissions for the problematic accountant user
-- These permissions are causing privilege escalation
DELETE FROM user_permissions 
WHERE user_id = 'c202331d-02f3-4b29-94e5-4f9a698c3282' 
AND permission_name IN ('can_create_suppliers', 'can_create_invoices', 'can_create_clients');

-- Add a check constraint to prevent non-admin users from getting admin-level permissions
-- This will prevent future privilege escalation via custom permissions
ALTER TABLE user_permissions 
ADD CONSTRAINT check_no_privilege_escalation 
CHECK (
  permission_name NOT IN ('can_create_suppliers', 'can_create_invoices', 'can_create_agents') 
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = user_permissions.user_id 
    AND users.role = 'admin'
  )
);