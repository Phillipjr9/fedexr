import { Client } from 'pg';

// Vercel function to accept a JSON POST { trackingNumber, dataUrl }
// Requires header 'x-admin-secret' to match process.env.ADMIN_SECRET

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminSecret = req.headers['x-admin-secret'] || req.headers['x-admin-secret'.toLowerCase()];
  if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { trackingNumber, dataUrl, eventType } = req.body || {};
  if (!trackingNumber || !dataUrl) return res.status(400).json({ error: 'Missing parameters' });

  // dataUrl should be like data:image/png;base64,AAA...
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: 'Invalid dataUrl' });

  const mime = match[1];
  const b64 = match[2];
  const buffer = Buffer.from(b64, 'base64');

  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) return res.status(500).json({ error: 'No database connection configured' });

  const client = new Client({ connectionString });
  try {
    await client.connect();
    // create table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracking_images (
        tracking_number TEXT PRIMARY KEY,
        mime TEXT,
        image BYTEA,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    // upsert per event_type
    await client.query(
      `INSERT INTO tracking_images (tracking_number, event_type, mime, image) VALUES ($1, $2, $3, $4)
       ON CONFLICT (tracking_number, event_type) DO UPDATE SET mime = EXCLUDED.mime, image = EXCLUDED.image, created_at = now()`,
      [trackingNumber, eventType || 'default', mime, buffer]
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'DB error' });
  } finally {
    await client.end();
  }
}
