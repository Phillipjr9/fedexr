-- Create core tables for the FedEx replica app
-- Run this once (or via the provided migrate script). Statements are idempotent.

-- Users table (customers)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Admins table (for storing admin accounts, password hashes recommended)
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shipments table
CREATE TABLE IF NOT EXISTS shipments (
  tracking_number TEXT PRIMARY KEY,
  user_id TEXT,
  service_id TEXT,
  status TEXT,
  estimated_delivery TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Shipment events / history
CREATE TABLE IF NOT EXISTS shipment_events (
  id SERIAL PRIMARY KEY,
  tracking_number TEXT REFERENCES shipments(tracking_number) ON DELETE CASCADE,
  event_time TIMESTAMPTZ DEFAULT now(),
  location TEXT,
  status TEXT,
  details TEXT
);

-- Tracking images (image stored as bytea). For production, prefer object storage and store URLs.
CREATE TABLE IF NOT EXISTS tracking_images (
  tracking_number TEXT PRIMARY KEY,
  mime TEXT,
  image BYTEA,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: index for faster lookup by created_at
CREATE INDEX IF NOT EXISTS idx_shipment_events_tracking_time ON shipment_events(tracking_number, event_time);

-- Addresses (user addresses / saved addresses)
CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  label TEXT,
  street TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Packages / package details attached to shipments (one shipment may have multiple items)
CREATE TABLE IF NOT EXISTS shipment_packages (
  id SERIAL PRIMARY KEY,
  tracking_number TEXT REFERENCES shipments(tracking_number) ON DELETE CASCADE,
  weight_oz INTEGER,
  length_in INTEGER,
  width_in INTEGER,
  height_in INTEGER,
  packaging_type TEXT,
  description TEXT,
  declared_value_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payment transactions
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  shipment_tracking TEXT REFERENCES shipments(tracking_number) ON DELETE SET NULL,
  user_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  provider TEXT,
  provider_charge_id TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  user_id TEXT,
  amount_cents INTEGER NOT NULL,
  status TEXT,
  issued_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- Rate quotes cache
CREATE TABLE IF NOT EXISTS rate_quotes (
  id SERIAL PRIMARY KEY,
  quote_key TEXT UNIQUE NOT NULL,
  from_postal TEXT,
  to_postal TEXT,
  weight_oz INTEGER,
  quotes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Returns / claims
CREATE TABLE IF NOT EXISTS returns (
  id SERIAL PRIMARY KEY,
  shipment_tracking TEXT REFERENCES shipments(tracking_number) ON DELETE SET NULL,
  user_id TEXT,
  reason TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Delivery preferences / Delivery Manager enrollment
CREATE TABLE IF NOT EXISTS delivery_preferences (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  allow_redirect BOOLEAN DEFAULT false,
  signature_required BOOLEAN DEFAULT false,
  leave_at_door BOOLEAN DEFAULT false,
  preferred_location TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Labels (PDF or image labels stored as bytea or URL)
CREATE TABLE IF NOT EXISTS shipping_labels (
  id SERIAL PRIMARY KEY,
  shipment_tracking TEXT REFERENCES shipments(tracking_number) ON DELETE CASCADE,
  content BYTEA,
  mime TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications (email/sms history)
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  type TEXT,
  channel TEXT,
  recipient TEXT,
  body TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT
);

-- Sessions (web sessions or tokens)
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
