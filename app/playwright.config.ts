import { defineConfig } from '@playwright/test';

// Optional overrides let constrained environments use an existing Chromium binary.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const launchArgs = process.env.PLAYWRIGHT_CHROMIUM_ARGS;
const serverAccounts = process.env.PLAYWRIGHT_SERVER_ACCOUNTS === '1';
const testAccountsPort = process.env.PLAYWRIGHT_ACCOUNTS_API_PORT || '3003';
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${serverAccounts ? '5174' : '5173'}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: executablePath
      ? {
          executablePath,
          args: launchArgs
            ? (JSON.parse(launchArgs) as string[]).filter((arg) => arg !== '--disable-web-security')
            : ['--no-sandbox'],
        }
      : undefined,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : serverAccounts
      ? [
          {
            command: 'node ../server/test/browser-host.js',
            env: { NODE_ENV: 'test', TEST_ACCOUNTS_PORT: testAccountsPort },
            url: `http://127.0.0.1:${testAccountsPort}/api/account/status`,
            reuseExistingServer: !process.env.CI,
          },
          {
            command: 'npm run dev -- --port 5174 --mode server-test',
            env: {
              VITE_WORKSPACE_MODE: 'server',
              ACCOUNTS_API_TARGET: `http://127.0.0.1:${testAccountsPort}`,
            },
            url: baseURL,
            reuseExistingServer: !process.env.CI,
          },
        ]
      : {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
        },
});
