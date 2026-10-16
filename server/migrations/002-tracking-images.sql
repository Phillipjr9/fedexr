-- A private replacement for the two incompatible historical tracking_images layouts.
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
