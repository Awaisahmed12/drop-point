-- Hardening. Run once in the Supabase SQL editor, after the other files in
-- this folder. Every statement is idempotent.
--
-- 1. Row-level security on every table the app reads, so a table created
--    in the dashboard without it is closed by default.
-- 2. user_type (the admin flag) can be set only from the SQL editor or with
--    the service role; an account cannot promote itself through the API.
-- 3. The admin_configurations policies match 'Admin' and 'admin' alike (the
--    original policies and the setup notes disagreed on case), and every
--    signed-in user may read the active feature flags the app depends on.
-- 4. The storage bucket enforces the 50 MB per-file limit and the file
--    types the app accepts on the server, not only in the browser.

-- 1. ---------------------------------------------------------------------
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_tags ENABLE ROW LEVEL SECURITY;

-- 2. ---------------------------------------------------------------------
-- A request made as a signed-in account (auth.uid() set, not the service
-- role) keeps whatever user_type the row already has, and inserts none.
CREATE OR REPLACE FUNCTION protect_user_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.user_type := NULL;
  ELSE
    NEW.user_type := OLD.user_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_type ON user_profiles;
CREATE TRIGGER protect_user_type
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION protect_user_type();

-- 3. ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND lower(user_type) = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Admins can view all configurations" ON admin_configurations;
DROP POLICY IF EXISTS "Admins can insert configurations" ON admin_configurations;
DROP POLICY IF EXISTS "Admins can update configurations" ON admin_configurations;
DROP POLICY IF EXISTS "Admins can delete configurations" ON admin_configurations;
DROP POLICY IF EXISTS "config: signed-in users read active flags" ON admin_configurations;
DROP POLICY IF EXISTS "config: admins read all" ON admin_configurations;
DROP POLICY IF EXISTS "config: admins insert" ON admin_configurations;
DROP POLICY IF EXISTS "config: admins update" ON admin_configurations;
DROP POLICY IF EXISTS "config: admins delete" ON admin_configurations;

CREATE POLICY "config: signed-in users read active flags" ON admin_configurations
  FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "config: admins read all" ON admin_configurations
  FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "config: admins insert" ON admin_configurations
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "config: admins update" ON admin_configurations
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "config: admins delete" ON admin_configurations
  FOR DELETE TO authenticated USING (is_admin());

-- 4. ---------------------------------------------------------------------
-- Private bucket, 50 MB a file, and only the types the app offers. No
-- text/html or image/svg+xml: nothing that could run script is stored.
-- A file the browser cannot type arrives as text/plain, which stays allowed
-- so Pages/Numbers/Keynote files still upload.
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/bmp', 'image/tiff',
    'application/pdf',
    'text/plain', 'text/csv', 'text/rtf', 'application/rtf', 'application/json', 'application/xml', 'text/xml',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.apple.pages', 'application/vnd.apple.numbers', 'application/vnd.apple.keynote',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
    'application/zip', 'application/x-zip-compressed', 'application/vnd.rar', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/octet-stream'
  ]
WHERE id = 'property-files';
