-- ============================================================
-- FireRoute — Schema Migration v2
-- Adds multi-tenant workspace tables on top of existing schema.
-- DO NOT run schema.sql again — existing tables are preserved.
-- ============================================================

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  location        TEXT,
  admin_id        UUID REFERENCES auth.users(id),
  floor_plan_url  TEXT,
  building_graph  JSONB,
  qr_code         TEXT,
  invite_link     TEXT UNIQUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name    TEXT,
  phone        TEXT,
  role         TEXT CHECK (role IN ('admin', 'user')),
  workspace_id UUID REFERENCES workspaces(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE announcements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  admin_id     UUID REFERENCES auth.users(id),
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  type         TEXT DEFAULT 'general',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE drills (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID REFERENCES workspaces(id),
  triggered_by        UUID REFERENCES auth.users(id),
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  ended_at            TIMESTAMPTZ,
  status              TEXT DEFAULT 'active',
  notes               TEXT,
  acknowledged_count  INTEGER DEFAULT 0
);

CREATE TABLE drill_acknowledgements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drill_id        UUID REFERENCES drills(id),
  user_id         UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE incident_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES workspaces(id),
  zone_id         TEXT,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  evacuation_path JSONB,
  total_alerts    INTEGER DEFAULT 0,
  resolved_by     UUID REFERENCES auth.users(id),
  notes           TEXT
);

CREATE TABLE emergency_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  name         TEXT NOT NULL,
  role         TEXT,
  phone        TEXT NOT NULL,
  type         TEXT CHECK (type IN ('fire', 'ambulance', 'police', 'manager', 'other'))
);

CREATE TABLE sensor_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES workspaces(id),
  device_id       TEXT UNIQUE NOT NULL,
  zone_id         TEXT,
  status          TEXT DEFAULT 'online',
  last_ping       TIMESTAMPTZ DEFAULT NOW(),
  battery_level   INTEGER,
  signal_strength INTEGER
);

-- ─── Realtime ─────────────────────────────────────────────────────────────────

ALTER TABLE workspaces     REPLICA IDENTITY FULL;
ALTER TABLE announcements  REPLICA IDENTITY FULL;
ALTER TABLE drills         REPLICA IDENTITY FULL;
ALTER TABLE sensor_devices REPLICA IDENTITY FULL;

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE workspaces           ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE drills               ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_devices       ENABLE ROW LEVEL SECURITY;

-- ─── workspaces policies ─────────────────────────────────────────────────────

-- Admin: full access to their own workspace
CREATE POLICY "workspaces_admin_all"
  ON workspaces
  FOR ALL
  TO authenticated
  USING     (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

-- Member: read the workspace they belong to
CREATE POLICY "workspaces_member_read"
  ON workspaces
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── profiles policies ───────────────────────────────────────────────────────

-- Users: read and write their own profile
CREATE POLICY "profiles_self_all"
  ON profiles
  FOR ALL
  TO authenticated
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin: read all profiles in their workspace
CREATE POLICY "profiles_admin_read"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE admin_id = auth.uid()
    )
  );

-- ─── announcements policies ──────────────────────────────────────────────────

-- Admin: full access in their workspace
CREATE POLICY "announcements_admin_all"
  ON announcements
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE admin_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE admin_id = auth.uid()
    )
  );

-- Members: read only in their workspace
CREATE POLICY "announcements_member_read"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── drills policies ─────────────────────────────────────────────────────────

-- Admin: full access in their workspace
CREATE POLICY "drills_admin_all"
  ON drills
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE admin_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE admin_id = auth.uid()
    )
  );

-- Members: read in their workspace
CREATE POLICY "drills_member_read"
  ON drills
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── drill_acknowledgements policies ─────────────────────────────────────────

-- Users: insert and read their own acknowledgements
CREATE POLICY "drill_ack_self_all"
  ON drill_acknowledgements
  FOR ALL
  TO authenticated
  USING     (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin: read all acknowledgements for drills in their workspace
CREATE POLICY "drill_ack_admin_read"
  ON drill_acknowledgements
  FOR SELECT
  TO authenticated
  USING (
    drill_id IN (
      SELECT d.id FROM drills d
      JOIN workspaces w ON w.id = d.workspace_id
      WHERE w.admin_id = auth.uid()
    )
  );

-- ─── incident_records policies ───────────────────────────────────────────────

-- Admin: full access in their workspace
CREATE POLICY "incidents_admin_all"
  ON incident_records
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE admin_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE admin_id = auth.uid()
    )
  );

-- Members: read only in their workspace
CREATE POLICY "incidents_member_read"
  ON incident_records
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── emergency_contacts policies ─────────────────────────────────────────────

-- Admin: full access in their workspace
CREATE POLICY "emergency_contacts_admin_all"
  ON emergency_contacts
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE admin_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE admin_id = auth.uid()
    )
  );

-- Members: read only in their workspace
CREATE POLICY "emergency_contacts_member_read"
  ON emergency_contacts
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── sensor_devices policies ─────────────────────────────────────────────────

-- Admin: full access in their workspace
CREATE POLICY "sensor_devices_admin_all"
  ON sensor_devices
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE admin_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE admin_id = auth.uid()
    )
  );

-- Members: read only in their workspace
CREATE POLICY "sensor_devices_member_read"
  ON sensor_devices
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ─── Auto-create profile on signup (optional but recommended) ────────────────
-- This trigger creates a minimal profile row when a new auth user is created.
-- It runs with elevated privileges so it bypasses RLS.
-- The app can then UPDATE the profile with full_name, role, etc. after signup.
--
-- To apply this in Supabase: run in SQL Editor
--
-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS trigger AS $$
-- BEGIN
--   INSERT INTO public.profiles (id, role)
--   VALUES (NEW.id, 'user')
--   ON CONFLICT (id) DO NOTHING;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- CREATE OR REPLACE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
