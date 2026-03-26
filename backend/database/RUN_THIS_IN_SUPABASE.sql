-- ============================================================
-- FireRoute — Complete Database Setup
-- Paste this ENTIRE file into Supabase SQL Editor and click Run
-- ============================================================

-- ─── 1. Drop existing tables (clean slate) ───────────────────────────────────
DROP TABLE IF EXISTS sensor_devices       CASCADE;
DROP TABLE IF EXISTS emergency_contacts   CASCADE;
DROP TABLE IF EXISTS incident_records     CASCADE;
DROP TABLE IF EXISTS drill_acknowledgements CASCADE;
DROP TABLE IF EXISTS drills               CASCADE;
DROP TABLE IF EXISTS announcements        CASCADE;
DROP TABLE IF EXISTS profiles             CASCADE;
DROP TABLE IF EXISTS workspaces           CASCADE;
DROP TABLE IF EXISTS zones                CASCADE;
DROP TABLE IF EXISTS alerts               CASCADE;

-- ─── 2. Create tables ────────────────────────────────────────────────────────

CREATE TABLE workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  location        TEXT,
  admin_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  floor_plan_url  TEXT,
  building_graph  JSONB,
  qr_code         TEXT,
  invite_link     TEXT UNIQUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT,
  phone        TEXT,
  role         TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'user')),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  admin_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  type         TEXT DEFAULT 'general',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE drills (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  triggered_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  ended_at            TIMESTAMPTZ,
  status              TEXT DEFAULT 'active',
  notes               TEXT,
  acknowledged_count  INTEGER DEFAULT 0
);

CREATE TABLE drill_acknowledgements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id        UUID REFERENCES drills(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE incident_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  zone_id         TEXT,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  evacuation_path JSONB,
  total_alerts    INTEGER DEFAULT 0,
  resolved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes           TEXT
);

CREATE TABLE emergency_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  role         TEXT,
  phone        TEXT NOT NULL,
  type         TEXT CHECK (type IN ('fire', 'ambulance', 'police', 'manager', 'other'))
);

CREATE TABLE sensor_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  device_id       TEXT UNIQUE NOT NULL,
  zone_id         TEXT,
  status          TEXT DEFAULT 'online',
  last_ping       TIMESTAMPTZ DEFAULT NOW(),
  battery_level   INTEGER,
  signal_strength INTEGER
);

CREATE TABLE zones (
  id           SERIAL PRIMARY KEY,
  zone_id      TEXT UNIQUE NOT NULL,
  status       TEXT DEFAULT 'safe',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id    TEXT NOT NULL,
  status     TEXT NOT NULL,
  message    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. Enable Realtime ───────────────────────────────────────────────────────
ALTER TABLE workspaces     REPLICA IDENTITY FULL;
ALTER TABLE announcements  REPLICA IDENTITY FULL;
ALTER TABLE drills         REPLICA IDENTITY FULL;
ALTER TABLE sensor_devices REPLICA IDENTITY FULL;
ALTER TABLE zones          REPLICA IDENTITY FULL;

-- ─── 4. Enable RLS ───────────────────────────────────────────────────────────
ALTER TABLE workspaces           ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE drills               ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_devices       ENABLE ROW LEVEL SECURITY;

-- ─── 5. RLS Policies ─────────────────────────────────────────────────────────

-- profiles: users can read/write their own row
CREATE POLICY "profiles_self" ON profiles
  FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- workspaces: admin can do everything on their workspace
CREATE POLICY "workspaces_insert" ON workspaces
  FOR INSERT TO authenticated WITH CHECK (admin_id = auth.uid());

CREATE POLICY "workspaces_select" ON workspaces
  FOR SELECT TO authenticated
  USING (admin_id = auth.uid() OR id IN (
    SELECT workspace_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "workspaces_update" ON workspaces
  FOR UPDATE TO authenticated
  USING (admin_id = auth.uid()) WITH CHECK (admin_id = auth.uid());

CREATE POLICY "workspaces_delete" ON workspaces
  FOR DELETE TO authenticated USING (admin_id = auth.uid());

-- announcements
CREATE POLICY "ann_admin" ON announcements FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()));

-- drills
CREATE POLICY "drills_admin" ON drills FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()));

-- drill_acknowledgements
CREATE POLICY "drill_ack_self" ON drill_acknowledgements FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- incident_records
CREATE POLICY "incidents_admin" ON incident_records FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()));

-- emergency_contacts
CREATE POLICY "emergency_admin" ON emergency_contacts FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()));

-- sensor_devices
CREATE POLICY "sensors_admin" ON sensor_devices FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()));

-- ─── 6. Auto-create profile on signup ────────────────────────────────────────
-- Runs with SECURITY DEFINER so it bypasses RLS
-- This is what makes signup work without "Database error saving new user"

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
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

-- ─── 7. Seed zones ───────────────────────────────────────────────────────────
INSERT INTO zones (zone_id, status) VALUES
  ('A', 'safe'),
  ('B', 'safe'),
  ('C', 'safe'),
  ('D', 'safe')
ON CONFLICT (zone_id) DO NOTHING;
