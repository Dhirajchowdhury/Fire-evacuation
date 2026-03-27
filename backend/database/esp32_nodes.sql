-- Run this in Supabase SQL Editor
-- ESP32 sensor nodes table — simulates real hardware data

CREATE TABLE IF NOT EXISTS esp32_nodes (
  id              SERIAL PRIMARY KEY,
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  node_name       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'safe' CHECK (status IN ('safe', 'fire')),
  smoke_value     INTEGER DEFAULT 0,
  flame_status    INTEGER DEFAULT 0 CHECK (flame_status IN (0, 1)),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, node_name)
);

ALTER TABLE esp32_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esp32_admin_all" ON esp32_nodes
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()));

CREATE POLICY "esp32_public_read" ON esp32_nodes
  FOR SELECT TO anon USING (true);

-- Enable Realtime
ALTER TABLE esp32_nodes REPLICA IDENTITY FULL;

-- Trigger: auto-compute status from smoke_value + flame_status
CREATE OR REPLACE FUNCTION compute_node_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.smoke_value > 1500 OR NEW.flame_status = 1 THEN
    NEW.status := 'fire';
  ELSE
    NEW.status := 'safe';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS esp32_status_trigger ON esp32_nodes;
CREATE TRIGGER esp32_status_trigger
  BEFORE INSERT OR UPDATE ON esp32_nodes
  FOR EACH ROW EXECUTE FUNCTION compute_node_status();
