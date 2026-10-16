import { test, expect, type Page } from '@playwright/test';

test.skip(
  process.env.PLAYWRIGHT_SERVER_ACCOUNTS === '1',
  'Browser-local admin discovery/setup suite; server roles have separate tests.',
);
const ownerEmail = 'local-owner@example.test';
const ownerPhrase = 'local-owner-test-only-phrase-42';
const memberEmail = 'local-member@example.test';
const memberPhrase = 'local-member-test-only-phrase-42';
const runtimeErrors = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});

async function createOwner(page: Page) {
  await page.goto('/admin/login');
  await expect(
    page.getByRole('heading', { name: 'Set up your admin workspace', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Display name', { exact: true }).fill('Local Owner');
  await page.getByLabel('Workspace email', { exact: true }).fill(ownerEmail);
  await page.getByLabel('New workspace passphrase', { exact: true }).fill(ownerPhrase);
  await page.getByLabel('Confirm workspace passphrase', { exact: true }).fill(ownerPhrase);
  await page.getByRole('button', { name: 'Create administrator profile', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
}
async function logout(page: Page) {
  await page.getByRole('button', { name: 'Sign out of workspace', exact: true }).click();
  await expect(page).toHaveURL(/\/(?:admin\/login|login)(?:\?|$)/);
}
async function signinOwner(page: Page, next?: string) {
  await page.goto('/admin/login' + (next ? `?next=${encodeURIComponent(next)}` : ''));
  await page.getByLabel('Workspace email', { exact: true }).fill(ownerEmail);
  await page.getByLabel('Workspace passphrase', { exact: true }).fill(ownerPhrase);
  await page.getByRole('button', { name: 'Sign in as administrator', exact: true }).click();
}

test('admin login is reachable from the account menu, footer, and personal access screen', async ({
  page,
}) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Account access options', exact: true });
  await menu.focus();
  await menu.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.locator('main')).not.toHaveAttribute('aria-hidden', 'true');
  await page.getByRole('menuitem', { name: 'Admin login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Set up your admin workspace', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create administrator profile', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sign in as administrator', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Set up local administrator', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('footer').getByRole('link', { name: 'Admin login', exact: true }),
  ).toHaveAttribute('href', '/admin/login');
  await page.goto('/admin?next=%2Fadmin%2Fsettings%3Ftab%3Dattachments');
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fsettings%3Ftab%3Dattachments$/);
  await expect(
    page.getByRole('heading', { name: 'Set up your admin workspace', exact: true }),
  ).toBeVisible();
  await page.goto('/admin/login?next=https%3A%2F%2Foutside.example%2F');
  await expect(
    page.getByRole('heading', { name: 'Set up your admin workspace', exact: true }),
  ).toBeVisible();
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Admin login', exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Continue to admin login', exact: true }),
  ).toHaveAttribute('href', '/admin/login');
  await page.getByRole('link', { name: 'Continue to admin login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Set up your admin workspace', exact: true }),
  ).toBeVisible();
  await page.goto('/login');
  await page
    .locator('.workspace-access-links')
    .getByRole('link', { name: 'Admin login', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('first-time admin setup uses owner-chosen credentials, then canonical login verifies the passphrase', async ({
  page,
}) => {
  await createOwner(page);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(ownerPhrase);
  await logout(page);
  await page.goto('/admin/login');
  await expect(
    page.getByRole('link', { name: 'Set up local administrator', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Workspace email', { exact: true }).fill(ownerEmail);
  await page.getByLabel('Workspace passphrase', { exact: true }).fill('wrong-owner-phrase');
  await page.getByRole('button', { name: 'Sign in as administrator', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await page.getByLabel('Workspace passphrase', { exact: true }).fill(ownerPhrase);
  await page.getByRole('button', { name: 'Sign in as administrator', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await page.goto('/tracking');
  await page.getByRole('button', { name: 'Account access options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Admin dashboard', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Admin dashboard', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
});

test('one-click admin login opens the browser-local demo administrator workspace', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Admin login', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'One-click admin login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();
  await expect(
    page.locator('.workspace-identity').getByText('Demo Administrator', { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.workspace-stat').filter({ hasText: 'Workspace profiles' }),
  ).toContainText('2');
  await expect(
    page.locator('.workspace-stat').filter({ hasText: 'Local shipment plans' }),
  ).toContainText('2');

  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('fedexr:workspace:v1');
    return raw
      ? (JSON.parse(raw) as {
          users: Array<Record<string, unknown>>;
          plans: Array<Record<string, unknown>>;
        })
      : null;
  });
  const adminDemo = stored?.users.find((user) => user.email === 'demo-admin@workspace.local');
  expect(adminDemo).toMatchObject({
    id: 'demo-admin-workspace-user',
    role: 'admin',
    demo: true,
  });
  expect(adminDemo).not.toHaveProperty('salt');
  expect(adminDemo).not.toHaveProperty('digest');
  expect(stored?.users.find((user) => user.email === 'demo@workspace.local')).toMatchObject({
    role: 'member',
    demo: true,
  });
  expect(stored?.plans).toHaveLength(2);

  await page.goto('/admin/settings?tab=security');
  await expect(page.getByRole('heading', { name: 'Demo access', exact: true })).toBeVisible();
  await expect(page.getByText('One-click admin login has no passphrase', { exact: false })).toBeVisible();
  await logout(page);
  await expect(
    page.getByRole('button', { name: 'One-click admin login', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'One-click admin login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
});

test('admin overview summarizes public shipments, attention items, and profile records', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'One-click admin login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);

  await expect(
    page.locator('.workspace-stat').filter({ hasText: 'Active public shipments' }),
  ).toContainText('2');
  await expect(
    page.locator('.workspace-stat').filter({ hasText: 'In transit or out for delivery' }),
  ).toContainText('1');
  await expect(
    page.locator('.workspace-stat').filter({ hasText: 'Delivered shipments' }),
  ).toContainText('1');
  await expect(page.getByRole('heading', { name: 'Needs attention', exact: true })).toBeVisible();
  await expect(page.getByText('Nothing needs attention', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Recently updated shipments', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Manage public shipments', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'FedEx API', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings\?tab=carrier/);
  await expect(page.getByRole('heading', { name: 'FedEx API settings', exact: true })).toBeVisible();
  await expect(page.getByText('FedEx credentials are not entered', { exact: false })).toBeVisible();
  await expect(page.getByText('You are in browser-local mode.', { exact: false })).toBeVisible();

  await page.getByRole('link', { name: 'Workspace profiles', exact: true }).click();
  const demoRow = page.locator('tr').filter({ hasText: 'demo@workspace.local' });
  await expect(demoRow).toContainText('2 shipments');
  await expect(demoRow).toContainText('2 plans');
  await demoRow.getByRole('button', { name: /shipments assigned to/ }).first().click();
  await expect(page.getByText('LOCAL-12345 — Delivered', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('748512903645 — In transit', { exact: false }).first()).toBeVisible();
});

test('credentialed administrator setup replaces the admin demo and disables one-click admin login', async ({
  page,
}) => {
  await page.goto('/admin/login');
  await page.getByRole('button', { name: 'One-click admin login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await logout(page);

  await createOwner(page);
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('fedexr:workspace:v1');
    return raw ? (JSON.parse(raw) as { users: Array<Record<string, unknown>> }) : null;
  });
  expect(
    stored?.users.find((user) => user.email === 'demo-admin@workspace.local'),
  ).toBeUndefined();
  expect(stored?.users.find((user) => user.email === ownerEmail)).toMatchObject({
    role: 'admin',
  });

  await logout(page);
  await page.goto('/login');
  await expect(
    page.getByRole('button', { name: 'One-click admin login', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('One-click admin login is unavailable after a credentialed administrator', {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto('/admin/login');
  await expect(
    page.getByRole('button', { name: 'One-click admin login', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Administrator sign-in', exact: true }),
  ).toBeVisible();
});

test('member credentials and old admin flags do not grant administration', async ({ page }) => {
  await createOwner(page);
  await logout(page);
  await page.goto('/login?mode=create');
  await page.getByLabel('Display name', { exact: true }).fill('Local Member');
  await page.getByLabel('Workspace email', { exact: true }).fill(memberEmail);
  await page.getByLabel('New workspace passphrase', { exact: true }).fill(memberPhrase);
  await page.getByLabel('Confirm workspace passphrase', { exact: true }).fill(memberPhrase);
  await page.getByRole('button', { name: 'Create workspace profile', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/admin/login');
  await expect(page.getByText('currently signed in as a member', { exact: false })).toBeVisible();
  await page.getByLabel('Workspace email', { exact: true }).fill(memberEmail);
  await page.getByLabel('Workspace passphrase', { exact: true }).fill(memberPhrase);
  await page.getByRole('button', { name: 'Sign in as administrator', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('required access');
  await page.evaluate(() => {
    localStorage.setItem('isAdmin', 'true');
    localStorage.setItem('isLoggedIn', 'true');
  });
  await page.goto('/admin/settings?tab=attachments');
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
  await expect(
    page.getByRole('heading', { name: 'Administrator sign-in', exact: true }),
  ).toBeVisible();
});

test('canonical admin login preserves valid next routes and rejects external redirects', async ({
  page,
}) => {
  await createOwner(page);
  await logout(page);
  await signinOwner(page, '/admin/settings?tab=attachments');
  await expect(page).toHaveURL(/\/admin\/settings\?tab=attachments$/);
  await expect(
    page.getByRole('heading', { name: 'Tracking image attachments', exact: true }),
  ).toBeVisible();
  await logout(page);
  await signinOwner(page, 'https://outside.example/');
  await expect(page).toHaveURL(/\/admin\/settings$/);
});

test('account menu and mobile drawer expose admin access without horizontal overflow', async ({
  page,
}) => {
  await page.goto('/');
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    const trigger = page.getByRole('button', { name: 'Account access options', exact: true });
    await trigger.click();
    await expect(page.getByRole('menuitem', { name: 'Admin login', exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Main menu', exact: true })
    .getByRole('link', { name: 'Admin login', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('personal creation mode follows account-menu URLs when already on the login page', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Account access options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create profile', exact: true }).click();
  await expect(page.getByLabel('Display name', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Display name', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Account access options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Create profile', exact: true }).click();
  await expect(page.getByLabel('Display name', { exact: true })).toBeVisible();
});
