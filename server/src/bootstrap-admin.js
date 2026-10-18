import { hashPassword, verifyPassword } from 'better-auth/crypto';

/**
 * Bootstrap administrator.
 *
 * The account named by ADMIN_EMAIL is kept usable as the site administrator:
 * verified, in the `admin` role, not banned, and able to sign in with
 * ADMIN_PASSWORD. Without this, promoting an administrator required shell
 * access to the database (`npm run admin:grant`), which is not available on
 * serverless hosting.
 *
 * Rules this module follows:
 * - Idempotent. Running it on every cold start is a no-op once state is correct;
 *   the UPDATEs use `IS DISTINCT FROM` guards so nothing is rewritten.
 * - Never logs or returns secret values. Status reports carry booleans and
 *   non-sensitive reasons only.
 * - Never demotes or deletes anything. It only creates the configured account
 *   and moves it toward the expected admin state.
 * - Password writes use better-auth's own hasher, so the stored value stays in
 *   the `salt:scrypt-hash` format the sign-in path expects.
 */

const CREDENTIAL_PROVIDER = 'credential';

function displayNameFor(email) {
  const local = email.split('@')[0] || 'Administrator';
  const cleaned = local.replace(/[._-]+/g, ' ').trim().replace(/\s+/g, ' ');
  const name = cleaned
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return (name || 'Administrator').slice(0, 60);
}

async function findAdminUser(pool, email) {
  const result = await pool.query(
    'SELECT id, role, "emailVerified", banned FROM fedexr_auth_user WHERE email = $1',
    [email],
  );
  return result.rows[0] || null;
}

/**
 * Read-only snapshot of the bootstrap administrator state.
 * Safe to expose from the health endpoint: it reports whether things are
 * correct, never the credentials themselves.
 */
export async function readAdminAccountStatus(pool, config) {
  if (!config.adminBootstrapConfigured)
    return { configured: false, missing: config.adminBootstrapMissing };
  const row = await findAdminUser(pool, config.adminEmail);
  if (!row)
    return {
      configured: true,
      missing: [],
      accountExists: false,
      isAdmin: false,
      emailVerified: false,
      banned: false,
      passwordMatches: false,
    };
  const account = await pool.query(
    `SELECT password FROM fedexr_auth_account WHERE "userId" = $1 AND "providerId" = $2`,
    [row.id, CREDENTIAL_PROVIDER],
  );
  const stored = account.rows[0]?.password || '';
  return {
    configured: true,
    missing: [],
    accountExists: true,
    isAdmin: row.role === 'admin',
    emailVerified: Boolean(row.emailVerified),
    banned: Boolean(row.banned),
    hasCredential: Boolean(stored),
    passwordMatches: stored
      ? await verifyPassword({ hash: stored, password: config.adminPassword })
      : false,
  };
}

/**
 * Bring the configured administrator account to the expected state.
 * Returns a non-sensitive outcome describing what happened.
 */
export async function ensureBootstrapAdmin({ pool, config, authentication }) {
  if (!config.adminBootstrapConfigured)
    return { attempted: false, ready: false, missing: config.adminBootstrapMissing };
  if (!authentication)
    return {
      attempted: false,
      ready: false,
      missing: ['Account service is not ready'],
    };

  const email = config.adminEmail;
  let row = await findAdminUser(pool, email);
  let created = false;

  if (!row) {
    try {
      await authentication.api.signUpEmail({
        body: { name: displayNameFor(email), email, password: config.adminPassword },
      });
    } catch (cause) {
      // A concurrent cold start may have created it, or sign-up may be blocked
      // (rate limit, mail delivery). Re-read before reporting failure.
      row = await findAdminUser(pool, email).catch(() => null);
      if (!row)
        return {
          attempted: true,
          ready: false,
          created: false,
          reason:
            cause instanceof Error && /rate|limit/i.test(cause.message)
              ? 'Administrator sign-up is rate limited. Try again shortly.'
              : 'The administrator account could not be created.',
        };
    }
    row ||= await findAdminUser(pool, email);
    created = Boolean(row);
    if (!row)
      return {
        attempted: true,
        ready: false,
        created: false,
        reason: 'The administrator account could not be confirmed after creation.',
      };
  }

  // Promote/verify. Guarded so a correct row is left untouched.
  await pool.query(
    `UPDATE fedexr_auth_user
        SET role = 'admin', "emailVerified" = true, banned = false, "updatedAt" = now()
      WHERE id = $1
        AND (role IS DISTINCT FROM 'admin'
             OR "emailVerified" IS NOT TRUE
             OR banned IS NOT FALSE)`,
    [row.id],
  );

  // Keep ADMIN_PASSWORD authoritative so rotating the variable takes effect
  // without a manual database reset. Only rewritten when it does not match.
  const account = await pool.query(
    `SELECT id, password FROM fedexr_auth_account WHERE "userId" = $1 AND "providerId" = $2`,
    [row.id, CREDENTIAL_PROVIDER],
  );
  const credential = account.rows[0];
  if (!credential)
    return {
      attempted: true,
      ready: false,
      created,
      reason: 'The administrator account has no password credential.',
    };

  const matches = credential.password
    ? await verifyPassword({ hash: credential.password, password: config.adminPassword })
    : false;
  if (!matches) {
    const hashed = await hashPassword(config.adminPassword);
    await pool.query(
      `UPDATE fedexr_auth_account SET password = $1, "updatedAt" = now() WHERE id = $2`,
      [hashed, credential.id],
    );
  }

  return { attempted: true, ready: true, created, passwordUpdated: !matches };
}
