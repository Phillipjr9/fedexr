import { healthReport } from '../../server/src/health.js';

type NodeResponse = {
  statusCode?: number;
  setHeader?: (name: string, value: string) => void;
  end?: (chunk?: string) => void;
};

/**
 * Read-only readiness report for GET /api/account/health.
 *
 * This deliberately does NOT go through the shared runtime. Every other API
 * route imports runtime.js, which pulls in sharp and better-auth at module
 * scope; if either fails to load, the function dies during initialization and
 * the visitor sees an opaque 500 FUNCTION_INVOCATION_FAILED with no detail.
 *
 * Standing alone, this endpoint can name that failure instead of inheriting it.
 * It always answers 200 with JSON, because a health endpoint that 500s tells
 * you nothing.
 */
export default async function handler(_req: unknown, res: NodeResponse) {
  let body: string;
  try {
    body = JSON.stringify(await healthReport(), null, 2);
  } catch (error) {
    // Last resort: still report, still without secret values.
    body = JSON.stringify(
      {
        ready: false,
        fatal: error instanceof Error ? error.message.slice(0, 300) : 'Unknown error',
      },
      null,
      2,
    );
  }
  if (res && typeof res.setHeader === 'function' && typeof res.end === 'function') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(body);
  }
}
