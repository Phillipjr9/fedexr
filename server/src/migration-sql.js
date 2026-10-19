// GENERATED FILE — do not edit by hand.
// Source of truth: server/migrations/*.sql
// Regenerate: npm --prefix server run gen:migrations
// `npm --prefix server run build` fails if this file has drifted.
//
// Inlined so migrations can run inside a serverless function, whose bundle does
// not include loose .sql files.

export const accountMigrationSQL = `-- Only application-prefixed tables are added. Existing tables are not replaced.
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
-- Reviewed additive public-shipment migration.
-- Application-managed shipment records only; no carrier booking or label data.
-- Public lookups expose only the fields selected by the API from this table.
CREATE TABLE IF NOT EXISTS fedexr_public_shipments (
  id TEXT PRIMARY KEY,
  tracking_number TEXT NOT NULL UNIQUE,
  owner_id TEXT REFERENCES fedexr_auth_user(id) ON DELETE SET NULL ON UPDATE CASCADE,
  recipient_label TEXT NOT NULL,
  origin_city TEXT NOT NULL,
  origin_region TEXT NOT NULL DEFAULT '',
  origin_postal_code TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  destination_region TEXT NOT NULL DEFAULT '',
  destination_postal_code TEXT NOT NULL,
  service TEXT NOT NULL,
  weight NUMERIC(6,2),
  ship_date DATE NOT NULL,
  estimated_delivery DATE,
  status TEXT NOT NULL,
  current_location TEXT NOT NULL,
  public_note TEXT NOT NULL DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL REFERENCES fedexr_auth_user(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fedexr_public_shipments_owner_idx
  ON fedexr_public_shipments(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS fedexr_public_shipments_tracking_idx
  ON fedexr_public_shipments(tracking_number);
-- Additive shipment-operations fields for administrator-created public shipments.
-- Internal notes are administrator-only and must never be returned by public tracking lookups.
ALTER TABLE fedexr_public_shipments
  ADD COLUMN IF NOT EXISTS internal_note TEXT NOT NULL DEFAULT '';
ALTER TABLE fedexr_public_shipments
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS fedexr_public_shipments_archived_idx
  ON fedexr_public_shipments(archived_at, updated_at DESC);
-- Automatic route progression settings for public shipments (additive).
ALTER TABLE fedexr_public_shipments
  ADD COLUMN IF NOT EXISTS auto_progress_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE fedexr_public_shipments
  ADD COLUMN IF NOT EXISTS auto_progress_interval_minutes integer NOT NULL DEFAULT 5;
ALTER TABLE fedexr_public_shipments
  ADD COLUMN IF NOT EXISTS auto_progress_next_at timestamptz;
`;

export const imageMigrationSQL = `-- A private replacement for the two incompatible historical tracking_images layouts.
-- The old table is not altered or dropped. The operator-reviewed importer copies valid rows.
CREATE TABLE IF NOT EXISTS fedexr_tracking_images (
  tracking_number TEXT NOT NULL CHECK (tracking_number = btrim(tracking_number) AND tracking_number ~ '^[A-Za-z0-9 -]{4,40}$' AND tracking_number ~ '[A-Za-z0-9]'),
  event_type TEXT NOT NULL DEFAULT 'default' CHECK (event_type IN ('default','in_transit','delivered','other')),
  mime TEXT NOT NULL CHECK (mime IN ('image/png','image/jpeg')),
  image BYTEA NOT NULL CHECK (octet_length(image) > 0 AND octet_length(image) <= 2097152),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 8192),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 8192 AND width::bigint * height <= 16000000),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  owner_id TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tracking_number, event_type)
);
CREATE INDEX IF NOT EXISTS fedexr_tracking_images_owner ON fedexr_tracking_images(owner_id);
CREATE TABLE IF NOT EXISTS fedexr_image_limits (
  key TEXT PRIMARY KEY, window_start BIGINT NOT NULL, hits INTEGER NOT NULL
);
-- Legacy key-only installations need not have the account schema yet.
-- Re-run the image migration after adding accounts to install these foreign keys.
DO $$ BEGIN
  IF to_regclass('fedexr_auth_user') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'fedexr_tracking_images'::regclass AND conname = 'fedexr_tracking_images_owner_fk') THEN
      ALTER TABLE fedexr_tracking_images ADD CONSTRAINT fedexr_tracking_images_owner_fk FOREIGN KEY (owner_id) REFERENCES fedexr_auth_user(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'fedexr_tracking_images'::regclass AND conname = 'fedexr_tracking_images_created_fk') THEN
      ALTER TABLE fedexr_tracking_images ADD CONSTRAINT fedexr_tracking_images_created_fk FOREIGN KEY (created_by) REFERENCES fedexr_auth_user(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'fedexr_tracking_images'::regclass AND conname = 'fedexr_tracking_images_updated_fk') THEN
      ALTER TABLE fedexr_tracking_images ADD CONSTRAINT fedexr_tracking_images_updated_fk FOREIGN KEY (updated_by) REFERENCES fedexr_auth_user(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
`;

export const migrationSourceFiles = {
  "workspace": "001-workspace.sql",
  "trackingImages": "002-tracking-images.sql",
  "publicShipments": "003-public-shipments.sql",
  "publicShipmentOperations": "004-public-shipment-operations.sql",
  "publicShipmentAutoProgress": "005-public-shipment-auto-progress.sql"
};
