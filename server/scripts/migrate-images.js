import pg from 'pg';
import { configuration } from '../src/config.js';
import { imageMigrationPlan } from '../src/image-migrations.js';

const apply = process.argv.includes('--apply');
const config = configuration();
if ((!apply && !process.argv.includes('--plan')) || !config.databaseConfigured) {
  console.error(
    'Configure the existing database privately, then use images:plan to review or images:migrate to explicitly apply the private image migration.',
  );
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({
    connectionString: config.databaseURL,
    max: 2,
    connectionTimeoutMillis: 10000,
  });
  try {
    const plan = await imageMigrationPlan(pool);
    if (apply) {
      console.log(JSON.stringify(await plan.apply()));
      console.log(
        'Valid legacy images were imported privately. Original archive rows were not changed or deleted.',
      );
    } else {
      console.log(plan.sql);
      console.log(JSON.stringify({ legacyRows: plan.legacyRows, legacyLayout: plan.legacyLayout }));
      console.log(plan.warning);
      console.log('Read-only plan. No database changes were applied.');
    }
  } catch {
    console.error(
      'Private image migration did not complete. Check schema compatibility and database permissions; connection credentials and image contents are not logged.',
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
