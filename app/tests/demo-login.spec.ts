import { test, expect, type Page } from '@playwright/test';

test.skip(
  process.env.PLAYWRIGHT_SERVER_ACCOUNTS === '1',
  'Browser-local demo login suite; server mode has a separate no-demo-access check.',
);

const DATA_KEY = 'fedexr:workspace:v1';
const phrase = 'demo-login-test-only-phrase-42';
const runtimeErrors = new WeakMap<Page, string[]>();

type StoredUser = {
  id: string;
  email: string;
  role: string;
  demo?: boolean;
  salt?: string;
  digest?: string;
};
type StoredWorkspace = {
  users: StoredUser[];
  plans: Array<{ userId: string; reference: string }>;
  addresses: Array<{ userId: string; label: string }>;
};

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/get-tracking-image?**', (route) =>
    route.fulfill({ status: 404, json: { access: 'private', found: false } }),
  );
});

test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page), 'unexpected demo-login runtime errors').toEqual([]);
});

async function storedWorkspace(page: Page): Promise<StoredWorkspace | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredWorkspace) : null;
  }, DATA_KEY);
}

async function openDemo(page: Page) {
  await page.getByRole('button', { name: 'One-click demo login', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await expect(page.getByRole('heading', { name: 'Hello, Demo', exact: true })).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out of workspace', exact: true }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'page should not overflow horizontally',
  ).toBeTruthy();
}

test('one-click demo login opens a populated member workspace and sample tracking', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Demo login', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Admin login', exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Continue to admin login', exact: true }),
  ).toHaveAttribute('href', '/admin/login');
  await expect(
    page.getByText('No password or FedEx account is needed', { exact: false }),
  ).toBeVisible();
  await openDemo(page);

  await expect(page.getByText('Demo user', { exact: false }).first()).toBeVisible();
  await expect(
    page.locator('.workspace-stat').filter({ hasText: 'Saved shipment plans' }),
  ).toContainText('2');
  await expect(
    page.locator('.workspace-stat').filter({ hasText: 'Ready to review' }),
  ).toContainText('1');
  await expect(
    page.locator('.workspace-stat').filter({ hasText: 'Saved addresses' }),
  ).toContainText('2');
  await expect(
    page.getByRole('heading', { name: 'Monitor a sample shipment', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'View sample tracking', exact: true }),
  ).toHaveAttribute('href', '/tracking?number=LOCAL-12345');
  await expect(
    page.getByRole('link', {
      name: 'View sample tracking for Demo recipient — Riverbend order',
      exact: true,
    }),
  ).toBeVisible();

  const stored = await storedWorkspace(page);
  const demo = stored?.users.find((user) => user.email === 'demo@workspace.local');
  expect(demo).toMatchObject({ id: 'demo-workspace-user', role: 'member', demo: true });
  expect(demo?.salt).toBeUndefined();
  expect(demo?.digest).toBeUndefined();
  expect(stored?.plans.filter((plan) => plan.userId === demo?.id)).toHaveLength(2);
  expect(stored?.addresses.filter((address) => address.userId === demo?.id)).toHaveLength(2);
  await expectNoOverflow(page);

  await page.getByRole('link', { name: 'View sample tracking', exact: true }).click();
  await expect(page).toHaveURL(/\/tracking\?number=LOCAL-12345$/);
  await expect(page.getByText('Delivered (sample)', { exact: true })).toBeVisible();
  await expect(page.locator('.fx-reference-number')).toHaveText('LOCAL-12345');
  await expectNoOverflow(page);

  await page.goto('/dashboard?tab=plans');
  await expect(
    page.locator('.workspace-table tbody tr').filter({ hasText: 'Demo recipient — Riverbend order' }),
  ).toHaveCount(1);
  await expect(
    page.locator('.workspace-table tbody tr').filter({ hasText: 'Demo recipient — Office restock' }),
  ).toHaveCount(1);
  await page.goto('/dashboard?tab=addresses');
  await expect(page.getByText('128 Sample Street', { exact: false })).toBeVisible();
  await expect(page.getByText('450 Sample Avenue', { exact: false })).toBeVisible();
  await page.goto('/dashboard?tab=profile');
  await expect(page.getByRole('heading', { name: 'Demo access', exact: true })).toBeVisible();
  await expect(page.getByLabel('Workspace email', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Current workspace passphrase', { exact: true })).toHaveCount(0);

  await page.goto('/dashboard');
  await signOut(page);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=/);

  await openDemo(page);
  const reopened = await storedWorkspace(page);
  expect(reopened?.users.filter((user) => user.demo)).toHaveLength(1);
  expect(reopened?.plans.filter((plan) => plan.userId === demo?.id)).toHaveLength(2);
  expect(reopened?.addresses.filter((address) => address.userId === demo?.id)).toHaveLength(2);
});

test('demo login preserves a separate real browser profile and its passphrase sign-in', async ({
  page,
}) => {
  await page.goto('/login?mode=create');
  await page.getByLabel('Display name', { exact: true }).fill('Alex Planner');
  await page.getByLabel('Workspace email', { exact: true }).fill('alex-demo-check@example.test');
  await page.getByLabel('New workspace passphrase', { exact: true }).fill(phrase);
  await page.getByLabel('Confirm workspace passphrase', { exact: true }).fill(phrase);
  await page.getByRole('button', { name: 'Create workspace profile', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.locator('.workspace-stat').filter({ hasText: 'Saved shipment plans' }),
  ).toContainText('0');
  await signOut(page);

  await openDemo(page);
  await expect(
    page.getByRole('heading', { name: 'Monitor a sample shipment', exact: true }),
  ).toBeVisible();
  await signOut(page);

  await page.getByLabel('Workspace email', { exact: true }).fill('alex-demo-check@example.test');
  await page.getByLabel('Workspace passphrase', { exact: true }).fill(phrase);
  await page.getByRole('button', { name: 'Sign in to workspace', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Hello, Alex', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Monitor a sample shipment', exact: true }),
  ).toHaveCount(0);
  const stored = await storedWorkspace(page);
  expect(stored?.users).toHaveLength(2);
  expect(stored?.users.find((user) => user.email === 'alex-demo-check@example.test')).toMatchObject(
    { role: 'member' },
  );
  expect(
    stored?.users.find((user) => user.email === 'alex-demo-check@example.test')?.digest,
  ).toEqual(expect.any(String));
  expect(JSON.stringify(stored)).not.toContain(phrase);
});

test('demo access is member-only, is not an admin shortcut, and honors a plans deep link', async ({
  page,
}) => {
  await page.goto('/admin/login');
  await expect(
    page.getByRole('button', { name: 'One-click demo login', exact: true }),
  ).toHaveCount(0);

  await page.goto('/login?mode=create&next=%2Fdashboard%3Ftab%3Dplans');
  await expect(page.getByRole('heading', { name: 'Demo login', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'One-click demo login', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?tab=plans$/);
  await expect(
    page.getByRole('heading', { name: 'Your shipment plans', exact: true }),
  ).toBeVisible();

  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
  await expect(
    page.getByRole('heading', { name: 'Set up your admin workspace', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('currently signed in as a member', { exact: false })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'One-click demo login', exact: true }),
  ).toHaveCount(0);

  await page.goto('/dashboard');
  await signOut(page);
  await page.getByLabel('Workspace email', { exact: true }).fill('demo@workspace.local');
  await page.getByLabel('Workspace passphrase', { exact: true }).fill('not-a-demo-passphrase');
  await page.getByRole('button', { name: 'Sign in to workspace', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Use the one-click demo login');

  await openDemo(page);
  await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error('Demo workspace was not stored.');
    const data = JSON.parse(raw) as StoredWorkspace & { users: Array<Record<string, unknown>> };
    const demo = data.users.find((user) => user.id === 'demo-workspace-user');
    if (!demo) throw new Error('Demo profile was not stored.');
    demo.role = 'admin';
    localStorage.setItem(key, JSON.stringify(data));
  }, DATA_KEY);
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
  await expect(
    page.getByRole('heading', { name: 'Workspace administration', exact: true }),
  ).toHaveCount(0);
});
