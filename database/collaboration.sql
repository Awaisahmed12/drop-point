-- Collaboration, sharing and organization.
--
-- Run once in the Supabase SQL editor, after the base schema (properties,
-- property_files, property_folders, user_profiles). Everything here is
-- additive: new tables, two new columns, helper functions, and policies that
-- widen access. The existing owner-only policies keep working alongside them.
--
-- The model, in one paragraph: a "view" (table `tags`) is a named, colored
-- label a person owns, like a calendar in Google Calendar. Views are put on
-- properties (`property_tags`) and can be put on files (`file_tags`). A view
-- can be shared with other people by email (`tag_members`); members see every
-- property carrying that view. Inside a property, files and folders are
-- private to whoever uploaded them unless marked `shared`, so an owner keeps
-- their own files next to the team's without exposing them.

-- ---------------------------------------------------------------------------
-- 1. Tables and columns
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  color TEXT NOT NULL DEFAULT '#0a7aff' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tags_owner_name_idx ON tags (owner_id, lower(name));

-- People a view is shared with. `user_id` is filled in once that person signs
-- in (see claim_tag_invites); until then the row is a pending invite.
CREATE TABLE IF NOT EXISTS tag_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tag_members_tag_email_idx ON tag_members (tag_id, lower(email));
CREATE INDEX IF NOT EXISTS tag_members_user_idx ON tag_members (user_id);

CREATE TABLE IF NOT EXISTS property_tags (
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  added_by UUID DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (property_id, tag_id)
);
CREATE INDEX IF NOT EXISTS property_tags_tag_idx ON property_tags (tag_id);

CREATE TABLE IF NOT EXISTS file_tags (
  file_id UUID NOT NULL REFERENCES property_files(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (file_id, tag_id)
);
CREATE INDEX IF NOT EXISTS file_tags_tag_idx ON file_tags (tag_id);

-- Private by default. `shared` means "everyone who can see this property".
ALTER TABLE property_folders
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'shared'));
ALTER TABLE property_files
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'shared'));
CREATE INDEX IF NOT EXISTS property_files_visibility_idx ON property_files (property_id, visibility);
CREATE INDEX IF NOT EXISTS property_folders_visibility_idx ON property_folders (property_id, visibility);

CREATE OR REPLACE FUNCTION set_tags_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_tags_updated_at ON tags;
CREATE TRIGGER trigger_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION set_tags_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Access helpers
--
-- SECURITY DEFINER so a policy on one table can look at another without
-- re-entering that table's own policies (which would recurse). They only
-- answer yes/no questions about the calling user.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_user_email()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

CREATE OR REPLACE FUNCTION is_tag_owner(p_tag UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM tags t WHERE t.id = p_tag AND t.owner_id = auth.uid());
$$;

-- A member is matched by user id, or by email while the invite is unclaimed.
CREATE OR REPLACE FUNCTION is_tag_member(p_tag UUID, p_role TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM tag_members m
    WHERE m.tag_id = p_tag
      AND (m.user_id = auth.uid() OR (m.user_id IS NULL AND lower(m.email) = current_user_email()))
      AND (p_role IS NULL OR m.role = p_role)
  );
$$;

CREATE OR REPLACE FUNCTION can_view_tag(p_tag UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_tag_owner(p_tag) OR is_tag_member(p_tag);
$$;

CREATE OR REPLACE FUNCTION is_property_owner(p_property UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM properties p WHERE p.id = p_property AND p.user_id = auth.uid());
$$;

-- Owner, or a member of any view the property carries.
CREATE OR REPLACE FUNCTION can_view_property(p_property UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_property_owner(p_property)
      OR EXISTS (
        SELECT 1 FROM property_tags pt
        WHERE pt.property_id = p_property AND is_tag_member(pt.tag_id)
      );
$$;

-- Owner, or an editor of any view the property carries.
CREATE OR REPLACE FUNCTION can_edit_property(p_property UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_property_owner(p_property)
      OR EXISTS (
        SELECT 1 FROM property_tags pt
        WHERE pt.property_id = p_property AND is_tag_member(pt.tag_id, 'editor')
      );
$$;

CREATE OR REPLACE FUNCTION can_view_file(p_file UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM property_files f
    WHERE f.id = p_file
      AND (f.user_id = auth.uid() OR (f.visibility = 'shared' AND can_view_property(f.property_id)))
  );
$$;

-- Storage object names are "<property id>/<file name>". NULL when the prefix
-- isn't a UUID so a stray object can never match a policy by accident.
CREATE OR REPLACE FUNCTION path_property_id(p_name TEXT)
RETURNS UUID LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN split_part(p_name, '/', 1)::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Called by the app after sign-in: binds invites addressed to this email to
-- the signed-in user so membership no longer depends on the email claim.
CREATE OR REPLACE FUNCTION claim_tag_invites()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE tag_members
     SET user_id = auth.uid()
   WHERE user_id IS NULL AND lower(email) = current_user_email();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Sharing a folder also opens the folders above it (so it is reachable) and,
-- optionally, everything inside it. Making a folder private closes everything
-- inside it. Files in the ancestors are left as they are. Runs as the caller
-- so the row policies below still apply to every touched row.
CREATE OR REPLACE FUNCTION set_folder_visibility(p_folder UUID, p_visibility TEXT, p_include_contents BOOLEAN DEFAULT TRUE)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_visibility NOT IN ('private', 'shared') THEN
    RAISE EXCEPTION 'invalid visibility %', p_visibility;
  END IF;

  UPDATE property_folders SET visibility = p_visibility WHERE id = p_folder;

  IF p_visibility = 'shared' THEN
    WITH RECURSIVE up AS (
      SELECT parent_id FROM property_folders WHERE id = p_folder
      UNION
      SELECT f.parent_id FROM property_folders f JOIN up ON f.id = up.parent_id
    )
    UPDATE property_folders SET visibility = 'shared'
     WHERE id IN (SELECT parent_id FROM up WHERE parent_id IS NOT NULL);
  END IF;

  IF p_visibility = 'private' OR p_include_contents THEN
    WITH RECURSIVE down AS (
      SELECT id FROM property_folders WHERE id = p_folder
      UNION
      SELECT f.id FROM property_folders f JOIN down ON f.parent_id = down.id
    )
    UPDATE property_folders SET visibility = p_visibility
     WHERE id IN (SELECT id FROM down) AND id <> p_folder;

    WITH RECURSIVE down AS (
      SELECT id FROM property_folders WHERE id = p_folder
      UNION
      SELECT f.id FROM property_folders f JOIN down ON f.parent_id = down.id
    )
    UPDATE property_files SET visibility = p_visibility
     WHERE folder_id IN (SELECT id FROM down);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION current_user_email() TO authenticated;
GRANT EXECUTE ON FUNCTION is_tag_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_tag_member(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION can_view_tag(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_property_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_view_property(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_edit_property(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_view_file(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION path_property_id(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_tag_invites() TO authenticated;
GRANT EXECUTE ON FUNCTION set_folder_visibility(UUID, TEXT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Row-level security
-- ---------------------------------------------------------------------------

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_tags ENABLE ROW LEVEL SECURITY;

-- tags: the owner does everything; members can read.
DROP POLICY IF EXISTS "tags: owner and members read" ON tags;
CREATE POLICY "tags: owner and members read" ON tags
  FOR SELECT USING (owner_id = auth.uid() OR is_tag_member(id));
DROP POLICY IF EXISTS "tags: owner inserts" ON tags;
CREATE POLICY "tags: owner inserts" ON tags
  FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "tags: owner updates" ON tags;
CREATE POLICY "tags: owner updates" ON tags
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "tags: owner deletes" ON tags;
CREATE POLICY "tags: owner deletes" ON tags
  FOR DELETE USING (owner_id = auth.uid());

-- tag_members: the owner sees and manages the list; a member sees their own
-- row and may remove it (leave).
DROP POLICY IF EXISTS "tag_members: owner and self read" ON tag_members;
CREATE POLICY "tag_members: owner and self read" ON tag_members
  FOR SELECT USING (
    is_tag_owner(tag_id)
    OR user_id = auth.uid()
    OR (user_id IS NULL AND lower(email) = current_user_email())
  );
DROP POLICY IF EXISTS "tag_members: owner adds" ON tag_members;
CREATE POLICY "tag_members: owner adds" ON tag_members
  FOR INSERT WITH CHECK (is_tag_owner(tag_id));
DROP POLICY IF EXISTS "tag_members: owner updates" ON tag_members;
CREATE POLICY "tag_members: owner updates" ON tag_members
  FOR UPDATE USING (is_tag_owner(tag_id)) WITH CHECK (is_tag_owner(tag_id));
DROP POLICY IF EXISTS "tag_members: owner removes or member leaves" ON tag_members;
CREATE POLICY "tag_members: owner removes or member leaves" ON tag_members
  FOR DELETE USING (is_tag_owner(tag_id) OR user_id = auth.uid());

-- property_tags: only the property's owner puts a view on it (with a view
-- they own or can edit), so sharing a property is always the owner's act.
DROP POLICY IF EXISTS "property_tags: visible with the view" ON property_tags;
CREATE POLICY "property_tags: visible with the view" ON property_tags
  FOR SELECT USING (can_view_tag(tag_id) AND can_view_property(property_id));
DROP POLICY IF EXISTS "property_tags: property owner adds" ON property_tags;
CREATE POLICY "property_tags: property owner adds" ON property_tags
  FOR INSERT WITH CHECK (
    is_property_owner(property_id)
    AND (is_tag_owner(tag_id) OR is_tag_member(tag_id, 'editor'))
  );
DROP POLICY IF EXISTS "property_tags: property or view owner removes" ON property_tags;
CREATE POLICY "property_tags: property or view owner removes" ON property_tags
  FOR DELETE USING (is_property_owner(property_id) OR is_tag_owner(tag_id));

-- file_tags: follow the file.
DROP POLICY IF EXISTS "file_tags: visible with the file" ON file_tags;
CREATE POLICY "file_tags: visible with the file" ON file_tags
  FOR SELECT USING (can_view_file(file_id) AND can_view_tag(tag_id));
DROP POLICY IF EXISTS "file_tags: uploader or property owner adds" ON file_tags;
CREATE POLICY "file_tags: uploader or property owner adds" ON file_tags
  FOR INSERT WITH CHECK (
    can_view_tag(tag_id)
    AND EXISTS (
      SELECT 1 FROM property_files f
      WHERE f.id = file_id AND (f.user_id = auth.uid() OR is_property_owner(f.property_id))
    )
  );
DROP POLICY IF EXISTS "file_tags: uploader or property owner removes" ON file_tags;
CREATE POLICY "file_tags: uploader or property owner removes" ON file_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM property_files f
      WHERE f.id = file_id AND (f.user_id = auth.uid() OR is_property_owner(f.property_id))
    )
  );

-- properties: members of a view see the properties carrying it. Editing and
-- deleting stay with the owner (existing policies).
DROP POLICY IF EXISTS "properties: visible through shared views" ON properties;
CREATE POLICY "properties: visible through shared views" ON properties
  FOR SELECT USING (can_view_property(id));

-- property_files: the uploader always sees their own; shared files are seen
-- by everyone who can see the property. Editors may upload; the uploader and
-- the property owner may change or delete.
DROP POLICY IF EXISTS "files: uploader reads own" ON property_files;
CREATE POLICY "files: uploader reads own" ON property_files
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "files: shared files follow the property" ON property_files;
CREATE POLICY "files: shared files follow the property" ON property_files
  FOR SELECT USING (visibility = 'shared' AND can_view_property(property_id));
DROP POLICY IF EXISTS "files: editors upload" ON property_files;
CREATE POLICY "files: editors upload" ON property_files
  FOR INSERT WITH CHECK (user_id = auth.uid() AND can_edit_property(property_id));
DROP POLICY IF EXISTS "files: uploader or property owner updates" ON property_files;
CREATE POLICY "files: uploader or property owner updates" ON property_files
  FOR UPDATE USING (user_id = auth.uid() OR is_property_owner(property_id))
  WITH CHECK (user_id = auth.uid() OR is_property_owner(property_id));
DROP POLICY IF EXISTS "files: uploader or property owner deletes" ON property_files;
CREATE POLICY "files: uploader or property owner deletes" ON property_files
  FOR DELETE USING (user_id = auth.uid() OR is_property_owner(property_id));

-- property_folders: same shape as files.
DROP POLICY IF EXISTS "folders: creator reads own" ON property_folders;
CREATE POLICY "folders: creator reads own" ON property_folders
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "folders: shared folders follow the property" ON property_folders;
CREATE POLICY "folders: shared folders follow the property" ON property_folders
  FOR SELECT USING (visibility = 'shared' AND can_view_property(property_id));
DROP POLICY IF EXISTS "folders: editors create" ON property_folders;
CREATE POLICY "folders: editors create" ON property_folders
  FOR INSERT WITH CHECK (user_id = auth.uid() AND can_edit_property(property_id));
DROP POLICY IF EXISTS "folders: creator or property owner updates" ON property_folders;
CREATE POLICY "folders: creator or property owner updates" ON property_folders
  FOR UPDATE USING (user_id = auth.uid() OR is_property_owner(property_id))
  WITH CHECK (user_id = auth.uid() OR is_property_owner(property_id));
DROP POLICY IF EXISTS "folders: creator or property owner deletes" ON property_folders;
CREATE POLICY "folders: creator or property owner deletes" ON property_folders
  FOR DELETE USING (user_id = auth.uid() OR is_property_owner(property_id));

-- ---------------------------------------------------------------------------
-- 4. Storage (bucket `property-files`, object names "<property id>/<name>")
--
-- Signed URLs are only issued for objects the caller may SELECT, so a shared
-- file's bytes follow the same rule as its row.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "storage: read own and shared property files" ON storage.objects;
CREATE POLICY "storage: read own and shared property files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'property-files'
    AND EXISTS (
      SELECT 1 FROM property_files f
      WHERE f.file_url = name
        AND (f.user_id = auth.uid() OR (f.visibility = 'shared' AND can_view_property(f.property_id)))
    )
  );
DROP POLICY IF EXISTS "storage: editors upload to properties they can edit" ON storage.objects;
CREATE POLICY "storage: editors upload to properties they can edit" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'property-files' AND can_edit_property(path_property_id(name))
  );
DROP POLICY IF EXISTS "storage: uploader or property owner moves" ON storage.objects;
CREATE POLICY "storage: uploader or property owner moves" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'property-files'
    AND (
      is_property_owner(path_property_id(name))
      OR EXISTS (SELECT 1 FROM property_files f WHERE f.file_url = name AND f.user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "storage: uploader or property owner removes" ON storage.objects;
CREATE POLICY "storage: uploader or property owner removes" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'property-files'
    AND (
      is_property_owner(path_property_id(name))
      OR EXISTS (SELECT 1 FROM property_files f WHERE f.file_url = name AND f.user_id = auth.uid())
    )
  );
