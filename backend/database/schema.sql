CREATE TABLE zones (
  id          SERIAL PRIMARY KEY,
  zone_id     TEXT UNIQUE NOT NULL,
  status      TEXT DEFAULT 'safe',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE alerts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id    TEXT NOT NULL,
  status     TEXT NOT NULL,
  message    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Supabase Realtime on zones table
ALTER TABLE zones REPLICA IDENTITY FULL;
