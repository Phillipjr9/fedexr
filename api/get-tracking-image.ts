import { Client } from 'pg';

// GET /api/get-tracking-image?number=...
// returns { dataUrl }
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const trackingNumber = req.query.number;
  if (!trackingNumber) return res.status(400).json({ error: 'Missing number' });

  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) return res.status(500).json({ error: 'No database connection configured' });

  const client = new Client({ connectionString });
  try {
    await client.connect();
    const r = await client.query('SELECT mime, image FROM tracking_images WHERE tracking_number = $1', [trackingNumber]);
    if (r.rowCount === 0) return res.status(404).json({ found: false });
    const row = r.rows[0];
    const mime = row.mime;
    const image: Buffer = row.image;
    const b64 = image.toString('base64');
    const dataUrl = `data:${mime};base64,${b64}`;
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    return res.status(200).json({ found: true, dataUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'DB error' });
  } finally {
    await client.end();
  }
}
