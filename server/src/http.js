import { MAX_IMAGE_JSON_BYTES } from './image-data.js';
import { HttpError } from './validation.js';

export async function nodeRequest(req, origin) {
  const pathname = new URL(req.url || '/', origin || 'http://127.0.0.1').pathname.replace(
    /\/+$/,
    '',
  );
  const isShipmentWrite =
    ['POST', 'PUT'].includes(req.method || '') &&
    pathname.startsWith('/api/workspace/shipments');
  const maxBytes =
    req.method === 'POST' && pathname === '/api/upload-tracking-image'
      ? MAX_IMAGE_JSON_BYTES
      : isShipmentWrite
        ? 512 * 1024
        : 16 * 1024;
  const limitMessage =
    req.method === 'POST' && pathname === '/api/upload-tracking-image'
      ? 'Attachment request exceeds the 2 MB image limit.'
      : isShipmentWrite
        ? 'Shipment requests are limited to 512 KB, including the stage photo.'
        : 'Account request bodies are limited to 16 KB.';
  const encoding = req.headers?.['content-encoding'];
  if (encoding && encoding !== 'identity')
    throw new HttpError(415, 'Compressed API requests are not supported.');
  const declaredSize = req.headers?.['content-length'];
  if (
    declaredSize !== undefined &&
    (!/^\d+$/.test(String(declaredSize)) || Number(declaredSize) > maxBytes)
  )
    throw new HttpError(413, limitMessage);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (
      value !== undefined &&
      ![
        'host',
        'content-length',
        'connection',
        'transfer-encoding',
        'x-real-ip',
        'x-forwarded-for',
      ].includes(key.toLowerCase())
    )
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  // Do not let a client choose its rate-limit identity. Vercel's platform header is trusted only there.
  const platformIP =
    process.env.VERCEL === '1'
      ? String(req.headers['x-vercel-forwarded-for'] || '')
          .split(',')[0]
          .trim()
      : '';
  headers.set('x-real-ip', platformIP || req.socket?.remoteAddress || 'unknown');
  let body;
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    if (req.body !== undefined)
      body = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    else {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > maxBytes) throw new HttpError(413, limitMessage);
        chunks.push(Buffer.from(chunk));
      }
      body = Buffer.concat(chunks);
    }
    if (body.length > maxBytes) throw new HttpError(413, limitMessage);
    if (!body.length) body = Buffer.from('{}');
  }
  return new Request(new URL(req.url || '/', origin || 'http://127.0.0.1'), {
    method: req.method || 'GET',
    headers,
    body,
  });
}
export async function nodeResponse(response, res) {
  res.statusCode = response.status;
  for (const [key, value] of response.headers) if (key !== 'set-cookie') res.setHeader(key, value);
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader('set-cookie', cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}
export function nodeHandler(service, config) {
  return async (req, res) => {
    try {
      await nodeResponse(await service.handle(await nodeRequest(req, config.origin)), res);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 503;
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(
        JSON.stringify({
          error: error instanceof HttpError ? error.message : 'The account service is unavailable.',
        }),
      );
    }
  };
}
