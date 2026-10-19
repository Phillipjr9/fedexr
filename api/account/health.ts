type NodeResponse = {
  statusCode?: number;
  setHeader?: (name: string, value: string) => void;
  end?: (chunk?: string) => void;
};

// Applying the schema migration creates roughly a dozen tables and indexes over
// a cold database connection, which does not fit the default budget. Read-only
// reporting finishes far inside this.
export const maxDuration = 60;

type NodeProcess = {
  version?: string;
  env?: Record<string, string | undefined>;
};

// Reached through globalThis rather than referenced directly: @types/node is a
// dev dependency of app/ only, so the bare `process` global is not typed in the
// scope these API functions are compiled from.
const nodeProcess = (globalThis as { process?: NodeProcess }).process;

/** Names only — never values. Enough to spot a missing or too-short setting. */
function envInventory() {
  const env = nodeProcess?.env ?? {};
  const secret = env.AUTH_SECRET || env.JWT_SECRET || '';
  return {
    node: nodeProcess?.version || null,
    NODE_ENV: env.NODE_ENV || null,
    DATABASE_URL: Boolean(env.DATABASE_URL),
    NEON_DATABASE_URL: Boolean(env.NEON_DATABASE_URL),
    APP_ORIGIN: Boolean(env.APP_ORIGIN),
    VERCEL_PROJECT_PRODUCTION_URL: Boolean(env.VERCEL_PROJECT_PRODUCTION_URL),
    VERCEL_URL: Boolean(env.VERCEL_URL),
    AUTH_SECRET: Boolean(env.AUTH_SECRET),
    JWT_SECRET: Boolean(env.JWT_SECRET),
    signingSecretAtLeast32Chars: secret.length >= 32,
    SMTP_URL: Boolean(env.SMTP_URL),
    MAIL_FROM: Boolean(env.MAIL_FROM),
    RESEND_API_KEY: Boolean(env.RESEND_API_KEY),
    RESEND_FROM_EMAIL: Boolean(env.RESEND_FROM_EMAIL),
    ADMIN_EMAIL: Boolean(env.ADMIN_EMAIL),
    ADMIN_PASSWORD: Boolean(env.ADMIN_PASSWORD),
    VITE_WORKSPACE_MODE: env.VITE_WORKSPACE_MODE || null,
  };
}

/**
 * Read-only readiness report for GET /api/account/health.
 *
 * This file imports nothing at module scope, and the report builder is loaded
 * dynamically inside try/catch. A serverless function that throws while
 * initializing surfaces as an opaque 500 FUNCTION_INVOCATION_FAILED with no
 * detail, so the one endpoint meant to explain failures must not be able to
 * inherit one. It always answers 200 with JSON.
 *
 * It also deliberately does not go through the shared runtime that every other
 * route uses: if that graph cannot load, this still reports why.
 */
export default async function handler(_req: unknown, res: NodeResponse) {
  let payload: unknown;
  try {
    const mod = await import('../../server/src/health.js');
    payload = await mod.healthReport();
  } catch (error) {
    // Last resort. Still answer, still without exposing any secret value.
    payload = {
      ready: false,
      fatal:
        error instanceof Error
          ? `${error.name}: ${error.message}`.replace(/\s+/g, ' ').slice(0, 400)
          : 'Unknown error',
      explanation:
        'The health module could not be loaded, so this is a minimal report. Everything below is a boolean or a name; no secret values are included.',
      env: envInventory(),
    };
  }
  const body = JSON.stringify(payload, null, 2);
  if (res && typeof res.setHeader === 'function' && typeof res.end === 'function') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(body);
  }
}
