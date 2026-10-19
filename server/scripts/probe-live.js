import { writeSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Reports what the live site actually answers, from inside a hosting build.
 *
 * Why this exists
 * ---------------
 * The browser client can only say "The account API is unavailable" when a
 * response body is not JSON — which covers an HTML 500 from a function that died
 * during initialization, a gateway timeout page, a redirect, and the SPA rewrite
 * answering index.html for a path that matched no function. Those are very
 * different failures and they look identical from the interface.
 *
 * Whoever operates this site cannot always fetch the API by hand, and the
 * operator working on it may have no direct network route to the deployment at
 * all. A build container does: it has unrestricted egress. So the build asks the
 * production origin for the handful of endpoints that matter and writes the
 * status, content type, and a short excerpt of each body to the build log, where
 * the answer can be read back without a browser.
 *
 * A build runs *before* its deployment is promoted, so this reports the version
 * that is live right now — which is the version a visitor is being served while
 * the build runs. That is the point: it is a reading of production, not of the
 * build.
 *
 * Safety
 * ------
 * - Read-only. Every request is an unauthenticated GET. Nothing is created,
 *   changed, or signed in to.
 * - Opt-in by environment, like install-schema.js: a production hosting build,
 *   or PROBE_LIVE=true. Never runs on a local build unless asked.
 * - Non-fatal and bounded: each request has its own timeout, failures are
 *   reported as data, and the script always exits 0.
 * - Boring about secrets. Connection strings are redacted, bodies are truncated,
 *   and no credentials or cookies are attached to any request. The tracking
 *   lookup deliberately uses an unused number rather than a real shipment, so no
 *   visitor's data is copied into a build log.
 */

const MARKER = '[probe-live]';
const REQUEST_TIMEOUT_MS = 15_000;
const WATCHDOG_MS = 120_000;

// Synchronous write to fd 1: the process exits right after, and an asynchronous
// console.log can still be buffered when it does.
function report(payload) {
  const line = `${MARKER} ${JSON.stringify(payload)}\n`;
  try {
    writeSync(1, line);
  } catch {
    console.log(line.trimEnd());
  }
}

function redact(text) {
  return text
    .replace(/postgres(?:ql)?:\/\/\S+/gi, '[database-url-redacted]')
    // The health report is pretty-printed; flatten it so one endpoint does not
    // spend the whole excerpt budget on indentation.
    .replace(/\s+/g, ' ');
}

/**
 * What to ask for, and how much of the answer to keep.
 *
 * `expect` records the answer a healthy deployment should give, so a wrong one
 * is obvious in the log without needing the code open.
 */
const TARGETS = [
  // Flat functions. These have always routed; they are the control group that
  // makes a catch-all failure obvious.
  {
    path: '/api/workspace',
    limit: 200,
    routes: 'flat',
    expect: '401 JSON {"error":"Sign in to your workspace."} when signed out',
  },
  {
    path: '/api/account/health',
    limit: 1400,
    routes: 'flat',
    expect: '200 JSON readiness report',
  },
  // Catch-all functions: api/auth, api/carrier, api/tracking, api/workspace
  // each hold a single [...path].ts. Sign-in and tracking both live here, so
  // these four are the ones that matter most.
  {
    path: '/api/auth/get-session',
    limit: 200,
    routes: 'catch-all',
    expect: 'JSON from the auth handler, NOT index.html',
  },
  {
    path: '/api/carrier/status',
    limit: 260,
    routes: 'catch-all',
    expect: '200 JSON with carrier.configured false',
  },
  {
    path: '/api/tracking/000000000000',
    limit: 200,
    routes: 'catch-all',
    expect: '404 JSON for an unused tracking number',
  },
  {
    path: '/api/workspace/__probe__',
    limit: 200,
    routes: 'catch-all',
    expect: 'JSON from the workspace handler, NOT index.html',
  },
  // Controls: nothing should answer these as JSON.
  {
    path: '/api/definitely-not-a-route',
    limit: 120,
    routes: 'none',
    expect: 'index.html, because no function claims it',
  },
  {
    path: '/',
    limit: 0,
    routes: 'static',
    expect: '200 HTML application shell',
  },
];

async function probe(origin, target) {
  const started = Date.now();
  const url = new URL(target.path, origin).toString();
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: { accept: 'application/json, text/html;q=0.8' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const body = target.limit ? redact(text).trim().slice(0, target.limit) : undefined;
    return {
      path: target.path,
      routes: target.routes,
      expect: target.expect,
      status: response.status,
      contentType,
      // Differs from the requested URL when something redirected.
      finalUrl: response.url === url ? undefined : response.url,
      // The single most diagnostic fact: the client can only parse JSON.
      parsesAsJson: looksLikeJson(contentType, text),
      bytes: text.length,
      ms: Date.now() - started,
      body,
    };
  } catch (error) {
    return {
      path: target.path,
      routes: target.routes,
      expect: target.expect,
      error: redact(error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 300),
      ms: Date.now() - started,
    };
  }
}

function looksLikeJson(contentType, text) {
  if (/json/i.test(contentType)) return true;
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function requestedBy(env) {
  if (/^(1|true|yes|on)$/i.test(String(env.PROBE_LIVE || '').trim())) return 'PROBE_LIVE';
  if (env.VERCEL !== '1') return null;
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') return null;
  return 'production build';
}

async function run() {
  const env = process.env;
  const triggeredBy = requestedBy(env);
  if (!triggeredBy) {
    report({ stage: 'skipped', reason: 'Not a production hosting build. Set PROBE_LIVE=true to run it anyway.' });
    return;
  }

  const { configuration } = await import('../src/config.js');
  const config = configuration(env);
  // Same origin the browser client uses: APP_ORIGIN, then the platform's
  // production URL. PROBE_ORIGIN overrides it for a one-off reading.
  const origin = env.PROBE_ORIGIN || config.origin;
  if (!origin) {
    report({ stage: 'skipped', triggeredBy, reason: 'No origin to probe: APP_ORIGIN is not configured.' });
    return;
  }

  report({
    stage: 'started',
    triggeredBy,
    origin,
    note: 'A build runs before promotion, so these answers come from the deployment that is live now.',
  });

  for (const target of TARGETS) report(await probe(origin, target));

  report({ stage: 'finished' });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = 0;
  const watchdog = setTimeout(() => {
    report({ stage: 'timeout', afterMs: WATCHDOG_MS });
    process.exit(0);
  }, WATCHDOG_MS);
  watchdog.unref?.();

  run().then(
    () => process.exit(0),
    (error) => {
      report({ stage: 'failed', error: redact(error instanceof Error ? error.message : String(error)).slice(0, 300) });
      process.exit(0);
    },
  );
}
