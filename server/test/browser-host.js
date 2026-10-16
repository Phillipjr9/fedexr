// Explicit test runner only. This file is never imported by production runtime/API routes.
if (process.env.NODE_ENV !== 'test')
  throw new Error('This isolated browser fixture requires NODE_ENV=test.');
const { createServer } = await import('node:http');
const { randomBytes } = await import('node:crypto');
const { TestPool } = await import('./database.js');
const { configuration } = await import('../src/config.js');
const { migrationPlan } = await import('../src/migrations.js');
const { imageMigrationPlan } = await import('../src/image-migrations.js');
const { createService } = await import('../src/service.js');
const { nodeRequest, nodeResponse } = await import('../src/http.js');
const testPort = Number(process.env.TEST_ACCOUNTS_PORT || 3003);
if (!Number.isInteger(testPort) || testPort < 1024 || testPort > 65535)
  throw new Error('Choose a valid isolated test API port.');
const config = configuration({
  DATABASE_URL: 'postgresql://test:test@localhost/test',
  AUTH_SECRET: randomBytes(32).toString('hex'),
  APP_ORIGIN: 'http://127.0.0.1:5174',
  SMTP_URL: 'smtp://localhost:1025',
  MAIL_FROM: 'test@example.test',
  NODE_ENV: 'test',
});
const pool = new TestPool();
await pool.engine.waitReady;
const migration = await migrationPlan(pool, config);
await migration.auth.runMigrations();
await pool.engine.exec(migration.sql);
await (await imageMigrationPlan(pool)).apply();
const messages = [];
const service = createService({
  pool,
  config,
  mailer: {
    send: async (message) => {
      messages.push(message);
    },
  },
});
for (const email of ['member-server@example.test', 'owner-server@example.test']) {
  const signup = await service.handle(
    new Request(config.origin + '/api/auth/sign-up/email', {
      method: 'POST',
      headers: { origin: config.origin, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: email.startsWith('owner') ? 'Server Owner' : 'Server Member',
        email,
        password: 'test-only-workspace-passphrase-42',
        callbackURL: config.origin + '/login',
      }),
    }),
  );
  if (!signup.ok) throw new Error('Could not create isolated fixture account.');
  const url = messages.at(-1).text.match(/https?:\/\/\S+/)[0];
  await service.handle(new Request(url));
}
await pool.query(
  "UPDATE fedexr_auth_user SET role='admin' WHERE email='owner-server@example.test'",
);
let requestIndex = 1;
const server = createServer(async (req, res) => {
  try {
    const request = await nodeRequest(req, config.origin);
    // Keep independent browser cases from exhausting the shared fixture's auth limits.
    // Production adapters never accept caller-selected IPs; real rate limits are covered by API tests.
    request.headers.set(
      'x-real-ip',
      `198.18.${Math.floor(requestIndex / 250)}.${(requestIndex++ % 250) + 1}`,
    );
    await nodeResponse(await service.handle(request), res);
  } catch {
    res.statusCode = 500;
    res.end('Isolated fixture error');
  }
});
server.listen(testPort, '0.0.0.0', () =>
  console.log(
    `Isolated account API browser fixture ready on port ${testPort}. No external database or email service is used.`,
  ),
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    server.closeIdleConnections();
  });
