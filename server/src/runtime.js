import pg from 'pg';
import { configuration } from './config.js';
import { smtpMailer } from './mail.js';
import { createService } from './service.js';
import { nodeHandler } from './http.js';

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
  // Provision the configured administrator in the background on cold start so
  // ADMIN_EMAIL/ADMIN_PASSWORD work without shell access to the database.
  void service.bootstrapAdmin();
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
