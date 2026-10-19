import pg from 'pg';
import { configuration, safeConfiguration } from './config.js';

/**
 * Read-only readiness report.
 *
 * This module deliberately imports nothing heavy at module scope: only config.js
 * (which imports nothing) and pg. The heavy parts of the stack — sharp, the
 * better-auth construction, and the full runtime — are probed with deferred
 * dynamic imports inside try/catch, so a failure there is *reported* instead of
 * taking the endpoint down with it.
 *
 * A serverless function that dies during module load surfaces to the visitor as
 * an opaque 500 FUNCTION_INVOCATION_FAILED. This file exists so that failure can
 * be named instead.
 */

export const REQUIRED_TABLES = [
  'fedexr_auth_user',
  'fedexr_plans',
  'fedexr_settings',
  'fedexr_public_shipments',
];

/** Non-sensitive error text. Never includes environment values or credentials. */
function describeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').trim().slice(0, 300) || 'Unknown error';
}

function errorKind(error) {
  return error instanceof Error ? error.name || 'Error' : 'Error';
}

/** Read-only schema probe: which required tables are missing. */
export async function probeSchema(pool) {
  const select = REQUIRED_TABLES.map((table) => `to_regclass('${table}') AS "${table}"`).join(', ');
  const row = (await pool.query(`SELECT ${select}`)).rows[0] || {};
  const missingTables = REQUIRED_TABLES.filter((table) => !row[table]);
  return { reachable: true, schemaInstalled: missingTables.length === 0, missingTables };
}

function emptyReport(config) {
  return {
    ...safeConfiguration(config),
    ready: false,
    database: {
      configured: Boolean(config.databaseConfigured),
      reachable: false,
      schemaInstalled: false,
      missingTables: [],
      error: null,
    },
    mail: { configured: Boolean(config.smtpURL && config.mailFrom) },
    adminBootstrap: {
      configured: Boolean(config.adminBootstrapConfigured),
      missing: Array.isArray(config.adminBootstrapMissing) ? config.adminBootstrapMissing : [],
      accountExists: null,
      isAdmin: null,
      emailVerified: null,
      error: null,
    },
    // Present only when RUN_ACCOUNT_MIGRATIONS is enabled and a migration ran.
    migration: null,
    // Whether the heavy module graphs load at all. loadable:false here is the
    // direct cause of a 500 on every route that imports them.
    modules: {},
  };
}

/**
 * Probe the heavy module graphs. Specifiers are literal so bundlers keep them.
 * Importing runtime.js has no side effects: getRuntime() is lazy.
 */
async function probeModules(report) {
  try {
    await import('./image-data.js');
    report.modules.imageStack = { loadable: true };
  } catch (error) {
    report.modules.imageStack = { loadable: false, error: describeError(error), kind: errorKind(error) };
  }
  try {
    await import('./auth.js');
    report.modules.authStack = { loadable: true };
  } catch (error) {
    report.modules.authStack = { loadable: false, error: describeError(error), kind: errorKind(error) };
  }
  try {
    await import('./runtime.js');
    report.modules.runtime = { loadable: true };
  } catch (error) {
    report.modules.runtime = { loadable: false, error: describeError(error), kind: errorKind(error) };
  }
}

/**
 * Build the report.
 *
 * @param options.config    parsed configuration
 * @param options.pool      optional existing pool (reused; not closed)
 * @param options.probeModules whether to run the heavy module-load probes
 */
export async function buildReport({ config, pool = null, probeModules: shouldProbe = true }) {
  const report = emptyReport(config);
  if (shouldProbe) await probeModules(report);

  // Admin account state needs only pg plus better-auth's pure-JS crypto helper,
  // imported lazily so a failure there cannot break the report.
  // Read-only probing needs a single connection. The migration brings its own
  // pool — see auto-migrate.js — because it needs several, and a direct route.
  const ownPool = !pool && config.databaseConfigured
    ? new pg.Pool({
        connectionString: config.databaseURL,
        max: 1,
        connectionTimeoutMillis: 8000,
        idleTimeoutMillis: 1000,
      })
    : null;
  const activePool = pool || ownPool;
  try {
    try {
      if (activePool) Object.assign(report.database, await probeSchema(activePool));
    } catch (error) {
      report.database.error = `${errorKind(error)}: ${describeError(error)}`;
    }

    // Opt-in only (RUN_ACCOUNT_MIGRATIONS). Awaited, then the schema is probed
    // again, so a single visit reports the outcome instead of needing a second
    // trip to discover whether it worked.
    if (
      config.runAccountMigrations &&
      config.databaseConfigured &&
      !report.database.schemaInstalled
    ) {
      try {
        const { runMigrationsOnce } = await import('./auto-migrate.js');
        report.migration = await runMigrationsOnce({ config });
        if (report.migration.applied && activePool)
          Object.assign(report.database, await probeSchema(activePool));
      } catch (error) {
        report.migration = { applied: false, error: `${errorKind(error)}: ${describeError(error)}` };
      }
    }

    if (report.database.schemaInstalled && activePool) {
      try {
        const { readAdminAccountStatus } = await import('./bootstrap-admin.js');
        const admin = await readAdminAccountStatus(activePool, config);
        // Credential state (passwordMatches / hasCredential) is never exposed.
        report.adminBootstrap = {
          ...report.adminBootstrap,
          accountExists: Boolean(admin.accountExists),
          isAdmin: Boolean(admin.isAdmin),
          emailVerified: Boolean(admin.emailVerified),
          ...(admin.configured ? {} : { missing: admin.missing }),
        };
      } catch (error) {
        report.adminBootstrap.error = `${errorKind(error)}: ${describeError(error)}`;
      }
    }

    report.ready = Boolean(
      config.ready &&
        report.database.reachable &&
        report.database.schemaInstalled &&
        Object.values(report.modules).every((entry) => entry.loadable !== false),
    );
    return report;
  } finally {
    // Only a pool this call created is closed; a caller-owned pool is left alone.
    if (ownPool) await ownPool.end().catch(() => {});
  }
}

/** Standalone report for GET /api/account/health, with its own short-lived pool. */
export async function healthReport() {
  return buildReport({ config: configuration() });
}
