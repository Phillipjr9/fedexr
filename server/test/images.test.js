import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import sharp from 'sharp';
import { TestPool } from './database.js';
import { configuration } from '../src/config.js';
import { migrationPlan } from '../src/migrations.js';
import { imageMigrationPlan } from '../src/image-migrations.js';
import { createService } from '../src/service.js';
import { createImageService } from '../src/image-service.js';
import { nodeHandler } from '../src/http.js';
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_JSON_BYTES,
  decodeDataUrl,
  normalizeImage,
} from '../src/image-data.js';

const pool = new TestPool();
const key = 'TEST_ONLY_OPERATOR_IMAGE_KEY_WITH_RANDOM_LENGTH_12345';
const env = {
  DATABASE_URL: 'postgresql://test:test@localhost/test',
  AUTH_SECRET: randomBytes(32).toString('hex'),
  APP_ORIGIN: 'http://127.0.0.1:4302',
  SMTP_URL: 'smtp://localhost:1025',
  MAIL_FROM: 'test@example.test',
  NODE_ENV: 'test',
  ADMIN_SECRET: key,
};
const config = configuration(env);
const password = 'image-test-only-passphrase-42';
const addresses = {
  admin: 'image-admin@example.test',
  member: 'image-member@example.test',
  other: 'image-other@example.test',
};
const cookies = {};
const ids = {};
const messages = [];
let service;
let png;
let jpeg;
let dataUrl;
function request(path, method = 'GET', body, who = 'admin', extras = {}, selected = service) {
  return selected.handle(
    new Request(config.origin + path, {
      method,
      headers: {
        origin: config.origin,
        'content-type': 'application/json',
        ...(who ? { cookie: cookies[who] } : {}),
        ...extras,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}
const query = (number = 'PRIVATE-1001', event = 'delivered') =>
  `/api/get-tracking-image?number=${number}&event=${event}`;
const save = (extra = {}) => ({
  trackingNumber: 'PRIVATE-1001',
  eventType: 'delivered',
  dataUrl,
  ...extra,
});
const result = async (response) => ({ status: response.status, body: await response.json() });
async function upload(extra = {}) {
  const response = await request('/api/upload-tracking-image', 'POST', save(extra));
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}

before(async () => {
  await pool.engine.waitReady;
  const accounts = await migrationPlan(pool, config);
  await accounts.auth.runMigrations();
  await pool.engine.exec(accounts.sql);
  await (await imageMigrationPlan(pool)).apply();
  service = createService({
    pool,
    config,
    mailer: { send: async (message) => messages.push(message) },
  });
  png = await sharp({ create: { width: 24, height: 16, channels: 3, background: '#4d148c' } })
    .png()
    .toBuffer();
  jpeg = await sharp(png).jpeg().toBuffer();
  dataUrl = `data:image/png;base64,${png.toString('base64')}`;
  for (const [who, email] of Object.entries(addresses)) {
    const response = await request(
      '/api/auth/sign-up/email',
      'POST',
      { name: `Image ${who}`, email, password, callbackURL: config.origin + '/login' },
      null,
    );
    assert.equal(response.status, 200);
    await service.handle(new Request(messages.at(-1).text.match(/https?:\/\/\S+/)[0]));
    if (who === 'admin')
      await pool.query("UPDATE fedexr_auth_user SET role='admin' WHERE email=$1", [email]);
    const signed = await request('/api/auth/sign-in/email', 'POST', { email, password }, null);
    assert.equal(signed.status, 200);
    cookies[who] = signed.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    ids[who] = (
      await pool.query('SELECT id FROM fedexr_auth_user WHERE email=$1', [email])
    ).rows[0].id;
  }
});
beforeEach(async () => {
  await pool.engine.exec(
    "TRUNCATE fedexr_tracking_images, fedexr_image_limits, fedexr_activity, fedexr_plans, fedexr_auth_rate_limit; DROP TABLE IF EXISTS tracking_images; UPDATE fedexr_auth_user SET banned=false, \"emailVerified\"=true, role=CASE WHEN email='image-admin@example.test' THEN 'admin' ELSE 'user' END;",
  );
  service = createService({
    pool,
    config,
    mailer: { send: async (message) => messages.push(message) },
  });
  for (const [who, email] of Object.entries(addresses)) {
    const signed = await request('/api/auth/sign-in/email', 'POST', { email, password }, null);
    assert.equal(signed.status, 200);
    cookies[who] = signed.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
  }
});
after(async () => {
  await pool.end();
});

test('data URLs reject arbitrary MIME, malformed base64, empty data, wrong types, and oversized input', () => {
  for (const value of [
    null,
    {},
    [],
    3,
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:text/html;base64,PGgxPg==',
    'data:image/webp;base64,AAAA',
    'data:image/png;base64,AB==',
    'data:image/png;base64,AAA',
    'data:image/png;base64,AA\nAA',
    'data:image/png;base64,',
  ])
    assert.throws(() => decodeDataUrl(value));
  const large = `data:image/png;base64,${Buffer.alloc(MAX_IMAGE_BYTES + 1).toString('base64')}`;
  assert.throws(
    () => decodeDataUrl(large),
    (error) => error.status === 413,
  );
});

test('full image decoding rejects MIME spoofing and truncated/invalid image files', async () => {
  await assert.rejects(normalizeImage(png, 'image/jpeg'), (error) => error.status === 415);
  await assert.rejects(normalizeImage(Buffer.from('not an image'), 'image/png'));
  await assert.rejects(
    normalizeImage(jpeg.subarray(0, 60), 'image/jpeg'),
    (error) => error.status === 422,
  );
});

test('normalization removes EXIF metadata and prevents decompression-sized images', async () => {
  const withExif = await sharp(jpeg)
    .withMetadata({ exif: { IFD0: { Artist: 'Test private metadata' } } })
    .toBuffer();
  assert.ok((await sharp(withExif).metadata()).exif);
  const normalized = await normalizeImage(withExif, 'image/jpeg');
  assert.equal((await sharp(normalized.bytes).metadata()).exif, undefined);
  assert.equal(normalized.width, 24);
  assert.equal(normalized.height, 16);
  const bomb = await sharp({
    create: { width: 5000, height: 4000, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer();
  await assert.rejects(normalizeImage(bomb, 'image/png'), (error) => error.status === 422);
});

test('anonymous users and forged local flags cannot read or write private images', async () => {
  await upload();
  assert.equal((await request(query(), 'GET', undefined, null)).status, 401);
  assert.equal(
    (await request(query(), 'GET', undefined, null, { cookie: 'isAdmin=true;isLoggedIn=true' }))
      .status,
    401,
  );
  assert.equal((await request('/api/upload-tracking-image', 'POST', save(), 'member')).status, 403);
  assert.equal(
    (await request('/api/upload-tracking-image', 'DELETE', save(), 'member')).status,
    403,
  );
});

test('references are not authority: members can only read explicit assignments', async () => {
  const saved = await upload({ ownerId: ids.member });
  assert.equal(saved.access, 'private');
  assert.equal(saved.attachment.ownerId, ids.member);
  const own = await request(query(), 'GET', undefined, 'member');
  assert.equal(own.status, 200);
  assert.equal((await own.json()).dataUrl, saved.dataUrl);
  assert.equal((await request(query(), 'GET', undefined, 'other')).status, 404);
  const plan = {
    reference: 'PRIVATE-1001',
    recipient: 'Other Member',
    from: '10003',
    to: '90001',
    weight: '1',
    service: 'ground',
    shipDate: new Date().toISOString().slice(0, 10),
    notes: '',
  };
  assert.equal((await request('/api/workspace/plans', 'POST', plan, 'other')).status, 200);
  assert.equal((await request(query(), 'GET', undefined, 'other')).status, 404);
});

test('administrators-only visibility does not expose files to any member', async () => {
  await upload({ ownerId: null });
  assert.equal((await request(query())).status, 200);
  assert.equal((await request(query(), 'GET', undefined, 'member')).status, 404);
  assert.equal((await request(query(), 'GET', undefined, 'other')).status, 404);
});

test('owner assignment validates accounts and cannot be changed by a member', async () => {
  assert.equal(
    (await request('/api/upload-tracking-image', 'POST', save({ ownerId: 'unknown-account' })))
      .status,
    400,
  );
  await upload({ ownerId: ids.member });
  const changed = await request('/api/upload-tracking-image', 'PATCH', {
    trackingNumber: 'PRIVATE-1001',
    eventType: 'delivered',
    ownerId: ids.other,
  });
  assert.equal(changed.status, 200);
  assert.equal((await request(query(), 'GET', undefined, 'member')).status, 404);
  assert.equal((await request(query(), 'GET', undefined, 'other')).status, 200);
  assert.equal(
    (
      await request(
        '/api/upload-tracking-image',
        'PATCH',
        { trackingNumber: 'PRIVATE-1001', eventType: 'delivered', ownerId: ids.member },
        'member',
      )
    ).status,
    403,
  );
});

test('categories are independently upserted and reads default to the default category', async () => {
  await upload({ eventType: 'default', ownerId: ids.member });
  await upload({ eventType: 'delivered', ownerId: ids.member });
  await upload({ eventType: 'delivered', ownerId: ids.other });
  assert.equal(
    Number(
      (await pool.query('SELECT count(*) AS total FROM fedexr_tracking_images')).rows[0].total,
    ),
    2,
  );
  const response = await request(
    '/api/get-tracking-image?number=PRIVATE-1001',
    'GET',
    undefined,
    'member',
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).attachment.event, 'default');
  assert.equal((await request(query(), 'GET', undefined, 'member')).status, 404);
});

test('bad references, categories, duplicate queries, and malformed bodies are rejected', async () => {
  for (const number of ['', '---', '----', 'a'.repeat(41), '<script>', 'REF\u0000NUL'])
    assert.equal(
      (await request('/api/upload-tracking-image', 'POST', save({ trackingNumber: number })))
        .status,
      400,
    );
  for (const eventType of ['drop table', '', ['default'], {}])
    assert.equal(
      (await request('/api/upload-tracking-image', 'POST', save({ eventType }))).status,
      400,
    );
  assert.equal(
    (await request('/api/get-tracking-image?number=PRIVATE-1001&number=PRIVATE-1002')).status,
    400,
  );
  assert.equal(
    (await request('/api/get-tracking-image?number=PRIVATE-1001&event=default&event=other')).status,
    400,
  );
  assert.equal((await request('/api/upload-tracking-image', 'POST', [], 'admin')).status, 400);
});

test('origin, JSON media type, and allowed methods are enforced for mutations', async () => {
  assert.equal(
    (
      await request('/api/upload-tracking-image', 'POST', save(), 'admin', {
        origin: 'https://foreign.example',
      })
    ).status,
    403,
  );
  assert.equal(
    (await request('/api/upload-tracking-image', 'POST', save(), 'admin', { origin: '' })).status,
    403,
  );
  assert.equal(
    (
      await request('/api/upload-tracking-image', 'POST', save(), 'admin', {
        'content-type': 'text/plain',
      })
    ).status,
    415,
  );
  const wrong = await request('/api/get-tracking-image', 'POST', save());
  assert.equal(wrong.status, 405);
  assert.equal(wrong.headers.get('allow'), 'GET');
});

test('image responses are private and never have shared CDN caching headers', async () => {
  await upload();
  const response = await request(query());
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.ok(response.headers.get('vary').includes('Cookie'));
  const denied = await request(query(), 'GET', undefined, null);
  assert.ok(denied.headers.get('cache-control').includes('no-store'));
});

test('live role and account suspension changes apply to image authorization', async () => {
  await upload({ ownerId: ids.member });
  await pool.query("UPDATE fedexr_auth_user SET role='user' WHERE id=$1", [ids.admin]);
  assert.equal((await request('/api/upload-tracking-image', 'POST', save())).status, 403);
  assert.equal((await request(query())).status, 404);
  await pool.query('UPDATE fedexr_auth_user SET banned=true WHERE id=$1', [ids.member]);
  assert.equal((await request(query(), 'GET', undefined, 'member')).status, 401);
});

test('deletion is privileged and idempotent without altering carrier status or legacy rows', async () => {
  await upload();
  const body = { trackingNumber: 'PRIVATE-1001', eventType: 'delivered' };
  const removed = await result(await request('/api/upload-tracking-image', 'DELETE', body));
  assert.equal(removed.body.removed, true);
  const repeated = await result(await request('/api/upload-tracking-image', 'DELETE', body));
  assert.equal(repeated.body.removed, false);
  assert.equal((await request(query())).status, 404);
});

test('legacy operator keys are explicit, strong, separate, and cannot assign member ownership', async () => {
  assert.equal(
    (await request('/api/upload-tracking-image', 'POST', save(), null, { 'x-admin-secret': key }))
      .status,
    403,
  );
  const legacyConfig = configuration({ ...env, ALLOW_LEGACY_IMAGE_KEY: 'true' });
  const legacy = createService({ pool, config: legacyConfig, mailer: { send: async () => {} } });
  const headers = { 'x-admin-secret': key };
  const saved = await request('/api/upload-tracking-image', 'POST', save(), null, headers, legacy);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).attachment.ownerId, null);
  assert.equal((await request(query(), 'GET', undefined, null, headers, legacy)).status, 200);
  assert.equal(
    (
      await request(
        '/api/upload-tracking-image',
        'POST',
        save({ ownerId: ids.member }),
        null,
        headers,
        legacy,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request(query(), 'GET', undefined, null, { 'x-admin-secret': 'invalid-key' }, legacy))
      .status,
    401,
  );
  assert.equal(
    configuration({ ...env, ALLOW_LEGACY_IMAGE_KEY: 'true', ADMIN_SECRET: env.AUTH_SECRET })
      .imageKeyValid,
    false,
  );
  assert.equal(
    configuration({ ...env, ALLOW_LEGACY_IMAGE_KEY: 'true', ADMIN_SECRET: 'short' }).imageKeyValid,
    false,
  );
});

test('operator mode does not depend on mail or account configuration and never grants anonymous access', async () => {
  const legacyConfig = configuration({
    DATABASE_URL: env.DATABASE_URL,
    APP_ORIGIN: config.origin,
    ALLOW_LEGACY_IMAGE_KEY: 'true',
    ADMIN_SECRET: key,
  });
  assert.equal(legacyConfig.ready, false);
  const legacy = createService({ pool, config: legacyConfig, mailer: null });
  assert.equal(
    (
      await request(
        '/api/upload-tracking-image',
        'POST',
        save(),
        null,
        { 'x-admin-secret': key },
        legacy,
      )
    ).status,
    200,
  );
  assert.equal((await request(query(), 'GET', undefined, null, {}, legacy)).status, 503);
});

test('private image throttling is persisted, returns Retry-After, and resets after its window', async () => {
  await upload({ ownerId: ids.member });
  let clock = 1_000_000;
  const limited = createImageService({
    pool,
    config,
    authentication: service.authentication,
    now: () => clock,
  });
  let response;
  for (let index = 0; index < 61; index++)
    response = await request(query(), 'GET', undefined, 'member', {}, limited);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  clock += 60001;
  assert.equal((await request(query(), 'GET', undefined, 'member', {}, limited)).status, 200);
});

test('stored corruption is refused instead of being returned as an image data URL', async () => {
  await upload();
  await pool.query('UPDATE fedexr_tracking_images SET image=$1', [Buffer.from('invalid bytes')]);
  const response = await result(await request(query()));
  assert.equal(response.status, 422);
  assert.equal(response.body.dataUrl, undefined);
});

test('image requests do not create or upgrade database tables implicitly', async () => {
  await pool.engine.exec('DROP TABLE fedexr_tracking_images; DROP TABLE fedexr_image_limits;');
  try {
    assert.equal((await request('/api/upload-tracking-image', 'POST', save())).status, 503);
    assert.equal(
      (await pool.query("SELECT to_regclass('fedexr_tracking_images') AS value")).rows[0].value,
      null,
    );
  } finally {
    await (await imageMigrationPlan(pool)).apply();
  }
});

test('HTTP adapter accepts legitimate image JSON above 16 KB but rejects over-limit and compressed bodies', async () => {
  const server = createServer(nodeHandler(service, config));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const largeEnough = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        noise: { type: 'gaussian', mean: 128, sigma: 60 },
      },
    })
      .png()
      .toBuffer();
    const body = JSON.stringify(
      save({ dataUrl: `data:image/png;base64,${largeEnough.toString('base64')}` }),
    );
    assert.ok(body.length > 16384);
    const headers = {
      origin: config.origin,
      cookie: cookies.admin,
      'content-type': 'application/json',
    };
    assert.equal(
      (await fetch(base + '/api/upload-tracking-image', { method: 'POST', headers, body })).status,
      200,
    );
    assert.equal(
      (
        await fetch(base + '/api/upload-tracking-image', {
          method: 'POST',
          headers,
          body: 'x'.repeat(MAX_IMAGE_JSON_BYTES + 1),
        })
      ).status,
      413,
    );
    assert.equal(
      (
        await fetch(base + '/api/upload-tracking-image', {
          method: 'POST',
          headers: { ...headers, 'content-encoding': 'gzip' },
          body: '{}',
        })
      ).status,
      415,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('reference-only legacy tables import privately without changing their schema or bytes', async () => {
  await pool.engine.exec(
    'CREATE TABLE tracking_images(tracking_number TEXT PRIMARY KEY,mime TEXT,image BYTEA,created_at TIMESTAMPTZ DEFAULT now());',
  );
  await pool.query('INSERT INTO tracking_images(tracking_number,mime,image) VALUES($1,$2,$3)', [
    'LEGACY-1001',
    'image/png',
    png,
  ]);
  const plan = await imageMigrationPlan(pool);
  assert.equal(plan.legacyLayout, 'reference-only');
  const summary = await plan.apply();
  assert.equal(summary.imported, 1);
  const original = (await pool.query('SELECT * FROM tracking_images')).rows[0];
  assert.equal(original.event_type, undefined);
  assert.ok(Buffer.from(original.image).equals(png));
  const copied = (await pool.query('SELECT event_type,owner_id FROM fedexr_tracking_images'))
    .rows[0];
  assert.deepEqual(copied, { event_type: 'default', owner_id: null });
  assert.equal(
    (await request(query('LEGACY-1001', 'default'), 'GET', undefined, 'member')).status,
    404,
  );
});

test('event-keyed legacy tables import valid rows, preserve unsafe archives, and never overwrite newer assignments', async () => {
  await pool.engine.exec(
    "CREATE TABLE tracking_images(id BIGSERIAL PRIMARY KEY,tracking_number TEXT NOT NULL,event_type TEXT NOT NULL DEFAULT 'default',mime TEXT,image BYTEA,created_at TIMESTAMPTZ DEFAULT now(),UNIQUE(tracking_number,event_type));",
  );
  for (const row of [
    ['PRIVATE-1001', 'delivered', 'image/png', png],
    ['LEGACY-2002', 'in_transit', 'image/png', png],
    ['LEGACY-2003', 'default', 'image/svg+xml', Buffer.from('<svg/>')],
    ['LEGACY-2004', 'default', 'image/jpeg', Buffer.from('invalid')],
  ])
    await pool.query(
      'INSERT INTO tracking_images(tracking_number,event_type,mime,image) VALUES($1,$2,$3,$4)',
      row,
    );
  await upload({ ownerId: ids.member });
  const summary = await (await imageMigrationPlan(pool)).apply();
  assert.equal(summary.imported, 1);
  assert.equal(summary.alreadyPresent, 1);
  assert.equal(summary.deferred, 2);
  assert.equal(
    Number((await pool.query('SELECT count(*) AS count FROM tracking_images')).rows[0].count),
    4,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT owner_id FROM fedexr_tracking_images WHERE tracking_number='PRIVATE-1001'",
      )
    ).rows[0].owner_id,
    ids.member,
  );
  const repeated = await (await imageMigrationPlan(pool)).apply();
  assert.equal(repeated.imported, 0);
  assert.equal(repeated.alreadyPresent, 2);
});
