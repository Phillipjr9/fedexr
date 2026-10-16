-- Additive shipment-operations fields for administrator-created public shipments.
-- Internal notes are administrator-only and must never be returned by public tracking lookups.
ALTER TABLE fedexr_public_shipments
  ADD COLUMN IF NOT EXISTS internal_note TEXT NOT NULL DEFAULT '';
ALTER TABLE fedexr_public_shipments
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS fedexr_public_shipments_archived_idx
  ON fedexr_public_shipments(archived_at, updated_at DESC);
