import { randomUUID } from 'node:crypto';
import { createAuthentication } from './auth.js';
import { safeConfiguration } from './config.js';
import { buildReport, probeSchema } from './health.js';
import { ensureBootstrapAdmin } from './bootstrap-admin.js';
import { assert, HttpError } from './validation.js';
import { createImageService } from './image-service.js';
import { imagePaths } from './image-data.js';
import { createFedExClient } from './fedex.js';
import {
  currentActor,
  findPublicShipment,
  snapshot,
  mutateWorkspace,
  updateAccount,
} from './workspace.js';

const authPosts = new Set([
  '/sign-up/email',
  '/sign-in/email',
  '/sign-out',
  '/request-password-reset',
  '/reset-password',
  '/send-verification-email',
  '/change-password',
  '/change-email',
  '/update-user',
  '/revoke-other-sessions',
]);
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
export function createService({ pool, config, mailer, fedexFetch }) {
  const authentication = config.ready ? createAuthentication(pool, config, mailer) : null;
  const images = createImageService({ pool, config, authentication });
  const fedex = createFedExClient({ config, fetchImpl: fedexFetch });
  const carrierLookups = new Map();
  function carrierRateAllowed(request) {
    const ip = request.headers.get('x-real-ip') || 'unknown';
    const now = Date.now();
    const windowStart = now - 60000;
    const recent = (carrierLookups.get(ip) || []).filter((time) => time > windowStart);
    if (recent.length >= 60) return false;
    recent.push(now);
    carrierLookups.set(ip, recent);
    return true;
  }
  async function ready() {
    if (!config.ready)
      throw new HttpError(
        503,
        'The account service needs database, origin, signing-secret, and email configuration.',
      );
    const schema = await probeSchema(pool);
    if (!schema.schemaInstalled)
      throw new HttpError(
        503,
        'The account database schema has not been installed. Review and apply the account migration.',
      );
  }

  // Provision the configured administrator at most once per instance. Started
  // in the background so it never adds latency to a request, and memoized so
  // concurrent requests cannot race two creations.
  //
  // The schema is checked first. Driving better-auth before its tables exist
  // produces failures deep inside the auth stack that are hard to attribute, so
  // an unmigrated database is reported and left alone rather than attempted.
  let bootstrapPromise = null;
  function bootstrapAdmin() {
    if (!pool || !config.ready)
      return Promise.resolve({ attempted: false, ready: false, missing: config.missing });
    bootstrapPromise ||= (async () => {
      const schema = await probeSchema(pool);
      if (!schema.schemaInstalled)
        return {
          attempted: false,
          ready: false,
          reason: 'The account database schema has not been installed.',
          missingTables: schema.missingTables,
        };
      return ensureBootstrapAdmin({ pool, config, authentication });
    })().catch(() => {
      // Operational signal only: never log credentials or account details.
      console.error('admin_bootstrap_failed');
      bootstrapPromise = null;
      return { attempted: true, ready: false, reason: 'The administrator bootstrap failed.' };
    });
    return bootstrapPromise;
  }

  async function handle(request) {
    const requestId = randomUUID();
    try {
      const url = new URL(request.url);
      const pathname = url.pathname.replace(/\/+$/, '') || '/';
      if (imagePaths.has(pathname)) return images.handle(request);
      if (request.method === 'GET' && pathname === '/api/account/health')
        // Modules are already loaded here, so only probe the database. The
        // standalone route in api/account/health.ts does the module probing,
        // because it can run even when this service cannot be imported.
        return json(await buildReport({ config, pool, probeModules: false }), 200);
      if (request.method === 'GET' && ['/', '/api/account/status'].includes(pathname)) {
        if (!config.ready) return json({ ...safeConfiguration(config), databaseReady: false });
        try {
          await ready();
          return json({ ...safeConfiguration(config), databaseReady: true });
        } catch {
          return json(
            {
              ...safeConfiguration(config),
              databaseReady: false,
              message: 'The database is unavailable or needs the account migration.',
            },
            503,
          );
        }
      }
      if (pathname === '/api/carrier/status' && request.method === 'GET')
        return json({ carrier: fedex.status() });
      if (pathname.startsWith('/api/carrier/track/') && request.method === 'GET') {
        assert(carrierRateAllowed(request), 'Too many official tracking lookups. Try again shortly.', 429);
        const segment = pathname.slice('/api/carrier/track/'.length);
        assert(segment && !segment.includes('/'), 'The tracking number was not found.', 404);
        return json({ carrier: await fedex.track(decodeURIComponent(segment)) });
      }
      await ready();
      if (!['GET', 'HEAD'].includes(request.method)) {
        assert(
          request.headers.get('origin') === config.origin &&
            request.headers.get('sec-fetch-site') !== 'cross-site',
          'This request must come from the configured application origin.',
          403,
        );
        assert(
          request.headers.get('content-type')?.split(';')[0] === 'application/json',
          'Send JSON for account changes.',
          415,
        );
      }
      if (pathname.startsWith('/api/auth/')) {
        const route = pathname.slice('/api/auth'.length);
        const allowed =
          request.method === 'POST'
            ? authPosts.has(route)
            : request.method === 'GET' &&
              (['/verify-email', '/error'].includes(route) || route.startsWith('/reset-password/'));
        assert(allowed, 'The account endpoint was not found.', 404);
        const response = await authentication.handler(request);
        if (response.status >= 500)
          return json(
            {
              error:
                'Account processing or email delivery is temporarily unavailable. The action was not confirmed.',
              requestId,
            },
            503,
          );
        // Session credentials are carried only by signed HttpOnly cookies, not API JSON.
        if (response.ok && request.method === 'POST') {
          const clean = json({ ok: true, requiresVerification: route === '/sign-up/email' });
          for (const cookie of response.headers.getSetCookie())
            clean.headers.append('set-cookie', cookie);
          return clean;
        }
        response.headers.set('Cache-Control', 'no-store');
        response.headers.set('Referrer-Policy', 'no-referrer');
        response.headers.set('X-Content-Type-Options', 'nosniff');
        return response;
      }
      if (pathname === '/api/carrier/shipments' && request.method === 'POST') {
        const actor = await currentActor(pool, authentication, request.headers);
        assert(actor.role === 'admin', 'Administrator access is required.', 403);
        let body;
        try {
          body = await request.json();
        } catch {
          throw new HttpError(400, 'Send a valid JSON object.');
        }
        assert(body && typeof body === 'object' && !Array.isArray(body), 'Send a JSON object.');
        return json({ carrierShipment: await fedex.createShipment(body) }, 201);
      }
      if (pathname.startsWith('/api/tracking/') && request.method === 'GET') {
        const segment = pathname.slice('/api/tracking/'.length);
        assert(segment && !segment.includes('/'), 'The tracking number was not found.', 404);
        const shipment = await findPublicShipment(pool, decodeURIComponent(segment));
        assert(shipment, 'The tracking number was not found.', 404);
        return json({ shipment });
      }
      if (pathname === '/api/workspace' && request.method === 'GET') {
        const actor = await currentActor(pool, authentication, request.headers);
        return json(await snapshot(pool, actor));
      }
      if (
        pathname.startsWith('/api/workspace/') &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
      ) {
        const actor = await currentActor(pool, authentication, request.headers);
        let body;
        try {
          body = await request.json();
        } catch {
          throw new HttpError(400, 'Send a valid JSON object.');
        }
        assert(body && typeof body === 'object' && !Array.isArray(body), 'Send a JSON object.');
        const route = pathname.slice('/api/workspace'.length);
        if (route === '/profile' && request.method === 'PUT') {
          const notice = await updateAccount(
            authentication,
            actor,
            body,
            request.headers,
            config.origin,
          );
          await pool.query('INSERT INTO fedexr_activity (id,actor_id,action) VALUES ($1,$2,$3)', [
            randomUUID(),
            actor.id,
            'Workspace profile updated',
          ]);
          const updated = await currentActor(pool, authentication, request.headers);
          return json({ ...(await snapshot(pool, updated)), notice });
        }
        if (route === '/passphrase' && request.method === 'PUT') {
          const next = body.next;
          assert(
            typeof next === 'string' && next.length <= 128,
            'Use a new workspace passphrase up to 128 characters.',
          );
          assert(
            next.length >= 10 &&
              next === body.confirmation &&
              typeof body.current === 'string' &&
              body.current.length <= 128,
            'Use a matching 10–128 character passphrase and enter the current passphrase.',
          );
          // Use the framework HTTP handler so rotated/revoked session cookies propagate.
          return handle(
            new Request(`${config.origin}/api/auth/change-password`, {
              method: 'POST',
              headers: request.headers,
              body: JSON.stringify({
                currentPassword: body.current,
                newPassword: next,
                revokeOtherSessions: true,
              }),
            }),
          );
        }
        const result = await mutateWorkspace(pool, actor, request.method, route, body);
        return json({ ...(await snapshot(pool, actor)), ...result });
      }
      throw new HttpError(404, 'The account endpoint was not found.');
    } catch (error) {
      const status =
        error instanceof HttpError
          ? error.status
          : typeof error.statusCode === 'number' &&
              error.statusCode >= 400 &&
              error.statusCode < 500
            ? error.statusCode
            : 503;
      const message =
        error instanceof HttpError
          ? error.message
          : status < 500 && error.body?.message
            ? error.body.message
            : 'The account service could not complete this request. Try again or contact the site owner.';
      if (status >= 500 && config.production)
        console.error('account_request_failed', {
          requestId,
          code: typeof error.code === 'string' ? error.code : 'SERVICE_ERROR',
        });
      return json({ error: message, requestId }, status);
    }
  }
  return { handle, authentication, bootstrapAdmin };
}
