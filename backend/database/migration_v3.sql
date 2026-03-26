-- ============================================================
-- FireRoute — Schema Migration v3
-- Fixes RLS policies for OAuth admin onboarding flow.
-- Run this in Supabase SQL Editor AFTER migration_v2.sql
-- ============================================================

-- ─── Fix: allow workspace insert for any authenticated user ──────────────────
-- The v2 policy already allows this (admin_id = auth.uid()), but we add
-- an explicit INSERT policy to be safe with Supabase's policy evaluation.

DROP POLICY IF EXISTS "workspaces_admin_all" ON workspaces;

-- Separate policies for clarity (Supabase evaluates INSERT/SELECT/UPDATE separately)
CREATE POLICY "workspaces_insert"
  ON workspaces
  FOR INSERT
  TO authenticated
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "workspaces_select_own"
  ON workspaces
  FOR SELECT
  TO authenticated
  USING (
    admin_id = auth.uid()
    OR id IN (SELECT workspace_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "workspaces_update_own"
  ON workspaces
  FOR UPDATE
  TO authenticated
  USING     (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "workspaces_delete_own"
  ON workspaces
  FOR DELETE
  TO authenticated
  USING (admin_id = auth.uid());

-- ─── Fix: profiles upsert must work for new users ────────────────────────────
-- The existing profiles_self_all policy covers this, but ensure it exists.
-- If you get "new row violates RLS" on profiles upsert, run this:

DROP POLICY IF EXISTS "profiles_self_all" ON profiles;

CREATE POLICY "profiles_self_all"
  ON profiles
  FOR ALL
  TO authenticated
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ─── Auto-create profile trigger (STRONGLY RECOMMENDED) ──────────────────────
-- This creates a minimal profile row the moment a user signs up via ANY method
-- (email, Google, etc.), bypassing RLS entirely (SECURITY DEFINER).
-- The setup page then UPDATEs it with role, workspace_id, etc.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'admin'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
