import { getMigrations } from 'better-auth/db/migration';
import { authOptions } from './auth.js';
import { accountMigrationSQL } from './migration-sql.js';

export async function migrationPlan(pool, config) {
  const options = authOptions(pool, config, {
    send: async () => {
      throw new Error('Migration never sends email.');
    },
  });
  const auth = await getMigrations(options);
  const sql = accountMigrationSQL;
  return {
    auth,
    sql,
    async apply() {
      // Serialize app migrations. This does not rename/drop legacy application tables.
      const lock = await pool.connect();
      try {
        await lock.query("SELECT pg_advisory_lock(hashtext('fedexr_account_migration_v1'))");
        const fresh = await getMigrations(options);
        await fresh.runMigrations();
        await lock.query('BEGIN');
        try {
          await lock.query(sql);
          await lock.query('COMMIT');
        } catch (error) {
          await lock.query('ROLLBACK');
          throw error;
        }
      } finally {
        await lock.query("SELECT pg_advisory_unlock(hashtext('fedexr_account_migration_v1'))");
        lock.release();
      }
    },
  };
}
