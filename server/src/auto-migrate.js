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
 * Safe to re-run: every statement in the SQL files is CREATE ... IF NOT EXISTS,
 * better-auth's runner tracks what it has applied, and migrationPlan serializes
 * concurrent callers behind an advisory lock — which matters when several
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
export function runMigrationsOnce({ pool, config }) {
  if (!config.runAccountMigrations)
    return Promise.resolve({ applied: false, skipped: 'RUN_ACCOUNT_MIGRATIONS is not enabled' });
  if (!pool)
    return Promise.resolve({ applied: false, skipped: 'No database connection is configured' });
  promise ||= applyMigrations({ pool, config }).then(
    (result) => result,
    (error) => {
      // Operational signal only: no connection strings, no SQL, no credentials.
      console.error('account_migration_failed');
      promise = null;
      return { applied: false, error: describeError(error) };
    },
  );
  return promise;
}
