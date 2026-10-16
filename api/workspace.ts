import { getRuntime } from '../server/src/runtime.js';

export default async function handler(req: unknown, res: unknown) {
  return getRuntime().handler(req, res);
}
