-- Only application-prefixed tables are added. Existing tables are not replaced.
-- The auth migration runs first and creates fedexr_auth_user.
CREATE TABLE IF NOT EXISTS fedexr_addresses (
  id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES fedexr_auth_user(id) ON DELETE CASCADE,
  label TEXT NOT NULL, name TEXT NOT NULL, street TEXT NOT NULL, city TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '', postal_code TEXT NOT NULL, country TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fedexr_addresses_owner ON fedexr_addresses(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS fedexr_addresses_one_default ON fedexr_addresses(owner_id) WHERE is_default;
CREATE TABLE IF NOT EXISTS fedexr_plans (
  id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES fedexr_auth_user(id) ON DELETE CASCADE,
  reference TEXT NOT NULL DEFAULT '', recipient TEXT NOT NULL,
  from_zip TEXT NOT NULL, to_zip TEXT NOT NULL,
  weight NUMERIC(8,2) NOT NULL CHECK (weight >= 0.1 AND weight <= 150),
  service TEXT NOT NULL CHECK (service IN ('ground','2day','standard','priority','overnight','sameday')),
  ship_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','archived')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fedexr_plans_owner_updated ON fedexr_plans(owner_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS fedexr_activity (
  id UUID PRIMARY KEY, actor_id TEXT REFERENCES fedexr_auth_user(id) ON DELETE SET NULL,
  action TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fedexr_activity_time ON fedexr_activity(at DESC);
CREATE TABLE IF NOT EXISTS fedexr_settings (
  id TEXT PRIMARY KEY CHECK (id = 'workspace'),
  name TEXT NOT NULL DEFAULT 'Shipping workspace', announcements TEXT NOT NULL DEFAULT ''
);
INSERT INTO fedexr_settings(id) VALUES ('workspace') ON CONFLICT DO NOTHING;
