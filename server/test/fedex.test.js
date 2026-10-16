import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { configuration, safeConfiguration } from '../src/config.js';
import { createFedExClient, normalizeFedExTrackingNumber } from '../src/fedex.js';

const env = {
  DATABASE_URL: 'postgresql://test:test@localhost/test',
  AUTH_SECRET: randomBytes(32).toString('hex'),
  APP_ORIGIN: 'http://127.0.0.1:4301',
  SMTP_URL: 'smtp://localhost:1025',
  MAIL_FROM: 'test@example.test',
  NODE_ENV: 'test',
  FEDEX_ENV: 'sandbox',
  FEDEX_CLIENT_ID: 'test-client-id',
  FEDEX_CLIENT_SECRET: 'test-client-secret',
  FEDEX_ACCOUNT_NUMBER: '123456789',
};
const config = configuration(env);
const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const party = (name, city, state, postalCode) => ({
  name,
  phone: '5555550100',
  street: '1 Example Street',
  city,
  state,
  postalCode,
  countryCode: 'US',
});
const shipmentBody = () => ({
  serviceType: 'FEDEX_GROUND',
  shipDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  weightLb: 2.5,
  shipper: party('Test Sender', 'Memphis', 'TN', '38116'),
  recipient: party('Test Recipient', 'New York', 'NY', '10001'),
});

test('FedEx configuration is fail-closed and status output never exposes credentials', () => {
  assert.equal(config.fedexConfigured, true);
  assert.equal(config.fedexAccountConfigured, true);
  assert.equal(config.fedexShipmentCreationEnabled, false);
  const safe = safeConfiguration(config);
  assert.equal(safe.carrierConnected, true);
  assert.equal(safe.carrier.trackingEnabled, true);
  assert.equal(safe.carrier.shipmentCreationEnabled, false);
  assert.equal(JSON.stringify(safe).includes(env.FEDEX_CLIENT_SECRET), false);
  assert.equal(JSON.stringify(safe).includes(env.FEDEX_ACCOUNT_NUMBER), false);
  const missing = configuration({ ...env, FEDEX_CLIENT_SECRET: '' });
  assert.equal(missing.fedexConfigured, false);
  assert.ok(missing.fedexMissing.includes('FEDEX_CLIENT_SECRET'));
});

test('FedEx tracking uses cached OAuth and returns only normalized public tracking fields', async () => {
  const calls = [];
  const client = createFedExClient({
    config,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('/oauth/token'))
        return jsonResponse({ access_token: 'test-token', expires_in: 3600 });
      return jsonResponse({
        output: {
          completeTrackResults: [
            {
              trackingNumber: '123456789012',
              trackResults: [
                {
                  latestStatusDetail: {
                    code: 'IT',
                    description: 'In transit',
                    scanLocation: { city: 'Memphis', stateOrProvinceCode: 'TN', countryCode: 'US' },
                  },
                  serviceDetail: { description: 'FedEx Ground' },
                  dateAndTimes: [
                    { dateTimeType: 'ESTIMATED_DELIVERY', dateTime: '2026-10-20T20:00:00Z' },
                  ],
                  scanEvents: [
                    {
                      date: '2026-10-18T12:00:00Z',
                      eventDescription: 'Arrived at FedEx location',
                      scanLocation: { city: 'Memphis', stateOrProvinceCode: 'TN' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
    },
  });
  const first = await client.track('1234 5678 9012');
  const second = await client.track('123456789012');
  assert.equal(first.found, true);
  assert.equal(first.status, 'In transit');
  assert.equal(first.latestLocation, 'Memphis, TN, US');
  assert.equal(second.events[0].description, 'Arrived at FedEx location');
  assert.equal(calls.filter((call) => call.url.includes('/oauth/token')).length, 1);
  const trackCall = calls.find((call) => call.url.includes('/track/v1/trackingnumbers'));
  assert.equal(trackCall.options.headers.Authorization, 'Bearer test-token');
  assert.equal(JSON.parse(trackCall.options.body).trackingInfo[0].trackingNumberInfo.trackingNumber, '123456789012');
  assert.equal(JSON.stringify(first).includes('test-client-secret'), false);
});

test('FedEx tracking reports a carrier not-found result without inventing a timeline', async () => {
  const client = createFedExClient({
    config,
    fetchImpl: async (url) =>
      url.includes('/oauth/token')
        ? jsonResponse({ access_token: 'test-token', expires_in: 3600 })
        : jsonResponse({
            output: {
              completeTrackResults: [
                {
                  trackingNumber: '123456789012',
                  trackResults: [{ error: { code: 'TRACKING.TRACKINGNUMBER.NOTFOUND' } }],
                },
              ],
            },
          }),
  });
  const result = await client.track('123456789012');
  assert.equal(result.found, false);
  assert.deepEqual(result.events, []);
  assert.throws(() => normalizeFedExTrackingNumber('LOCAL-12345'), /numeric FedEx tracking number/);
});

test('FedEx shipment creation is opt-in and returns the carrier tracking number', async () => {
  let calls = 0;
  const disabled = createFedExClient({
    config,
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });
  await assert.rejects(() => disabled.createShipment(shipmentBody()), /disabled/);
  assert.equal(calls, 0);

  const requests = [];
  const enabled = createFedExClient({
    config: { ...config, fedexShipmentCreationEnabled: true },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url.includes('/oauth/token'))
        return jsonResponse({ access_token: 'test-token', expires_in: 3600 });
      return jsonResponse({
        output: {
          transactionShipments: [
            {
              masterTrackingNumber: '123456789012',
              serviceType: 'FEDEX_GROUND',
              pieceResponses: [
                {
                  trackingNumber: '123456789012',
                  packageDocuments: [{ contentType: 'PDF', url: 'https://example.test/label.pdf' }],
                },
              ],
            },
          ],
        },
      });
    },
  });
  const result = await enabled.createShipment(shipmentBody());
  assert.equal(result.trackingNumber, '123456789012');
  assert.equal(result.label.url, 'https://example.test/label.pdf');
  const shipCall = requests.find((request) => request.url.includes('/ship/v1/shipments'));
  const payload = JSON.parse(shipCall.options.body);
  assert.equal(payload.accountNumber.value, '123456789');
  assert.equal(payload.requestedShipment.shippingChargesPayment.payor.responsibleParty.accountNumber.value, '123456789');
  await assert.rejects(
    () => enabled.createShipment({ ...shipmentBody(), recipient: { ...party('Bad', 'NYC', 'NY', '10001'), postalCode: 'bad' } }),
    /valid recipient ZIP code/,
  );
});
