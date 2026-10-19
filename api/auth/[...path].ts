type NodeResponse = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: string) => void;
};

// The shared adapter handles parsed or streamed request bodies and preserves HttpOnly cookies.
// The runtime is constructed eagerly, so a failure while building it escapes the
// shared handler's JSON error path: Vercel answers with an HTML 500 that the
// browser client cannot parse, and the interface can only say the account API is
// unavailable, with no reason attached. Importing dynamically inside try/catch
// turns that into a readable JSON message.
//
// Secrets are redacted first — a database error can carry the connection string,
// and this text reaches the browser.
export default async function handler(req: unknown, res: NodeResponse) {
  try {
    const { getRuntime } = await import('../../server/src/runtime.js');
    return await getRuntime().handler(req, res);
  } catch (error) {
    const reason = (error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error')
      .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[database-url-redacted]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify({ error: `The account service could not start: ${reason}` }));
  }
}
