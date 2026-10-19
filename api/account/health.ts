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

type HealthReport = {
  database?: { schemaInstalled?: boolean };
  adminBootstrap?: {
    configured?: boolean;
    accountExists?: boolean | null;
    isAdmin?: boolean | null;
    emailVerified?: boolean | null;
    error?: string | null;
  };
  migration?: { applied?: boolean } | null;
};

type BootstrapOutcome = {
  ready?: boolean;
  reason?: string;
  missing?: string[];
};

/** True only when every administrator field the report exposes is correct. */
function adminIsCorrect(admin: HealthReport['adminBootstrap']) {
  return admin?.accountExists === true && admin?.isAdmin === true && admin?.emailVerified === true;
}

/**
 * Build the report, and once the schema is confirmed present, bring the
 * administrator account to its expected state in the same request.
 *
 * The report itself is read-only: it says whether the administrator exists and
 * is correct, but never creates one. Acting on it here means a single visit
 * answers the whole question instead of three — one to install the schema, one
 * to a runtime route to create the administrator, one to read the result back.
 *
 * Both imports stay dynamic, so a broken graph is reported rather than
 * inherited, and service.bootstrapAdmin() memoizes its promise, so the
 * cold-start chain getRuntime() fires and this awaited call share one attempt
 * instead of racing.
 */
async function report(): Promise<HealthReport> {
  const { healthReport } = await import('../../server/src/health.js');
  const first: HealthReport = await healthReport();

  // Without tables there is nothing to bootstrap against, and a correct
  // administrator needs no work: leave the cheap read-only report as it is.
  if (!first.database?.schemaInstalled) return first;
  if (!first.adminBootstrap?.configured || adminIsCorrect(first.adminBootstrap)) return first;

  try {
    const { getRuntime } = await import('../../server/src/runtime.js');
    const bootstrap: BootstrapOutcome = await getRuntime().service.bootstrapAdmin();
    const second: HealthReport = await healthReport();
    return {
      ...second,
      // Re-reading skips the migration because the schema is already installed,
      // so carry the first pass's outcome forward instead of reporting null.
      migration: second.migration ?? first.migration,
      adminBootstrap: {
        ...second.adminBootstrap,
        // bootstrapAdmin() degrades to a reason rather than throwing; keep that
        // visible whenever the account is still not correct afterwards.
        error:
          second.adminBootstrap?.error ??
          (adminIsCorrect(second.adminBootstrap)
            ? null
            : (bootstrap?.reason ?? 'The administrator bootstrap did not finish.')),
      },
    };
  } catch (error) {
    return {
      ...first,
      adminBootstrap: {
        ...first.adminBootstrap,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
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
 * It reaches the shared runtime that every other route uses only after the
 * database schema is confirmed installed, and only inside try/catch: until then
 * the runtime would fail for want of tables, and this endpoint's job is to say
 * so rather than to inherit the failure.
 */
export default async function handler(_req: unknown, res: NodeResponse) {
  let payload: unknown;
  try {
    payload = await report();
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
