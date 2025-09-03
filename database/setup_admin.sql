-- Setup script for admin configuration system
-- Run this after creating the admin_configurations table

-- First, create the admin_configurations table (run admin_configurations.sql first)
-- Then run this script to set up initial data

-- Insert initial configuration for street view (if not already exists)
INSERT INTO admin_configurations (key, value, description, category) 
VALUES (
  'street_view_enabled',
  'true',
  'Controls whether Street View is shown in property details modal. When enabled, shows Street View iframe and related UI elements.',
  'ui'
) ON CONFLICT (key) DO NOTHING;

-- To make a user an admin, update their user_type in user_profiles:
-- UPDATE user_profiles SET user_type = 'Admin' WHERE user_id = 'YOUR_USER_ID_HERE';

-- Example: If you know your user email, you can find and update the user:
-- UPDATE user_profiles 
-- SET user_type = 'Admin' 
-- WHERE user_id = (
--   SELECT id FROM auth.users WHERE email = 'your-email@example.com'
-- );

-- Verify the setup
SELECT 
  ac.key,
  ac.value,
  ac.description,
  ac.category,
  ac.is_active
FROM admin_configurations ac
WHERE ac.is_active = true;

-- Check admin users
SELECT 
  up.user_id,
  au.email,
  up.user_type,
  up.first_name,
  up.last_name
FROM user_profiles up
JOIN auth.users au ON up.user_id = au.id
WHERE up.user_type = 'Admin';
