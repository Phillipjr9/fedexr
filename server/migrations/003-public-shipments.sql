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
