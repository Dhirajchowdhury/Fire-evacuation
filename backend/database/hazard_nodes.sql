-- Run this in Supabase SQL Editor
-- Adds hazard_nodes table for per-node fire simulation

CREATE TABLE IF NOT EXISTS hazard_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  node_id     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'safe' CHECK (status IN ('safe', 'fire')),
  severity    INTEGER DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, node_id)
);

ALTER TABLE hazard_nodes ENABLE ROW LEVEL SECURITY;

-- Admin can read/write their own workspace's hazard nodes
CREATE POLICY "hazard_admin_all" ON hazard_nodes
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE admin_id = auth.uid()));

-- Public read (for /map/[workspaceId] page — no login required)
CREATE POLICY "hazard_public_read" ON hazard_nodes
  FOR SELECT TO anon
  USING (true);

-- Enable Realtime
ALTER TABLE hazard_nodes REPLICA IDENTITY FULL;
