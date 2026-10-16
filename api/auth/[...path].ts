import { getRuntime } from '../../server/src/runtime.js';

// The shared adapter handles parsed or streamed request bodies and preserves HttpOnly cookies.
export default async function handler(req: unknown, res: unknown) {
  return getRuntime().handler(req, res);
}
