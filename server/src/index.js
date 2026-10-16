import { createServer } from 'node:http';
import { getRuntime } from './runtime.js';

const runtime = getRuntime();
const server = createServer({ maxHeaderSize: 16384 }, runtime.handler);
server.requestTimeout = 20000;
server.headersTimeout = 10000;
server.listen(runtime.config.port, '0.0.0.0', () => {
  console.log(`Account API listening on 0.0.0.0:${runtime.config.port}`);
  if (!runtime.config.ready)
    console.log(
      'Account service is disabled until secure server configuration is supplied. GET /api/account/status lists missing setting names only.',
    );
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(async () => {
      await runtime.close();
      process.exit(0);
    });
    server.closeIdleConnections();
  });
