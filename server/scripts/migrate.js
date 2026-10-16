import pg from 'pg';
import { configuration } from '../src/config.js';
import { migrationPlan } from '../src/migrations.js';

const apply = process.argv.includes('--apply');
if (!apply && !process.argv.includes('--plan')) {
  console.error('Use --plan to review or --apply to add the prefixed account tables.');
  process.exitCode = 1;
} else {
  const config = configuration();
  const missing = config.missing.filter(
    (name) => !name.startsWith('SMTP_URL') && !name.startsWith('MAIL_FROM'),
  );
  if (missing.length) {
    console.error(
      `Configure ${missing.join(', ')} in server environment settings. Do not paste credentials into chat.`,
    );
    process.exitCode = 1;
  } else {
    const pool = new pg.Pool({
      connectionString: config.databaseURL,
      max: 3,
      connectionTimeoutMillis: 10000,
    });
    try {
      const plan = await migrationPlan(pool, config);
      if (apply) {
        await plan.apply();
        console.log('Account tables installed. Legacy tables were not replaced.');
      } else {
        console.log(await plan.auth.compileMigrations());
        console.log(plan.sql);
        console.log(
          'Plan only. No database changes were applied. Back up your database before applying.',
        );
      }
    } catch {
      console.error(
        'Account migration failed. Check connection permissions and schema compatibility; credentials are not logged.',
      );
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  }
}
