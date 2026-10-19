import pg from 'pg';
import { migrationPlan } from './migrations.js';
import { imageMigrationSQL } from './migration-sql.js';

/**
 * Applies the pending schema migration, at most once per instance.
 *
 * Gated by RUN_ACCOUNT_MIGRATIONS (see config.js). The shell path remains
 * `npm run db:migrate`; this exists because a hosted deployment has no shell, so
 * otherwise the schema can only be created by someone with direct database
 * access.
 *
 * The migration owns its own short-lived pool rather than borrowing the
 * caller's, for two reasons:
 *
 * 1. Size. migrationPlan.apply() holds one connection for the advisory lock
 *    while better-auth's runner acquires others from the same pool. A pool with
 *    a single connection therefore starves itself into "timeout exceeded when
 *    trying to connect".
 * 2. Route. It connects directly rather than through a transaction pooler. A
 *    session-level advisory lock taken through pgbouncer can be acquired on one
 *    server connection and released on another, leaving it held and blocking
 *    every later attempt. config.migrationDatabaseURL prefers an unpooled URL.
 *
 * Safe to re-run: every statement in the SQL files is CREATE ... IF NOT EXISTS,
 * better-auth's runner tracks what it has applied, and migrationPlan serializes
 * concurrent callers behind the advisory lock — which matters when several
 * instances cold-start at once.
 *
 * The image tables are included even though the shell tooling treats them as a
 * separate migration. Their DDL is idempotent, and the legacy-import half of
 * that migration is deliberately NOT run here: it needs operator review and
 * there is nothing to import in a database that never had the old table.
 *
 * This module never throws. A failed migration is returned as data so it can be
 * reported, because an exception escaping a cold-start path can take the whole
 * function down.
 */

function describeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').trim().slice(0, 400) || 'Unknown error';
}

export async function applyMigrations({ pool, config }) {
  const started = Date.now();
  const plan = await migrationPlan(pool, config);
  await plan.apply();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      await client.query(imageMigrationSQL);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
  }
  return { applied: true, durationMs: Date.now() - started };
}

let promise = null;

/** Memoized so concurrent requests cannot start two migrations. */
export function runMigrationsOnce({ config }) {
  if (!config.runAccountMigrations)
    return Promise.resolve({ applied: false, skipped: 'RUN_ACCOUNT_MIGRATIONS is not enabled' });
  const connectionString = config.migrationDatabaseURL || config.databaseURL;
  if (!connectionString)
    return Promise.resolve({ applied: false, skipped: 'No database connection is configured' });

  promise ||= (async () => {
    const pool = new pg.Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 10000,
    });
    pool.on('error', () => console.error('account_migration_pool_error'));
    try {
      const result = await applyMigrations({ pool, config });
      return {
        ...result,
        directConnection: Boolean(config.migrationUsesDirectConnection),
      };
    } finally {
      await pool.end().catch(() => {});
    }
  })().then(
    (result) => result,
    (error) => {
      // Operational signal only: no connection strings, no SQL, no credentials.
      console.error('account_migration_failed');
      promise = null;
      return {
        applied: false,
        error: describeError(error),
        directConnection: Boolean(config.migrationUsesDirectConnection),
      };
    },
  );
  return promise;
}
