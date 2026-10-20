-- Exact delivery place for the tracking page map, entered by an administrator.
-- The tracking page uses it only to position the map pin; additive and
-- idempotent like every other migration in this series.
ALTER TABLE fedexr_public_shipments
  ADD COLUMN IF NOT EXISTS destination_street TEXT NOT NULL DEFAULT '';
