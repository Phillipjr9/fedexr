-- Automatic route progression settings for public shipments (additive).
ALTER TABLE fedexr_public_shipments
  ADD COLUMN IF NOT EXISTS auto_progress_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE fedexr_public_shipments
  ADD COLUMN IF NOT EXISTS auto_progress_interval_minutes integer NOT NULL DEFAULT 5;
ALTER TABLE fedexr_public_shipments
  ADD COLUMN IF NOT EXISTS auto_progress_next_at timestamptz;
