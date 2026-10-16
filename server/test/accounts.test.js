import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { TestPool } from './database.js';
import { configuration, safeConfiguration } from '../src/config.js';
import { migrationPlan } from '../src/migrations.js';
import { createService } from '../src/service.js';
import { nodeHandler } from '../src/http.js';

const pool = new TestPool();
const config = configuration({
  DATABASE_URL: 'postgresql://test:test@localhost/test',
  AUTH_SECRET: randomBytes(32).toString('hex'),
  APP_ORIGIN: 'http://127.0.0.1:4301',
  SMTP_URL: 'smtp://localhost:1025',
  MAIL_FROM: 'test@example.test',
  NODE_ENV: 'test',
});
const password = 'test-only-workspace-passphrase-42';
let service;
let messages;
function request(path, method = 'GET', body, cookie = '', origin = config.origin) {
  return service.handle(
    new Request(config.origin + path, {
      method,
      headers: { origin, 'content-type': 'application/json', cookie, 'x-real-ip': '127.0.0.1' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}
async function json(response) {
  return {
    status: response.status,
    body: await response.json(),
    cookies: response.headers.getSetCookie(),
  };
}
const cookieFrom = (response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
async function signup(email = 'member@example.test', verify = true, extra = {}) {
  const response = await request('/api/auth/sign-up/email', 'POST', {
    name: 'Test Member',
    email,
    password,
    callbackURL: `${config.origin}/login?verified=1`,
    ...extra,
  });
  assert.equal(response.status, 200);
  if (verify) {
    const link = messages
      .findLast((message) => message.to === email)
      ?.text.match(/https?:\/\/\S+/)?.[0];
    assert.ok(link);
    const verified = await service.handle(new Request(link));
    assert.equal(verified.status, 302);
  }
}
async function signin(email = 'member@example.test', value = password) {
  const response = await request('/api/auth/sign-in/email', 'POST', { email, password: value });
  assert.equal(response.status, 200, await response.clone().text());
  return { cookie: cookieFrom(response), response };
}
async function user(email = 'member@example.test') {
  await signup(email);
  return signin(email);
}
async function owner() {
  await signup('owner@example.test');
  await pool.query("UPDATE fedexr_auth_user SET role = 'admin' WHERE email = $1", [
    'owner@example.test',
  ]);
  return signin('owner@example.test');
}
const plan = () => ({
  reference: 'LOCAL-12345',
  recipient: 'Test Recipient',
  from: '10003',
  to: '90001',
  weight: '4.2',
  service: 'ground',
  shipDate: new Date().toISOString().slice(0, 10),
  notes: 'Planning only—not a carrier booking.',
});
const address = (label = 'Home') => ({
  label,
  name: 'Test Recipient',
  street: '1 Example Street',
  city: 'New York',
  region: 'NY',
  postalCode: '10003',
  country: 'United States',
  isDefault: false,
});
const publicShipment = (userId) => ({
  trackingNumber: 'SERVER-1001',
  userId,
  recipientLabel: 'Test Recipient',
  originCity: 'New York',
  originRegion: 'NY',
  originPostalCode: '10001',
  destinationCity: 'Boston',
  destinationRegion: 'MA',
  destinationPostalCode: '02101',
  service: 'ground',
  weight: '4.2',
  shipDate: '2026-04-01',
  estimatedDelivery: '2026-04-05',
  status: 'in_transit',
  currentLocation: 'NEW YORK, NY',
  publicNote: 'Moving to Boston.',
  isPublic: true,
});

before(async () => {
  await pool.engine.waitReady;
  await pool.engine.exec(
    "CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT); INSERT INTO users(name) VALUES ('Existing record');",
  );
  const migration = await migrationPlan(pool, config);
  await migration.auth.runMigrations();
  await pool.engine.exec(migration.sql);
});
beforeEach(async () => {
  await pool.engine.exec(
    "TRUNCATE fedexr_auth_user, fedexr_auth_account, fedexr_auth_session, fedexr_auth_verification, fedexr_auth_rate_limit, fedexr_activity, fedexr_addresses, fedexr_plans, fedexr_public_shipments CASCADE; UPDATE fedexr_settings SET name='Shipping workspace', announcements='';",
  );
  messages = [];
  service = createService({
    pool,
    config,
    mailer: {
      send: async (message) => {
        messages.push(message);
      },
    },
  });
});
after(async () => {
  await pool.end();
});

test('configuration fails closed and status never exposes connection strings or secrets', async () => {
  const missing = configuration({});
  assert.equal(missing.ready, false);
  assert.equal(JSON.stringify(safeConfiguration(config)).includes(config.secret), false);
  assert.equal(
    configuration({ ...process.env, APP_ORIGIN: 'http://public.example', NODE_ENV: 'production' })
      .ready,
    false,
  );
  const disabled = createService({ pool: null, config: missing, mailer: null });
  const status = await disabled.handle(new Request('http://localhost/api/account/status'));
  assert.equal(status.status, 200);
  assert.equal((await status.json()).configured, false);
  const signup = await disabled.handle(
    new Request('http://localhost/api/auth/sign-up/email', { method: 'POST', body: '{}' }),
  );
  assert.equal(signup.status, 503);
});

test('migrations are repeatable, prefixed, and leave existing data intact', async () => {
  const plan = await migrationPlan(pool, config);
  assert.equal(plan.auth.toBeCreated.length, 0);
  assert.equal(plan.auth.toBeAdded.length, 0);
  await pool.engine.exec(plan.sql);
  assert.deepEqual((await pool.query('SELECT name FROM users')).rows, [
    { name: 'Existing record' },
  ]);
});

test('signup requires email verification and refuses client-selected administrator privileges', async () => {
  const forged = await request('/api/auth/sign-up/email', 'POST', {
    name: 'Forged Owner',
    email: 'member@example.test',
    password,
    role: 'admin',
    banned: false,
    emailVerified: true,
  });
  assert.equal(forged.status, 400);
  await signup('member@example.test', false);
  const account = (await pool.query('SELECT role, "emailVerified" FROM fedexr_auth_user')).rows[0];
  assert.equal(account.role, 'user');
  assert.equal(account.emailVerified, false);
  const denied = await request('/api/auth/sign-in/email', 'POST', {
    email: 'member@example.test',
    password,
  });
  assert.equal(denied.status, 403);
  const stored = (await pool.query('SELECT password FROM fedexr_auth_account')).rows[0].password;
  assert.notEqual(stored, password);
  assert.ok(stored.length > 60);
  assert.equal(messages.length, 1);
});

test('verified sign-in sets HttpOnly cookies and does not return session credentials in JSON', async () => {
  await signup();
  const { response, cookie } = await signin();
  assert.ok(
    response.headers
      .getSetCookie()
      .some((value) => /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value)),
  );
  assert.ok(!/token|password|digest|salt/.test(await response.text()));
  const workspace = await json(await request('/api/workspace', 'GET', undefined, cookie));
  assert.equal(workspace.status, 200);
  assert.equal(workspace.body.user.role, 'member');
  assert.equal(JSON.stringify(workspace.body).includes(password), false);
  const wrong = await request('/api/auth/sign-in/email', 'POST', {
    email: 'member@example.test',
    password: 'wrong-passphrase',
  });
  assert.equal(wrong.status, 401);
});

test('HTTPS sessions use Secure cookies and anonymous or forged local flags cannot authorize records', async () => {
  const secureConfig = { ...config, origin: 'https://workspace.example' };
  const secure = createService({ pool, config: secureConfig, mailer: { send: async () => {} } });
  await signup();
  const response = await secure.handle(
    new Request('https://workspace.example/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        origin: 'https://workspace.example',
        'content-type': 'application/json',
        'x-real-ip': '127.0.0.1',
      },
      body: JSON.stringify({ email: 'member@example.test', password }),
    }),
  );
  assert.equal(response.status, 200);
  assert.ok(response.headers.getSetCookie().some((value) => /; Secure/i.test(value)));
  assert.equal((await request('/api/workspace')).status, 401);
  const forged = await service.handle(
    new Request(config.origin + '/api/workspace', {
      headers: { cookie: 'isAdmin=true; isLoggedIn=true', 'x-admin-secret': 'admin' },
    }),
  );
  assert.equal(forged.status, 401);
});

test('workspace mutations reject missing/foreign origins and non-JSON bodies', async () => {
  const { cookie } = await user();
  assert.equal(
    (await request('/api/workspace/plans', 'POST', plan(), cookie, 'https://foreign.example'))
      .status,
    403,
  );
  assert.equal((await request('/api/workspace/plans', 'POST', plan(), cookie, '')).status, 403);
  const form = await service.handle(
    new Request(config.origin + '/api/workspace/plans', {
      method: 'POST',
      headers: { cookie, origin: config.origin, 'content-type': 'text/plain' },
      body: JSON.stringify(plan()),
    }),
  );
  assert.equal(form.status, 415);
});

test('plan CRUD is persisted, validated, ownership-scoped, and not a carrier booking', async () => {
  const first = await user();
  const created = await json(
    await request(
      '/api/workspace/plans',
      'POST',
      { ...plan(), userId: 'forged', status: 'ready' },
      first.cookie,
    ),
  );
  assert.equal(created.status, 200);
  const id = created.body.id;
  assert.equal((await request('/api/workspace/plans/------------------------------------', 'DELETE', {}, first.cookie)).status, 400);
  const record = created.body.data.plans[0];
  assert.equal(record.userId, created.body.user.id);
  assert.equal(record.status, 'draft');
  const second = await user('second@example.test');
  const secondData = await json(await request('/api/workspace', 'GET', undefined, second.cookie));
  assert.equal(secondData.body.data.plans.length, 0);
  assert.equal(secondData.body.data.users.length, 1);
  assert.equal(
    (await request(`/api/workspace/plans/${id}`, 'PUT', plan(), second.cookie)).status,
    404,
  );
  assert.equal(
    (await request(`/api/workspace/plans/${id}`, 'DELETE', {}, second.cookie)).status,
    404,
  );
  assert.equal(
    (await request('/api/workspace/plans', 'POST', { ...plan(), weight: '-1' }, first.cookie))
      .status,
    400,
  );
  assert.equal(
    (
      await request(
        '/api/workspace/plans',
        'POST',
        { ...plan(), shipDate: '2030-02-31' },
        first.cookie,
      )
    ).status,
    400,
  );
  const updated = await json(
    await request(
      `/api/workspace/plans/${id}`,
      'PUT',
      { ...plan(), recipient: 'Updated Recipient', userId: secondData.body.user.id },
      first.cookie,
    ),
  );
  assert.equal(updated.body.data.plans[0].recipient, 'Updated Recipient');
  assert.equal(updated.body.data.plans[0].userId, record.userId);
  const ready = await json(
    await request(`/api/workspace/plans/${id}/status`, 'PATCH', { status: 'ready' }, first.cookie),
  );
  assert.equal(ready.body.data.plans[0].status, 'ready');
  assert.equal(
    (await request(`/api/workspace/plans/${id}`, 'DELETE', {}, first.cookie)).status,
    200,
  );
  assert.equal((await pool.query('SELECT count(*) AS total FROM fedexr_plans')).rows[0].total, 0);
});

test('addresses enforce ownership and maintain exactly one preferred default', async () => {
  const first = await user();
  const created = await json(
    await request('/api/workspace/addresses', 'POST', address(), first.cookie),
  );
  assert.equal(created.status, 200);
  assert.equal(created.body.data.addresses[0].isDefault, true);
  const id = created.body.id;
  const second = await user('second@example.test');
  assert.equal(
    (await request(`/api/workspace/addresses/${id}`, 'PUT', address(), second.cookie)).status,
    404,
  );
  assert.equal(
    (await request(`/api/workspace/addresses/${id}/default`, 'PATCH', {}, second.cookie)).status,
    404,
  );
  const office = await json(
    await request('/api/workspace/addresses', 'POST', address('Office'), first.cookie),
  );
  const preferred = await json(
    await request(`/api/workspace/addresses/${office.body.id}/default`, 'PATCH', {}, first.cookie),
  );
  assert.equal(preferred.body.data.addresses.filter((entry) => entry.isDefault).length, 1);
  const removed = await json(
    await request(`/api/workspace/addresses/${office.body.id}`, 'DELETE', {}, first.cookie),
  );
  assert.equal(removed.body.data.addresses[0].id, id);
  assert.equal(removed.body.data.addresses[0].isDefault, true);
});

test('administrator writes require server roles and suspension revokes active sessions', async () => {
  const member = await user();
  const admin = await owner();
  assert.equal(
    (
      await request(
        '/api/workspace/settings',
        'PUT',
        { name: 'Forged', announcements: '' },
        member.cookie,
      )
    ).status,
    403,
  );
  const memberData = await json(await request('/api/workspace', 'GET', undefined, member.cookie));
  const id = memberData.body.user.id;
  const changed = await json(
    await request(
      '/api/workspace/settings',
      'PUT',
      { name: 'Shared workspace', announcements: 'Review before booking.' },
      admin.cookie,
    ),
  );
  assert.equal(changed.body.data.settings.name, 'Shared workspace');
  const suspended = await request(
    `/api/workspace/members/${id}/status`,
    'PATCH',
    { status: 'suspended' },
    admin.cookie,
  );
  assert.equal(suspended.status, 200);
  assert.equal((await request('/api/workspace', 'GET', undefined, member.cookie)).status, 401);
  assert.equal(
    (await request('/api/auth/sign-in/email', 'POST', { email: 'member@example.test', password }))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        `/api/workspace/members/${id}/status`,
        'PATCH',
        { status: 'active' },
        admin.cookie,
      )
    ).status,
    200,
  );
  assert.equal((await request('/api/workspace', 'GET', undefined, member.cookie)).status, 401);
  await signin();
});

test('administrator review preserves ownership and credentials never enter workspace payloads', async () => {
  const member = await user();
  const admin = await owner();
  const created = await json(await request('/api/workspace/plans', 'POST', plan(), member.cookie));
  const updated = await json(
    await request(
      `/api/workspace/plans/${created.body.id}`,
      'PUT',
      { ...plan(), notes: 'Reviewed by owner.' },
      admin.cookie,
    ),
  );
  assert.equal(updated.body.data.plans[0].userId, created.body.user.id);
  assert.equal(updated.body.data.stats.users, 2);
  assert.equal(updated.body.data.stats.plans, 1);
  assert.equal(/"password"|"token"|"digest"|"salt"/.test(JSON.stringify(updated.body)), false);
  assert.ok(updated.body.data.activity.some((entry) => entry.action === 'Shipment plan updated'));
  assert.equal(
    (
      await request(
        `/api/workspace/members/${updated.body.user.id}/status`,
        'PATCH',
        { status: 'suspended' },
        admin.cookie,
      )
    ).status,
    400,
  );
});

test('administrator public shipments are trackable without exposing account data', async () => {
  const member = await user();
  const memberData = await json(await request('/api/workspace', 'GET', undefined, member.cookie));
  const memberId = memberData.body.user.id;
  const admin = await owner();

  assert.equal(
    (await request('/api/workspace/shipments', 'POST', publicShipment(memberId), member.cookie))
      .status,
    403,
  );
  const created = await json(
    await request('/api/workspace/shipments', 'POST', publicShipment(memberId), admin.cookie),
  );
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const shipmentId = created.body.id;
  assert.equal(created.body.data.shipments[0].trackingNumber, 'SERVER-1001');
  assert.equal(created.body.data.shipments[0].userId, memberId);
  assert.equal(
    (await request('/api/workspace/shipments', 'POST', publicShipment(memberId), admin.cookie))
      .status,
    400,
  );

  const generated = await json(
    await request(
      '/api/workspace/shipments',
      'POST',
      {
        ...publicShipment(memberId),
        trackingNumber: '',
        recipientLabel: 'Generated Number Recipient',
      },
      admin.cookie,
    ),
  );
  assert.equal(generated.status, 200, JSON.stringify(generated.body));
  const generatedRecord = generated.body.data.shipments.find(
    (entry) => entry.recipientLabel === 'Generated Number Recipient',
  );
  assert.match(generatedRecord.trackingNumber, /^\d{15}$/);
  assert.equal((await request(`/api/tracking/${generatedRecord.trackingNumber}`)).status, 200);

  const grouped = await json(
    await request(
      '/api/workspace/shipments',
      'POST',
      {
        ...publicShipment(memberId),
        trackingNumber: '7485 1290 3645',
        recipientLabel: 'Grouped Number Recipient',
        service: '2day',
      },
      admin.cookie,
    ),
  );
  assert.equal(grouped.status, 200, JSON.stringify(grouped.body));
  assert.equal(
    grouped.body.data.shipments.find((entry) => entry.recipientLabel === 'Grouped Number Recipient')
      .trackingNumber,
    '748512903645',
  );
  assert.equal((await request('/api/tracking/7485%201290%203645')).status, 200);

  const publicResponse = await json(await request('/api/tracking/server-1001'));
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.body.shipment.trackingNumber, 'SERVER-1001');
  assert.equal(publicResponse.body.shipment.status, 'in_transit');
  assert.equal(publicResponse.body.shipment.userId, null);
  assert.equal(JSON.stringify(publicResponse.body).includes(memberId), false);
  assert.equal(JSON.stringify(publicResponse.body).includes('member@example.test'), false);
  assert.equal(JSON.stringify(publicResponse.body).includes('1 Example Street'), false);
  assert.equal((await request('/api/tracking/UNKNOWN-4040')).status, 404);

  assert.equal(
    (
      await request(
        `/api/workspace/shipments/${shipmentId}/updates`,
        'POST',
        { status: 'out_for_delivery', location: 'BOSTON, MA', note: 'On vehicle for delivery' },
        member.cookie,
      )
    ).status,
    403,
  );
  const updated = await json(
    await request(
      `/api/workspace/shipments/${shipmentId}/updates`,
      'POST',
      { status: 'out_for_delivery', location: 'BOSTON, MA', note: 'On vehicle for delivery' },
      admin.cookie,
    ),
  );
  assert.equal(updated.status, 200);
  const tracked = await json(await request('/api/tracking/SERVER-1001'));
  assert.equal(tracked.body.shipment.status, 'out_for_delivery');
  assert.equal(tracked.body.shipment.currentLocation, 'BOSTON, MA');
  assert.equal(tracked.body.shipment.events.at(-1).note, 'On vehicle for delivery');

  assert.equal(
    (
      await request(
        `/api/workspace/shipments/${shipmentId}/updates`,
        'POST',
        { status: 'on_hold', location: 'BOSTON, MA', note: 'Reason missing' },
        admin.cookie,
      )
    ).status,
    400,
  );
  const held = await json(
    await request(
      `/api/workspace/shipments/${shipmentId}/updates`,
      'POST',
      {
        status: 'on_hold',
        location: 'BOSTON, MA',
        note: 'Awaiting customs review',
        holdReason: 'customs_inspection',
      },
      admin.cookie,
    ),
  );
  assert.equal(held.status, 200, JSON.stringify(held.body));
  const heldTracking = await json(await request('/api/tracking/SERVER-1001'));
  assert.equal(heldTracking.body.shipment.status, 'on_hold');
  assert.equal(heldTracking.body.shipment.holdReason, 'customs_inspection');
  assert.equal(heldTracking.body.shipment.events.at(-1).holdReason, 'customs_inspection');
  const released = await json(
    await request(
      `/api/workspace/shipments/${shipmentId}/updates`,
      'POST',
      { status: 'in_transit', location: 'NEW YORK, NY', note: 'Released from hold' },
      admin.cookie,
    ),
  );
  assert.equal(released.status, 200, JSON.stringify(released.body));
  const releasedTracking = await json(await request('/api/tracking/SERVER-1001'));
  assert.equal(releasedTracking.body.shipment.status, 'in_transit');
  assert.equal(releasedTracking.body.shipment.holdReason, '');

  assert.equal(
    (
      await request(
        `/api/workspace/shipments/${shipmentId}/internal-note`,
        'PATCH',
        { note: 'Member must not set this' },
        member.cookie,
      )
    ).status,
    403,
  );
  const noted = await json(
    await request(
      `/api/workspace/shipments/${shipmentId}/internal-note`,
      'PATCH',
      { note: 'Call before redelivery' },
      admin.cookie,
    ),
  );
  assert.equal(noted.status, 200, JSON.stringify(noted.body));
  const adminSnapshot = await json(
    await request('/api/workspace', 'GET', undefined, admin.cookie),
  );
  const operationsShipment = adminSnapshot.body.data.shipments.find(
    (entry) => entry.id === shipmentId,
  );
  assert.equal(operationsShipment.internalNote, 'Call before redelivery');
  const publicWithInternalNote = await request('/api/tracking/SERVER-1001');
  assert.equal(JSON.stringify(publicWithInternalNote.body).includes('Call before redelivery'), false);
  const memberSnapshot = await json(
    await request('/api/workspace', 'GET', undefined, member.cookie),
  );
  assert.equal(
    JSON.stringify(memberSnapshot.body.data.shipments).includes('Call before redelivery'),
    false,
  );

  const latestEventId = operationsShipment.events.at(-1).id;
  assert.equal(
    (
      await request(
        `/api/workspace/shipments/${shipmentId}/events/${latestEventId}`,
        'PUT',
        { status: 'delivered', location: 'CAMBRIDGE, MA', note: 'Corrected delivery event' },
        member.cookie,
      )
    ).status,
    403,
  );
  const corrected = await json(
    await request(
      `/api/workspace/shipments/${shipmentId}/events/${latestEventId}`,
      'PUT',
      { status: 'delivered', location: 'CAMBRIDGE, MA', note: 'Corrected delivery event' },
      admin.cookie,
    ),
  );
  assert.equal(corrected.status, 200, JSON.stringify(corrected.body));
  const correctedTracking = await json(await request('/api/tracking/SERVER-1001'));
  assert.equal(correctedTracking.body.shipment.status, 'delivered');
  assert.equal(correctedTracking.body.shipment.currentLocation, 'CAMBRIDGE, MA');

  const undone = await json(
    await request(`/api/workspace/shipments/${shipmentId}/undo`, 'POST', {}, admin.cookie),
  );
  assert.equal(undone.status, 200, JSON.stringify(undone.body));
  const undoneTracking = await json(await request('/api/tracking/SERVER-1001'));
  assert.equal(undoneTracking.body.shipment.status, 'on_hold');
  assert.equal(undoneTracking.body.shipment.currentLocation, 'BOSTON, MA');
  assert.equal(undoneTracking.body.shipment.holdReason, 'customs_inspection');

  const hiddenByOperation = await json(
    await request(
      `/api/workspace/shipments/${shipmentId}/visibility`,
      'PATCH',
      { isPublic: false },
      admin.cookie,
    ),
  );
  assert.equal(hiddenByOperation.status, 200);
  assert.equal((await request('/api/tracking/SERVER-1001')).status, 404);
  const restoredVisibility = await json(
    await request(
      `/api/workspace/shipments/${shipmentId}/visibility`,
      'PATCH',
      { isPublic: true },
      admin.cookie,
    ),
  );
  assert.equal(restoredVisibility.status, 200);
  assert.equal((await request('/api/tracking/SERVER-1001')).status, 200);

  const duplicated = await json(
    await request(`/api/workspace/shipments/${shipmentId}/duplicate`, 'POST', {}, admin.cookie),
  );
  assert.equal(duplicated.status, 200, JSON.stringify(duplicated.body));
  const duplicateRecord = duplicated.body.data.shipments.find(
    (entry) => entry.id === duplicated.body.id,
  );
  assert.match(duplicateRecord.trackingNumber, /^\d{15}$/);
  assert.equal(duplicateRecord.status, 'label_created');
  assert.equal(duplicateRecord.internalNote, 'Call before redelivery');
  const archivedDuplicate = await json(
    await request(
      `/api/workspace/shipments/${duplicateRecord.id}/archive`,
      'PATCH',
      { archived: true },
      admin.cookie,
    ),
  );
  assert.equal(archivedDuplicate.status, 200, JSON.stringify(archivedDuplicate.body));
  assert.ok(
    archivedDuplicate.body.data.shipments.find((entry) => entry.id === duplicateRecord.id)
      .archivedAt,
  );
  assert.equal((await request(`/api/tracking/${duplicateRecord.trackingNumber}`)).status, 404);

  const assigned = await json(await request('/api/workspace', 'GET', undefined, member.cookie));
  assert.equal(assigned.body.data.shipments.length, 3);
  assert.ok(assigned.body.data.shipments.some((entry) => entry.id === shipmentId));

  const hidden = await json(
    await request(
      `/api/workspace/shipments/${shipmentId}`,
      'PUT',
      { ...publicShipment(memberId), isPublic: false },
      admin.cookie,
    ),
  );
  assert.equal(hidden.status, 200);
  assert.equal((await request('/api/tracking/SERVER-1001')).status, 404);
  assert.equal(
    (await request(`/api/workspace/shipments/${shipmentId}`, 'DELETE', {}, admin.cookie)).status,
    200,
  );
});

test('public stage photos are validated, stored on stage events, and exposed publicly', async () => {
  const member = await user();
  const memberData = await json(await request('/api/workspace', 'GET', undefined, member.cookie));
  const memberId = memberData.body.user.id;
  const admin = await owner();
  const tinyPhoto =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP4z8DA8B+MgBgAHfAD/dPQfSYAAAAASUVORK5CYII=';

  const created = await json(
    await request(
      '/api/workspace/shipments',
      'POST',
      {
        ...publicShipment(memberId),
        trackingNumber: 'SERVER-PHOTO-1',
        status: 'in_transit',
        photo: tinyPhoto,
      },
      admin.cookie,
    ),
  );
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const shipmentId = created.body.id;
  const tracked = await json(await request('/api/tracking/SERVER-PHOTO-1'));
  assert.equal(tracked.body.shipment.events.at(-1).photo, tinyPhoto);

  const delivered = await json(
    await request(
      `/api/workspace/shipments/${shipmentId}/updates`,
      'POST',
      { status: 'delivered', location: 'BOSTON, MA', note: 'Delivered', photo: tinyPhoto },
      admin.cookie,
    ),
  );
  assert.equal(delivered.status, 200, JSON.stringify(delivered.body));
  const deliveredTracking = await json(await request('/api/tracking/SERVER-PHOTO-1'));
  assert.equal(deliveredTracking.body.shipment.status, 'delivered');
  assert.equal(deliveredTracking.body.shipment.events.at(-1).photo, tinyPhoto);

  // Non-image payloads are rejected.
  assert.equal(
    (
      await request(
        `/api/workspace/shipments/${shipmentId}/updates`,
        'POST',
        { status: 'delivered', location: 'BOSTON, MA', note: 'Bad', photo: 'https://example.com/a.png' },
        admin.cookie,
      )
    ).status,
    400,
  );
  // Photos on non-stage statuses are stripped, not stored.
  const stripped = await json(
    await request(
      `/api/workspace/shipments/${shipmentId}/updates`,
      'POST',
      { status: 'out_for_delivery', location: 'BOSTON, MA', note: 'Again', photo: tinyPhoto },
      admin.cookie,
    ),
  );
  assert.equal(stripped.status, 200, JSON.stringify(stripped.body));
  const strippedTracking = await json(await request('/api/tracking/SERVER-PHOTO-1'));
  assert.equal(strippedTracking.body.shipment.events.at(-1).photo, '');
});

test('automatic route progression advances due shipments on public lookup', async () => {
  const member = await user();
  const memberData = await json(await request('/api/workspace', 'GET', undefined, member.cookie));
  const memberId = memberData.body.user.id;
  const admin = await owner();

  const created = await json(
    await request(
      '/api/workspace/shipments',
      'POST',
      {
        ...publicShipment(memberId),
        trackingNumber: 'SERVER-AUTO-1',
        status: 'label_created',
        autoProgressEnabled: true,
        autoProgressIntervalMinutes: 1,
      },
      admin.cookie,
    ),
  );
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const shipmentId = created.body.id;

  // Make two automatic steps due (interval is one minute).
  await pool.query('UPDATE fedexr_public_shipments SET auto_progress_next_at = $1 WHERE id = $2', [
    new Date(Date.now() - 90_000).toISOString(),
    shipmentId,
  ]);
  const progressed = await json(await request('/api/tracking/SERVER-AUTO-1'));
  assert.equal(progressed.body.shipment.status, 'in_transit');
  assert.equal(progressed.body.shipment.events.at(-1).status, 'in_transit');
  assert.match(progressed.body.shipment.events.at(-1).note, /Automatic update generated/);
  assert.equal(progressed.body.shipment.autoProgressEnabled, false);
  assert.equal(progressed.body.shipment.autoProgressNextAt, '');

  // Make the remaining steps due; progression completes the route and stops.
  await pool.query('UPDATE fedexr_public_shipments SET auto_progress_next_at = $1 WHERE id = $2', [
    new Date(Date.now() - 10 * 60_000).toISOString(),
    shipmentId,
  ]);
  const delivered = await json(await request('/api/tracking/SERVER-AUTO-1'));
  assert.equal(delivered.body.shipment.status, 'delivered');
  assert.equal(
    delivered.body.shipment.events.filter((event) => /Automatic update generated/.test(event.note))
      .length,
    4,
  );
  const snapshot = await json(await request('/api/workspace', 'GET', undefined, admin.cookie));
  const stored = snapshot.body.data.shipments.find((entry) => entry.id === shipmentId);
  assert.equal(stored.autoProgressEnabled, false);
  assert.equal(stored.autoProgressNextAt, '');

  // Automatic progression cannot be re-enabled once delivered.
  assert.equal(
    (
      await request(
        `/api/workspace/shipments/${shipmentId}/auto-progress`,
        'PATCH',
        { enabled: true, intervalMinutes: 1 },
        admin.cookie,
      )
    ).status,
    400,
  );
});

test('official FedEx tracking is separate and shipment creation requires an administrator', async () => {
  const member = await user('carrier-member@example.test');
  const admin = await owner();
  const fedexConfig = {
    ...config,
    fedexClientId: 'test-client-id',
    fedexClientSecret: 'test-client-secret',
    fedexAccountNumber: '123456789',
    fedexEnvironment: 'sandbox',
    fedexBaseUrl: 'https://apis-sandbox.fedex.com',
    fedexConfigured: true,
    fedexAccountConfigured: true,
    fedexShipmentCreationEnabled: true,
    fedexMissing: [],
  };
  const carrierService = createService({
    pool,
    config: fedexConfig,
    mailer: { send: async () => {} },
    fedexFetch: async (url) => {
      if (url.includes('/oauth/token'))
        return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), {
          headers: { 'Content-Type': 'application/json' },
        });
      if (url.includes('/track/v1/trackingnumbers'))
        return new Response(
          JSON.stringify({
            output: {
              completeTrackResults: [
                {
                  trackingNumber: '123456789012',
                  trackResults: [
                    {
                      latestStatusDetail: {
                        code: 'IT',
                        description: 'In transit',
                        scanLocation: { city: 'Memphis', stateOrProvinceCode: 'TN' },
                      },
                      serviceDetail: { description: 'FedEx Ground' },
                      scanEvents: [],
                    },
                  ],
                },
              ],
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      return new Response(
        JSON.stringify({
          output: {
            transactionShipments: [
              {
                masterTrackingNumber: '123456789012',
                serviceType: 'FEDEX_GROUND',
                pieceResponses: [{ trackingNumber: '123456789012', packageDocuments: [] }],
              },
            ],
          },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    },
  });
  const carrierRequest = (path, method = 'GET', body, cookie = '') =>
    carrierService.handle(
      new Request(fedexConfig.origin + path, {
        method,
        headers: {
          origin: fedexConfig.origin,
          'content-type': 'application/json',
          cookie,
          'x-real-ip': '127.0.0.2',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const status = await json(await carrierRequest('/api/carrier/status'));
  assert.equal(status.status, 200);
  assert.equal(status.body.carrier.trackingEnabled, true);
  assert.equal(JSON.stringify(status.body).includes('test-client-secret'), false);
  assert.equal(JSON.stringify(status.body).includes('123456789'), false);
  const tracked = await json(await carrierRequest('/api/carrier/track/123456789012'));
  assert.equal(tracked.status, 200);
  assert.equal(tracked.body.carrier.found, true);
  assert.equal(tracked.body.carrier.status, 'In transit');
  const shipment = {
    serviceType: 'FEDEX_GROUND',
    shipDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    weightLb: 2,
    shipper: {
      name: 'Test Sender',
      phone: '5555550100',
      street: '1 Example Street',
      city: 'Memphis',
      state: 'TN',
      postalCode: '38116',
    },
    recipient: {
      name: 'Test Recipient',
      phone: '5555550100',
      street: '2 Example Street',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
    },
  };
  assert.equal((await carrierRequest('/api/carrier/shipments', 'POST', shipment)).status, 401);
  assert.equal(
    (await carrierRequest('/api/carrier/shipments', 'POST', shipment, member.cookie)).status,
    403,
  );
  const created = await json(
    await carrierRequest('/api/carrier/shipments', 'POST', shipment, admin.cookie),
  );
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.carrierShipment.trackingNumber, '123456789012');
});

test('password change checks the current phrase, rotates cookies, and revokes other sessions', async () => {
  await signup();
  const first = await signin();
  const second = await signin();
  const next = 'changed-test-only-passphrase-42';
  assert.equal(
    (
      await request(
        '/api/workspace/passphrase',
        'PUT',
        { current: 'incorrect', next, confirmation: next },
        first.cookie,
      )
    ).status,
    400,
  );
  const changed = await request(
    '/api/workspace/passphrase',
    'PUT',
    { current: password, next, confirmation: next },
    first.cookie,
  );
  assert.equal(changed.status, 200, await changed.clone().text());
  assert.equal((await request('/api/workspace', 'GET', undefined, second.cookie)).status, 401);
  assert.equal(
    (await request('/api/auth/sign-in/email', 'POST', { email: 'member@example.test', password }))
      .status,
    401,
  );
  await signin('member@example.test', next);
});

test('password recovery uses expiring single-use links and revokes existing sessions', async () => {
  const old = await user();
  const missing = await json(
    await request('/api/auth/request-password-reset', 'POST', {
      email: 'missing@example.test',
      redirectTo: `${config.origin}/login?mode=reset`,
    }),
  );
  const found = await json(
    await request('/api/auth/request-password-reset', 'POST', {
      email: 'member@example.test',
      redirectTo: `${config.origin}/login?mode=reset`,
    }),
  );
  assert.equal(missing.status, 200);
  assert.deepEqual(missing.body, found.body);
  const message = messages.findLast((entry) => entry.subject.includes('Reset'));
  const url = new URL(message.text.match(/https?:\/\/\S+/)[0]);
  const token = url.pathname.split('/').at(-1);
  const next = 'recovered-test-only-passphrase-42';
  assert.equal(
    (await request('/api/auth/reset-password', 'POST', { token, newPassword: next })).status,
    200,
  );
  assert.equal(
    (await request('/api/auth/reset-password', 'POST', { token, newPassword: next })).status,
    400,
  );
  assert.equal((await request('/api/workspace', 'GET', undefined, old.cookie)).status, 401);
  await signin('member@example.test', next);
});

test('sign-out revokes the server session and disabled admin APIs cannot grant public roles', async () => {
  const { cookie } = await user();
  assert.equal(
    (await request('/api/auth/admin/set-role', 'POST', { role: 'admin' }, cookie)).status,
    404,
  );
  const signedOut = await request('/api/auth/sign-out', 'POST', {}, cookie);
  assert.equal(signedOut.status, 200);
  assert.equal((await request('/api/workspace', 'GET', undefined, cookie)).status, 401);
});

test('authentication rate limits persist in PostgreSQL', async () => {
  await signup();
  let status;
  for (let index = 0; index < 11; index++)
    status = (
      await request('/api/auth/sign-in/email', 'POST', {
        email: 'member@example.test',
        password: 'incorrect-phrase',
      })
    ).status;
  assert.equal(status, 429);
  assert.ok(
    (await pool.query('SELECT count(*) AS total FROM fedexr_auth_rate_limit')).rows[0].total > 0,
  );
});

test('HTTP adapter enforces body limits and strips client-selected rate-limit IP headers', async () => {
  const server = createServer(nodeHandler(service, config));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const oversized = await fetch(`${url}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { origin: config.origin, 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(17000) }),
    });
    assert.equal(oversized.status, 413);
    await signup();
    const signed = await fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        origin: config.origin,
        'content-type': 'application/json',
        'x-real-ip': '198.51.100.23',
      },
      body: JSON.stringify({ email: 'member@example.test', password }),
    });
    assert.equal(signed.status, 200);
    const storedIP = (await pool.query('SELECT "ipAddress" FROM fedexr_auth_session')).rows[0]
      .ipAddress;
    assert.notEqual(storedIP, '198.51.100.23');
    const health = await fetch(`${url}/api/account/status`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).databaseReady, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('SMTP enforces certificate-verified TLS and parses credential URLs without exposing them', async () => {
  const { smtpOptions } = await import('../src/mail.js');
  const secure = smtpOptions('smtps://fixture:encoded%40pass@mail.example.test:465');
  assert.equal(secure.secure, true);
  assert.equal(secure.tls.rejectUnauthorized, true);
  assert.equal(secure.auth.pass, 'encoded@pass');
  const startTLS = smtpOptions('smtp://mail.example.test:587');
  assert.equal(startTLS.requireTLS, true);
  assert.equal(startTLS.tls.minVersion, 'TLSv1.2');
});

test('expired recovery tokens are rejected and reset validity is bounded to fifteen minutes', async () => {
  await signup();
  await request('/api/auth/request-password-reset', 'POST', {
    email: 'member@example.test',
    redirectTo: `${config.origin}/login?mode=reset`,
  });
  const link = messages
    .findLast((message) => message.subject.includes('Reset'))
    .text.match(/https?:\/\/\S+/)[0];
  const token = new URL(link).pathname.split('/').at(-1);
  const row = (
    await pool.query(
      'SELECT "expiresAt" FROM fedexr_auth_verification ORDER BY "createdAt" DESC LIMIT 1',
    )
  ).rows[0];
  const lifetime = new Date(row.expiresAt).getTime() - Date.now();
  assert.ok(lifetime > 14 * 60000 && lifetime <= 15 * 60000);
  await pool.query(
    'UPDATE fedexr_auth_verification SET "expiresAt" = now() - interval \'1 minute\'',
  );
  assert.equal(
    (
      await request('/api/auth/reset-password', 'POST', {
        token,
        newPassword: 'expired-test-only-passphrase-42',
      })
    ).status,
    400,
  );
});

test('mail delivery failure cannot verify an account or issue a signed-in session', async () => {
  const broken = createService({
    pool,
    config,
    mailer: {
      send: async () => {
        throw new Error('Fixture transport unavailable');
      },
    },
  });
  const response = await broken.handle(
    new Request(`${config.origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { origin: config.origin, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Pending Delivery',
        email: 'pending@example.test',
        password,
        callbackURL: `${config.origin}/login`,
      }),
    }),
  );
  assert.equal(response.status, 200); // Generic accepted response preserves signup privacy.
  assert.deepEqual(await response.json(), { ok: true, requiresVerification: true });
  assert.equal(response.headers.getSetCookie().length, 0);
  assert.equal(
    (
      await pool.query('SELECT "emailVerified" FROM fedexr_auth_user WHERE email=$1', [
        'pending@example.test',
      ])
    ).rows[0].emailVerified,
    false,
  );
});

test('profile edits persist the name but email changes require confirmation of the current address', async () => {
  const { cookie } = await user();
  const response = await json(
    await request(
      '/api/workspace/profile',
      'PUT',
      { name: 'Updated Member', email: 'new-address@example.test' },
      cookie,
    ),
  );
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.user.name, 'Updated Member');
  assert.equal(response.body.user.email, 'member@example.test');
  assert.ok(response.body.notice.includes('confirm'));
  assert.equal(messages.at(-1).to, 'member@example.test');
  assert.ok(messages.at(-1).subject.includes('Confirm'));
});
