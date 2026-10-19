import { writeSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Installs the account schema — and the bootstrap administrator — during a
 * hosting build.
 *
 * Why this exists
 * ---------------
 * A hosted deployment offers no shell, so `npm run db:migrate` cannot be run by
 * the person operating the site. The existing alternative, RUN_ACCOUNT_MIGRATIONS
 * (see auto-migrate.js), applies the schema from inside a serverless function on
 * a cold start. That works, but it depends on somebody visiting a URL, it races
 * the request that triggered it, and the platform can freeze the function before
 * the DDL finishes — which leaves the site reporting "schema not installed" with
 * nobody able to say why.
 *
 * A build container is a better place for one-shot DDL: it has the environment
 * variables, it has unrestricted network access to the database, it is not on
 * anybody's request path, and it finishes before traffic is routed to the new
 * deployment. So the schema is installed *before* the version that needs it goes
 * live, and the outcome is written to the build log where the operator can read
 * it.
 *
 * Safety
 * ------
 * - Opt-in by environment. It runs only inside a hosting build (VERCEL=1) of the
 *   production target, or when INSTALL_SCHEMA_AT_BUILD is set explicitly. A local
 *   `npm run build` never touches a database.
 * - Non-fatal. This script always exits 0. Failing the build would leave the
 *   previously promoted deployment serving, which is a worse outcome than
 *   shipping with the runtime migration path (RUN_ACCOUNT_MIGRATIONS) still
 *   available as a retry.
 * - Idempotent. It probes first and only applies DDL when a required table is
 *   missing; every statement in the migration is CREATE ... IF NOT EXISTS and
 *   migrationPlan serializes concurrent callers behind an advisory lock.
 * - Quiet about secrets. Only booleans, table names, and redacted error text are
 *   printed. Connection strings, credentials, and password state never reach the
 *   build log.
 * - Bounded. A watchdog forces an exit if a connection hangs, so this can never
 *   stall a build.
 *
 * installInto() is exported and takes the pool as an argument so the whole
 * sequence — probe, migrate, re-probe, bootstrap the administrator — can be
 * exercised against the test engine in server/test/database.js without a
 * DATABASE_URL.
 */

const MARKER = '[install-schema]';
const WATCHDOG_MS = 240_000;

// Written synchronously to fd 1: the process may exit immediately afterwards,
// and an asynchronous console.log can still be buffered when it does. The marker
// line is the whole point of the script, so it must not be lost.
function report(payload) {
  const line = `${MARKER} ${JSON.stringify(payload)}\n`;
  try {
    writeSync(1, line);
  } catch {
    console.log(line.trimEnd());
  }
}

function describeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message
      // Never print a connection string, even if a driver embeds one in a message.
      .replace(/postgres(?:ql)?:\/\/\S+/gi, '[database-url-redacted]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 400) || 'Unknown error'
  );
}

/**
 * Decide whether this environment asked for an install.
 * Returns a reason string, or null to skip.
 */
function requestedBy(env) {
  if (/^(1|true|yes|on)$/i.test(String(env.INSTALL_SCHEMA_AT_BUILD || '').trim()))
    return 'INSTALL_SCHEMA_AT_BUILD';
  if (env.VERCEL !== '1') return null;
  // Preview and development builds share the production database on this project.
  // Re-running idempotent DDL from every branch push buys nothing, so only the
  // production target performs the install.
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') return null;
  return 'production build';
}

/**
 * Bring the configured administrator account to its expected state.
 * Mirrors service.bootstrapAdmin(), but awaited and with a mail fallback.
 */
async function installAdministrator(pool, config, schema) {
  if (!schema.schemaInstalled)
    return {
      attempted: false,
      reason: 'The account tables are still missing, so there is nothing to create an account in.',
      missingTables: schema.missingTables,
    };
  if (!config.ready)
    return {
      attempted: false,
      reason: 'The account service is not fully configured.',
      missing: config.missing,
    };
  if (!config.adminBootstrapConfigured)
    return {
      attempted: false,
      reason: 'No bootstrap administrator is configured.',
      missing: config.adminBootstrapMissing,
    };

  const { createAuthentication } = await import('../src/auth.js');
  const { smtpMailer } = await import('../src/mail.js');
  const { ensureBootstrapAdmin, readAdminAccountStatus } = await import('../src/bootstrap-admin.js');

  const mailer = smtpMailer(config);
  let outcome;
  try {
    outcome = await ensureBootstrapAdmin({
      pool,
      config,
      authentication: createAuthentication(pool, config, mailer),
    });
  } finally {
    mailer.close();
  }

  // Sign-up sends a verification message, and a build container's outbound SMTP
  // may be refused. The bootstrap sets emailVerified itself immediately after
  // creation, so the message is not actually needed for the account to work:
  // retry once with a mailer that accepts and discards, rather than leaving the
  // site without its administrator.
  if (!outcome?.ready && /could not be (created|confirmed)/i.test(String(outcome?.reason || ''))) {
    const silentMailer = { send: async () => {}, close() {} };
    const retried = await ensureBootstrapAdmin({
      pool,
      config,
      authentication: createAuthentication(pool, config, silentMailer),
    });
    outcome = { ...retried, verificationMailSkipped: retried.ready };
  }

  // Read back only the non-sensitive fields. hasCredential and passwordMatches
  // describe secret state and are deliberately left out of the build log.
  const status = await readAdminAccountStatus(pool, config).catch(() => null);
  return {
    ...outcome,
    account: status
      ? {
          accountExists: Boolean(status.accountExists),
          isAdmin: Boolean(status.isAdmin),
          emailVerified: Boolean(status.emailVerified),
        }
      : null,
  };
}

/** Probe, migrate if needed, re-probe, then bootstrap. Returns the report. */
export async function installInto({ pool, config, triggeredBy }) {
  const started = Date.now();
  const { probeSchema } = await import('../src/health.js');
  let schema = await probeSchema(pool);
  let migration = { applied: false, skipped: 'The required tables were already present.' };

  if (!schema.schemaInstalled) {
    // Not gated by RUN_ACCOUNT_MIGRATIONS: that flag governs the request path.
    // Here the operator asked for an install by building this deployment.
    const { applyMigrations } = await import('../src/auto-migrate.js');
    const applied = await applyMigrations({ pool, config });
    migration = { ...applied, directConnection: Boolean(config.migrationUsesDirectConnection) };
    schema = await probeSchema(pool);
  }

  const admin = await installAdministrator(pool, config, schema);

  return {
    stage: schema.schemaInstalled ? 'installed' : 'incomplete',
    triggeredBy,
    database: {
      reachable: true,
      schemaInstalled: schema.schemaInstalled,
      missingTables: schema.missingTables,
    },
    migration,
    admin,
    durationMs: Date.now() - started,
  };
}

async function install() {
  const env = process.env;
  const triggeredBy = requestedBy(env);
  if (!triggeredBy) {
    report({
      stage: 'skipped',
      reason: 'Not a production hosting build. Set INSTALL_SCHEMA_AT_BUILD=true to run it anyway.',
    });
    return;
  }

  const { configuration } = await import('../src/config.js');
  const config = configuration(env);
  // The unpooled URL is preferred: migrationPlan takes a session-level advisory
  // lock, which a transaction pooler can strand on the wrong server connection.
  const connectionString = config.migrationDatabaseURL || config.databaseURL;
  if (!connectionString) {
    report({
      stage: 'skipped',
      triggeredBy,
      reason: 'No database connection string is available to this build.',
      missing: config.missing,
    });
    return;
  }

  const pg = (await import('pg')).default;
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 20_000,
    idleTimeoutMillis: 5_000,
  });
  // An idle connection dropping must not become an uncaught exception, which
  // would fail the build for a reason unrelated to the migration.
  pool.on('error', () => {});

  try {
    report(await installInto({ pool, config, triggeredBy }));
  } catch (error) {
    // Reported, not rethrown: see the non-fatal note in the header.
    report({
      stage: 'failed',
      triggeredBy,
      kind: error instanceof Error ? error.name || 'Error' : 'Error',
      error: describeError(error),
      note: 'The deployment continues. RUN_ACCOUNT_MIGRATIONS still retries at request time.',
    });
  } finally {
    await pool.end().catch(() => {});
  }
}

// Importable without side effects, so the sequence above can be tested.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = 0;
  const watchdog = setTimeout(() => {
    report({ stage: 'timeout', afterMs: WATCHDOG_MS, note: 'Giving up so the build can continue.' });
    process.exit(0);
  }, WATCHDOG_MS);
  watchdog.unref?.();

  install().then(
    () => process.exit(0),
    (error) => {
      report({ stage: 'failed', error: describeError(error), note: 'The deployment continues.' });
      process.exit(0);
    },
  );
}
