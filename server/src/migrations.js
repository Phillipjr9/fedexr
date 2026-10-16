import { readFile } from 'node:fs/promises';
import { getMigrations } from 'better-auth/db/migration';
import { authOptions } from './auth.js';

const workspaceSQL = new URL('../migrations/001-workspace.sql', import.meta.url);
const publicShipmentsSQL = new URL('../migrations/003-public-shipments.sql', import.meta.url);
const publicShipmentOperationsSQL = new URL(
  '../migrations/004-public-shipment-operations.sql',
  import.meta.url,
);
const publicShipmentAutoProgressSQL = new URL(
  '../migrations/005-public-shipment-auto-progress.sql',
  import.meta.url,
);
export async function migrationPlan(pool, config) {
  const options = authOptions(pool, config, {
    send: async () => {
      throw new Error('Migration never sends email.');
    },
  });
  const auth = await getMigrations(options);
  const sql = `${await readFile(workspaceSQL, 'utf8')}\n${await readFile(publicShipmentsSQL, 'utf8')}\n${await readFile(publicShipmentOperationsSQL, 'utf8')}\n${await readFile(publicShipmentAutoProgressSQL, 'utf8')}`;
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
