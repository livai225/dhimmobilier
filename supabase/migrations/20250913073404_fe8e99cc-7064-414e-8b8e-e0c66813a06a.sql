-- Clean up custom permissions for the problematic accountant user
-- These permissions are causing privilege escalation
DELETE FROM user_permissions 
WHERE user_id = 'c202331d-02f3-4b29-94e5-4f9a698c3282';