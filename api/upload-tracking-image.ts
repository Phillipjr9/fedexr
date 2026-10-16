import { getRuntime } from '../server/src/runtime.js';

// Shared validation, private authorization, limits, and storage; no request-time DDL.
export default async function handler(req: unknown, res: unknown) {
  return getRuntime().handler(req, res);
}
