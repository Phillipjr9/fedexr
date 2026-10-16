import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { email } from '../src/validation.js';

const index = process.argv.indexOf('--email');
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (index < 0 || !process.argv.includes('--confirm') || !connectionString) {
  console.error(
    'Trusted operator only: npm run admin:grant -- --email owner@example.com --confirm. Configure the database connection in server environment settings first.',
  );
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
  let client;
  try {
    client = await pool.connect();
    const address = email(process.argv[index + 1]);
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT id, "emailVerified", banned FROM fedexr_auth_user WHERE email = $1 FOR UPDATE',
      [address],
    );
    if (!result.rows[0]?.emailVerified || result.rows[0].banned)
      throw new Error('A verified, active account must be created first.');
    await client.query('UPDATE fedexr_auth_user SET role = $1, "updatedAt" = now() WHERE id = $2', [
      'admin',
      result.rows[0].id,
    ]);
    await client.query('DELETE FROM fedexr_auth_session WHERE "userId" = $1', [result.rows[0].id]);
    await client.query('INSERT INTO fedexr_activity(id,actor_id,action) VALUES ($1,$2,$3)', [
      randomUUID(),
      result.rows[0].id,
      'Administrator role assigned by trusted server operator',
    ]);
    await client.query('COMMIT');
    console.log(
      'Administrator role assigned. Existing sessions were revoked; sign in again. No default password was created.',
    );
  } catch {
    if (client) await client.query('ROLLBACK');
    console.error(
      'Administrator setup did not complete. Verify the account, connection, and operator permissions. Credentials are not logged.',
    );
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}
