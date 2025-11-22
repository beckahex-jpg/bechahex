-- Run this after creating the account through the app
-- Replace 'jallalalomary@gmail.com' with your actual email if different

UPDATE profiles
SET role = 'admin'
WHERE email = 'jallalalomary@gmail.com';

-- Verify the change
SELECT id, email, full_name, role FROM profiles WHERE email = 'jallalalomary@gmail.com';
