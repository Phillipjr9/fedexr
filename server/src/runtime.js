import pg from 'pg';
import { configuration } from './config.js';
import { smtpMailer } from './mail.js';
import { createService } from './service.js';
import { nodeHandler } from './http.js';
import { runMigrationsOnce } from './auto-migrate.js';

let runtime;
export function getRuntime() {
  if (runtime) return runtime;
  const config = configuration();
  const pool = config.databaseConfigured
    ? new pg.Pool({
        connectionString: config.databaseURL,
        max: 5,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 10000,
      })
    : null;
  if (pool) pool.on('error', () => console.error('account_database_pool_error'));
  const mailer = smtpMailer(config);
  const service = createService({ config, pool, mailer });
  // Both run in the background so neither adds latency to a request.
  //
  // The migration is opt-in (RUN_ACCOUNT_MIGRATIONS) and must finish before the
  // administrator bootstrap: that bootstrap creates an account through the auth
  // stack, which needs its tables to exist. Running it against an empty database
  // is what previously took the whole function down.
  if (config.runAccountMigrations && pool) {
    void runMigrationsOnce({ config })
      .then(() => service.bootstrapAdmin())
      .catch(() => console.error('account_startup_task_failed'));
  } else {
    // Provision the configured administrator so ADMIN_EMAIL/ADMIN_PASSWORD work
    // without shell access to the database.
    void service.bootstrapAdmin();
  }
  runtime = {
    config,
    pool,
    mailer,
    service,
    handler: nodeHandler(service, config),
    async close() {
      mailer.close();
      await pool?.end();
    },
  };
  return runtime;
}
