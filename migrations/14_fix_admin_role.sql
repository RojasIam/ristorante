-- Force update admin role
UPDATE profiles 
SET global_role = 'super_admin' 
WHERE email = 'admin@garsystem.com' OR email ILIKE '%admin%';

-- Also check if any other user needs fixing
-- For example, cuoco should be 'cuoco' if possible
-- But manual fix is better for admin.
