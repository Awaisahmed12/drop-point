-- Admin Configurations Table
-- This table stores global application settings that can be managed by admins

CREATE TABLE admin_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_admin_configurations_key ON admin_configurations(key);
CREATE INDEX idx_admin_configurations_category ON admin_configurations(category);
CREATE INDEX idx_admin_configurations_active ON admin_configurations(is_active);

-- Enable Row Level Security
ALTER TABLE admin_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
-- Only users with admin role can read/write configurations
CREATE POLICY "Admins can view all configurations" ON admin_configurations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can insert configurations" ON admin_configurations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can update configurations" ON admin_configurations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND user_type = 'admin'
    )
  );

CREATE POLICY "Admins can delete configurations" ON admin_configurations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() 
      AND user_type = 'admin'
    )
  );

-- Insert initial configuration for street view
INSERT INTO admin_configurations (key, value, description, category, created_by) 
VALUES (
  'street_view_enabled',
  'true',
  'Controls whether Street View is shown in property details modal. When enabled, shows Street View iframe and related UI elements.',
  'ui',
  (SELECT id FROM auth.users LIMIT 1) -- This will need to be updated with actual admin user ID
);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_admin_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update timestamps
CREATE TRIGGER trigger_update_admin_configurations_updated_at
  BEFORE UPDATE ON admin_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_configurations_updated_at();
