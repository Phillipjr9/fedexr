import { readFile } from 'node:fs/promises';
import { MAX_IMAGE_BYTES, normalizeImage, trackingReference, imageEvent } from './image-data.js';

const sqlFile = new URL('../migrations/002-tracking-images.sql', import.meta.url);
async function legacySource(client) {
  const present = await client.query("SELECT to_regclass('tracking_images') AS source");
  if (!present.rows[0].source) return null;
  const result = await client.query(
    "SELECT attname FROM pg_attribute WHERE attrelid=to_regclass('tracking_images') AND attnum>0 AND NOT attisdropped",
  );
  const columns = new Set(result.rows.map((row) => row.attname));
  if (!['tracking_number', 'mime', 'image'].every((name) => columns.has(name)))
    throw new Error('Unrecognized legacy image schema. Operator review is required.');
  return {
    event: columns.has('event_type'),
    date: columns.has('created_at'),
    id: columns.has('id'),
  };
}
async function countLegacy(client, source) {
  if (!source) return 0;
  return Number(
    (await client.query('SELECT count(*) AS total FROM tracking_images')).rows[0].total,
  );
}
export async function imageMigrationPlan(pool) {
  const sql = await readFile(sqlFile, 'utf8');
  const source = await legacySource(pool);
  const legacyRows = await countLegacy(pool, source);
  return {
    sql,
    legacyRows,
    legacyLayout: source ? (source.event ? 'event-keyed' : 'reference-only') : 'absent',
    warning:
      'Valid legacy images will be decoded, stripped of metadata, and imported as administrators-only. Unsupported rows remain untouched in the archive. Stop old endpoint writes and back up the database before cutover.',
    async apply() {
      const client = await pool.connect();
      const summary = {
        imported: 0,
        alreadyPresent: 0,
        deferred: 0,
        legacyRows: 0,
        archivePreserved: true,
      };
      try {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('fedexr_image_migration_v1'))");
        await client.query(sql);
        const fresh = await legacySource(client);
        summary.legacyRows = await countLegacy(client, fresh);
        if (fresh) {
          for (let offset = 0; offset < summary.legacyRows; offset += 10) {
            const event = fresh.event ? 'event_type' : "'default'::text";
            const date = fresh.date ? 'created_at' : 'NULL::timestamptz';
            const order = `${fresh.date ? 'created_at DESC NULLS LAST,' : ''} tracking_number ASC${fresh.event ? ', event_type ASC NULLS LAST' : ''}${fresh.id ? ', id DESC' : ''}`;
            // Oversized source blobs are never materialized in the application process.
            const rows = await client.query(
              `SELECT tracking_number, ${event} AS event_type, mime, CASE WHEN octet_length(image) BETWEEN 1 AND ${MAX_IMAGE_BYTES} THEN image ELSE NULL END AS image, ${date} AS created_at FROM tracking_images ORDER BY ${order} LIMIT $1 OFFSET $2`,
              [10, offset],
            );
            for (const row of rows.rows) {
              let number, category, image;
              try {
                number = trackingReference(row.tracking_number);
                category = imageEvent(row.event_type ?? undefined);
                if (!row.image) throw new Error('Unsupported source size.');
                image = await normalizeImage(row.image, row.mime);
              } catch {
                summary.deferred++;
                continue;
              }
              const created =
                row.created_at && Number.isFinite(new Date(row.created_at).getTime())
                  ? new Date(row.created_at)
                  : new Date();
              const inserted = await client.query(
                'INSERT INTO fedexr_tracking_images(tracking_number,event_type,mime,image,width,height,sha256,owner_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,NULL,$8,$8) ON CONFLICT(tracking_number,event_type) DO NOTHING RETURNING tracking_number',
                [
                  number,
                  category,
                  image.mime,
                  image.bytes,
                  image.width,
                  image.height,
                  image.sha256,
                  created,
                ],
              );
              if (inserted.rows.length) summary.imported++;
              else summary.alreadyPresent++;
            }
          }
        }
        await client.query('COMMIT');
        return summary;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
