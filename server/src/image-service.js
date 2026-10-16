import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { HttpError, assert } from './validation.js';
import { currentActor } from './workspace.js';
import {
  decodeDataUrl,
  imageEvent,
  imageQuery,
  normalizeImage,
  storedImage,
  trackingReference,
} from './image-data.js';

const privateHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
  Pragma: 'no-cache',
  Expires: '0',
  Vary: 'Cookie, X-Admin-Secret, Origin',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify({ access: 'private', ...value }), {
    status,
    headers: { ...privateHeaders, ...extra },
  });
}
const digest = (value) => createHash('sha256').update(value).digest();
function matchesKey(provided, expected) {
  return (
    typeof provided === 'string' &&
    provided.length <= 256 &&
    timingSafeEqual(digest(provided), digest(expected))
  );
}
function metadata(row, admin) {
  return {
    number: row.tracking_number,
    event: row.event_type,
    mime: row.mime,
    width: row.width,
    height: row.height,
    byteLength: Buffer.byteLength(row.image),
    sha256: row.sha256,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    ...(admin ? { ownerId: row.owner_id } : {}),
  };
}
async function limit(pool, principal, operation, now) {
  const max = operation === 'read' ? 60 : operation === 'save' ? 10 : 20;
  const key = digest(
    `image:${principal.mode}:${principal.id || 'legacy-operator'}:${operation}`,
  ).toString('hex');
  const result = await pool.query(
    'INSERT INTO fedexr_image_limits(key,window_start,hits) VALUES($1,$2,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN fedexr_image_limits.window_start <= $3 THEN 1 ELSE LEAST(fedexr_image_limits.hits+1,$4) END, window_start=CASE WHEN fedexr_image_limits.window_start <= $3 THEN $2 ELSE fedexr_image_limits.window_start END RETURNING hits,window_start',
    [key, now, now - 60000, max + 1],
  );
  if (Number(result.rows[0].hits) > max) {
    const error = new HttpError(429, 'Too many attachment requests. Wait a minute and try again.');
    error.retryAfter = Math.max(
      1,
      Math.ceil((Number(result.rows[0].window_start) + 60000 - now) / 1000),
    );
    throw error;
  }
}
async function audit(client, actor, action) {
  const table = await client.query("SELECT to_regclass('fedexr_activity') AS activity");
  if (table.rows[0].activity)
    await client.query('INSERT INTO fedexr_activity(id,actor_id,action) VALUES($1,$2,$3)', [
      randomUUID(),
      actor.id,
      action,
    ]);
}
async function writeTransaction(pool, principal, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (principal.mode === 'session') {
      const result = await client.query(
        'SELECT role,banned,"emailVerified" FROM fedexr_auth_user WHERE id=$1 FOR SHARE',
        [principal.id],
      );
      assert(
        result.rows[0]?.role === 'admin' && !result.rows[0].banned && result.rows[0].emailVerified,
        'Administrator access is no longer active.',
        403,
      );
    }
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function createImageService({ pool, config, authentication, now = Date.now }) {
  async function authorize(request) {
    const key = request.headers.get('x-admin-secret');
    if (key !== null) {
      assert(
        config.allowLegacyImageKey,
        'Operator-key access is disabled. Use a server administrator account.',
        403,
      );
      assert(
        config.imageKeyValid && config.origin,
        'Operator image access needs a separate strong server key and application origin.',
        503,
      );
      assert(matchesKey(key, config.imageAdminSecret), 'Unauthorized.', 401);
      return { id: null, admin: true, mode: 'key' };
    }
    assert(
      authentication,
      'Private attachments require a configured server account service or explicitly enabled operator access.',
      503,
    );
    const actor = await currentActor(pool, authentication, request.headers);
    return { id: actor.id, admin: actor.role === 'admin', mode: 'session' };
  }
  async function ready() {
    assert(pool && config.databaseConfigured, 'The attachment database is not configured.', 503);
    const result = await pool.query(
      "SELECT to_regclass('fedexr_tracking_images') AS images, to_regclass('fedexr_image_limits') AS limits",
    );
    assert(
      result.rows[0]?.images && result.rows[0]?.limits,
      'Review and apply the private image migration before using attachments.',
      503,
    );
  }
  async function handle(request) {
    const requestId = randomUUID();
    try {
      const url = new URL(request.url);
      const read = url.pathname.replace(/\/+$/, '') === '/api/get-tracking-image';
      const allowed = read ? ['GET'] : ['POST', 'PATCH', 'DELETE'];
      if (!allowed.includes(request.method))
        return json({ error: 'Method not allowed.' }, 405, { Allow: allowed.join(', ') });
      if (request.method !== 'GET') {
        assert(
          config.origin &&
            request.headers.get('origin') === config.origin &&
            request.headers.get('sec-fetch-site') !== 'cross-site',
          'Attachment changes must come from the configured application origin.',
          403,
        );
        assert(
          request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ===
            'application/json',
          'Send attachment changes as JSON.',
          415,
        );
      }
      assert(
        !request.headers.has('content-encoding') ||
          request.headers.get('content-encoding') === 'identity',
        'Compressed attachment requests are not supported.',
        415,
      );
      const principal = await authorize(request);
      if (!read) assert(principal.admin, 'Only server administrators can manage attachments.', 403);
      await ready();
      if (read) {
        const { number, event } = imageQuery(url);
        await limit(pool, principal, 'read', now());
        // Reference knowledge and local plan ownership are not authorization.
        const result =
          principal.mode === 'key'
            ? await pool.query(
                'SELECT * FROM fedexr_tracking_images WHERE tracking_number=$1 AND event_type=$2',
                [number, event],
              )
            : await pool.query(
                'SELECT image.* FROM fedexr_tracking_images image WHERE image.tracking_number=$1 AND image.event_type=$2 AND EXISTS (SELECT 1 FROM fedexr_auth_user actor WHERE actor.id=$3 AND NOT coalesce(actor.banned,false) AND actor."emailVerified" AND (actor.role=\'admin\' OR image.owner_id=actor.id))',
                [number, event, principal.id],
              );
        if (!result.rows.length) return json({ found: false }, 404);
        const row = result.rows[0];
        const bytes = await storedImage(row);
        return json({
          found: true,
          dataUrl: `data:${row.mime};base64,${bytes.toString('base64')}`,
          attachment: metadata(row, principal.admin),
        });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        throw new HttpError(400, 'Send a valid JSON object.');
      }
      assert(body && typeof body === 'object' && !Array.isArray(body), 'Send a JSON object.');
      const number = trackingReference(body.trackingNumber);
      const event = imageEvent(body.eventType);
      await limit(pool, principal, request.method === 'DELETE' ? 'remove' : 'save', now());
      if (request.method === 'DELETE') {
        const removed = await writeTransaction(pool, principal, async (client) => {
          const result = await client.query(
            'DELETE FROM fedexr_tracking_images WHERE tracking_number=$1 AND event_type=$2 RETURNING tracking_number',
            [number, event],
          );
          if (result.rows.length)
            await audit(client, principal, 'Application image attachment removed');
          return result.rows.length > 0;
        });
        return json({ ok: true, removed });
      }
      let ownerId = body.ownerId === undefined ? principal.id : body.ownerId;
      assert(
        ownerId === null || (typeof ownerId === 'string' && /^[-_a-zA-Z0-9]{1,128}$/.test(ownerId)),
        'Choose a valid account or administrators-only visibility.',
      );
      assert(
        principal.mode !== 'key' || ownerId === null,
        'Only a signed-in server administrator can assign an attachment to an account.',
        403,
      );
      if (request.method === 'PATCH') {
        assert(
          Object.hasOwn(body, 'ownerId') && principal.mode === 'session',
          'Visibility changes require a signed-in server administrator and an explicit account selection.',
          403,
        );
        const row = await writeTransaction(pool, principal, async (client) => {
          if (ownerId !== null) {
            const owner = await client.query(
              'SELECT id FROM fedexr_auth_user WHERE id=$1 AND NOT coalesce(banned,false) FOR KEY SHARE',
              [ownerId],
            );
            assert(owner.rows.length, 'Choose an existing active account.');
          }
          const result = await client.query(
            'UPDATE fedexr_tracking_images SET owner_id=$1,updated_by=$2,updated_at=now() WHERE tracking_number=$3 AND event_type=$4 RETURNING *',
            [ownerId, principal.id, number, event],
          );
          assert(result.rows.length, 'The attachment was not found.', 404);
          await audit(client, principal, 'Application image visibility updated');
          return result.rows[0];
        });
        return json({ ok: true, attachment: metadata(row, true) });
      }
      const decoded = decodeDataUrl(body.dataUrl);
      const image = await normalizeImage(decoded.bytes, decoded.mime);
      const row = await writeTransaction(pool, principal, async (client) => {
        if (ownerId !== null) {
          const owner = await client.query(
            'SELECT id FROM fedexr_auth_user WHERE id=$1 AND NOT coalesce(banned,false) FOR KEY SHARE',
            [ownerId],
          );
          assert(owner.rows.length, 'Choose an existing active account.');
        }
        const result = await client.query(
          'INSERT INTO fedexr_tracking_images(tracking_number,event_type,mime,image,width,height,sha256,owner_id,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) ON CONFLICT(tracking_number,event_type) DO UPDATE SET mime=EXCLUDED.mime,image=EXCLUDED.image,width=EXCLUDED.width,height=EXCLUDED.height,sha256=EXCLUDED.sha256,owner_id=EXCLUDED.owner_id,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING *',
          [
            number,
            event,
            image.mime,
            image.bytes,
            image.width,
            image.height,
            image.sha256,
            ownerId,
            principal.id,
          ],
        );
        await audit(client, principal, 'Private application image attachment saved');
        return result.rows[0];
      });
      return json({
        ok: true,
        attachment: metadata(row, true),
        dataUrl: `data:${image.mime};base64,${image.bytes.toString('base64')}`,
      });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 503;
      if (status >= 500 && config.production)
        console.error('image_request_failed', {
          requestId,
          code: typeof error.code === 'string' ? error.code : 'SERVICE_ERROR',
        });
      return json(
        {
          error:
            error instanceof HttpError
              ? error.message
              : 'The private attachment service is unavailable. Try again or contact the site owner.',
          requestId,
        },
        status,
        error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {},
      );
    }
  }
  return { handle };
}
