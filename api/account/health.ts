import { getRuntime } from '../../server/src/runtime.js';

/**
 * Read-only readiness report.
 *
 * Reports booleans plus setting and table names only — never secret values.
 * Used to confirm the database schema and configuration before the site is
 * switched to server-backed accounts.
 */
export default async function handler(req: unknown, res: unknown) {
  return getRuntime().handler(req, res);
}
