import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const DATA_KEY = 'fedexr:workspace:v1';
const TAB_KEY = 'fedexr:workspace-session:v1';
const phrase = 'test-only-workspace-phrase-42';
const pageErrors = new WeakMap<Page, string[]>();

async function createProfile(
  page: Page,
  admin = false,
  name = admin ? 'Local Owner' : 'Alex Planner',
  email = admin ? 'owner@example.test' : 'alex@example.test',
) {
  await page.goto(admin ? '/admin/login' : '/login?mode=create');
  await page.getByLabel('Display name', { exact: true }).fill(name);
  await page.getByLabel('Workspace email', { exact: true }).fill(email);
  await page.getByLabel('New workspace passphrase', { exact: true }).fill(phrase);
  await page.getByLabel('Confirm workspace passphrase', { exact: true }).fill(phrase);
  await page
    .getByRole('button', {
      name: admin ? 'Create administrator profile' : 'Create workspace profile',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(admin ? /\/admin\/settings$/ : /\/dashboard$/);
}
async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out of workspace', exact: true }).click();
}
async function signIn(
  page: Page,
  admin = false,
  email = admin ? 'owner@example.test' : 'alex@example.test',
  passphrase = phrase,
) {
  await page.goto(admin ? '/admin/login' : '/login');
  await page.getByLabel('Workspace email', { exact: true }).fill(email);
  await page.getByLabel('Workspace passphrase', { exact: true }).fill(passphrase);
  await page
    .getByRole('button', {
      name: admin ? 'Sign in as administrator' : 'Sign in to workspace',
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () =>
        new URL(page.url()).pathname === (admin ? '/admin/settings' : '/dashboard') ||
        (await page.getByRole('alert').count()) > 0,
    )
    .toBeTruthy();
}
async function planFields(page: Page, recipient = 'Local Recipient') {
  await page.getByLabel('Recipient / project', { exact: true }).fill(recipient);
  await page.getByLabel('Reference (optional)', { exact: true }).fill('LOCAL-12345');
  await page.getByLabel('From ZIP code', { exact: true }).fill('10003');
  await page.getByLabel('To ZIP code', { exact: true }).fill('90001');
  await page.getByLabel('Planned weight (lb)', { exact: true }).fill('5.4');
  await page
    .getByLabel('Planning notes (optional)', { exact: true })
    .fill('Planning record only. Verify actual price with the carrier.');
}
async function createPlan(page: Page, recipient = 'Local Recipient', admin = false) {
  await page.goto(`${admin ? '/admin/settings' : '/dashboard'}?tab=plans`);
  await page.getByRole('button', { name: 'New plan', exact: true }).click();
  await planFields(page, recipient);
  await page.getByRole('button', { name: 'Save shipment plan', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function addressFields(page: Page, label = 'Home') {
  await page.getByLabel('Address label', { exact: false }).fill(label);
  await page.getByLabel('Recipient name', { exact: false }).fill('Alex Planner');
  await page.getByLabel('Street address', { exact: false }).fill('1 Example Street');
  await page.getByLabel('City', { exact: false }).fill('New York');
  await page.getByLabel('State / region', { exact: false }).fill('NY');
  await page.getByLabel('Postal code', { exact: false }).fill('10003');
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page), 'unexpected workspace runtime errors').toEqual([]);
});

test('private workspace routes require local access and obsolete flags cannot open them', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('isAdmin', 'true');
    localStorage.setItem('adminPassword', 'admin');
  });
  await page.goto('/dashboard?tab=plans');
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible();
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
  await expect(page.getByRole('heading', { name: 'Set up your admin workspace' })).toBeVisible();
  expect(
    await page.evaluate(() =>
      ['isAdmin', 'isLoggedIn', 'adminPassword'].map((key) => localStorage.getItem(key)),
    ),
  ).toEqual([null, null, null]);
  await expect(page.getByText('There is no default password.', { exact: false })).toBeVisible();
});

test('profile creation validates details and starts with truthful empty records', async ({
  page,
}) => {
  await page.goto('/login?mode=create');
  const button = page.getByRole('button', { name: 'Create workspace profile', exact: true });
  await button.click();
  await expect(page.getByRole('alert')).toContainText('display name');
  await expect(page.getByLabel('Display name', { exact: true })).toBeFocused();
  await page.getByLabel('Display name', { exact: true }).fill('Alex Planner');
  await page.getByLabel('Workspace email', { exact: true }).fill('invalid');
  await button.click();
  await expect(page.getByRole('alert')).toContainText('valid workspace email');
  await page.getByLabel('Workspace email', { exact: true }).fill('alex@example.test');
  await page.getByLabel('New workspace passphrase', { exact: true }).fill('short');
  await button.click();
  await expect(page.getByRole('alert')).toContainText('10 to 128');
  await page.getByLabel('New workspace passphrase', { exact: true }).fill(phrase);
  await page.getByLabel('Confirm workspace passphrase', { exact: true }).fill('does-not-match');
  await button.click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  await page.getByRole('button', { name: 'Show workspace passphrase', exact: true }).click();
  await expect(page.getByLabel('New workspace passphrase', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page.getByRole('button', { name: 'Hide workspace passphrase', exact: true }).click();
  await page.getByLabel('Confirm workspace passphrase', { exact: true }).fill(phrase);
  await button.click();
  await expect(page.getByRole('heading', { name: 'Hello, Alex' })).toBeVisible();
  await expect(page.locator('.workspace-stat strong')).toHaveText(['0', '0', '0']);
  await expect(page.getByRole('link', { name: 'Open your workspace', exact: true })).toBeVisible();
  const raw = await page.evaluate((key) => localStorage.getItem(key)!, DATA_KEY);
  expect(raw).not.toContain(phrase);
  const data = JSON.parse(raw);
  expect(data.users).toHaveLength(1);
  expect(data.users[0].salt).toMatch(/^[a-f0-9]{32}$/);
  expect(data.users[0].digest).toMatch(/^[a-f0-9]{64}$/);
  expect(data.users[0].role).toBe('member');
  expect(data.plans).toEqual([]);
  expect(data.addresses).toEqual([]);
  expect(await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)!), TAB_KEY)).toEqual({
    userId: data.users[0].id,
  });
});

test('sign-in verifies the passphrase, sign-out clears only the tab session, and internal next routes are preserved', async ({
  page,
}) => {
  await createProfile(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hello, Alex' })).toBeVisible();
  await signOut(page);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), TAB_KEY)).toBeNull();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).users.length, DATA_KEY),
  ).toBe(1);
  await page.goto('/dashboard?tab=addresses');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel('Workspace email', { exact: true }).fill('alex@example.test');
  await page.getByLabel('Workspace passphrase', { exact: true }).fill('wrong-passphrase');
  await page.getByRole('button', { name: 'Sign in to workspace', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await page.getByLabel('Workspace passphrase', { exact: true }).fill(phrase);
  await page.getByRole('button', { name: 'Sign in to workspace', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?tab=addresses$/);
  await expect(page.getByRole('heading', { name: 'Your address book' })).toBeVisible();
  await signOut(page);
  await page.goto('/login?mode=create');
  await page.getByLabel('Display name', { exact: true }).fill('Duplicate');
  await page.getByLabel('Workspace email', { exact: true }).fill('ALEX@example.test');
  await page.getByLabel('New workspace passphrase', { exact: true }).fill(phrase);
  await page.getByLabel('Confirm workspace passphrase', { exact: true }).fill(phrase);
  await page.getByRole('button', { name: 'Create workspace profile', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already uses that email');
});

test('shipment plans support validation, CRUD, statuses, search, persistence, and filtered exports', async ({
  page,
}) => {
  await createProfile(page);
  await page.getByRole('link', { name: 'Create your first plan', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create a shipment plan', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Save shipment plan', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('recipient');
  await planFields(page);
  await page.getByLabel('From ZIP code', { exact: true }).fill('ABCDE');
  await page.getByRole('button', { name: 'Save shipment plan', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ZIP');
  await page.getByLabel('From ZIP code', { exact: true }).fill('10003');
  await page.getByLabel('Planned weight (lb)', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Save shipment plan', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('0.1 to 150');
  await page.getByLabel('Planned weight (lb)', { exact: true }).fill('5.4');
  const date = await page.getByLabel('Planned ship date', { exact: true }).inputValue();
  await page.getByLabel('Planned ship date', { exact: true }).fill('2000-01-01');
  await page.getByRole('button', { name: 'Save shipment plan', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('future');
  await page.getByLabel('Planned ship date', { exact: true }).fill(date);
  await page.getByRole('button', { name: 'Save shipment plan', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: /^Local Recipient/ })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await expect(page.getByRole('button', { name: 'New plan', exact: true })).toBeFocused();
  await page.getByLabel('Status for Local Recipient', { exact: true }).selectOption('ready');
  await page.getByLabel('Search shipment plans', { exact: true }).fill('no-match');
  await expect(page.getByRole('heading', { name: 'No plans match these filters' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear plan filters', exact: true }).click();
  await page.getByRole('button', { name: 'Edit plan for Local Recipient', exact: true }).click();
  await page.getByLabel('Recipient / project', { exact: true }).fill('Updated Recipient');
  await page.getByRole('button', { name: 'Save shipment plan', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Status for Updated Recipient', { exact: true })).toHaveValue(
    'ready',
  );
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export filtered plans', exact: true }).click();
  const download = await downloading;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.records).toHaveLength(1);
  expect(exported.records[0].recipient).toBe('Updated Recipient');
  expect(exported.note).toContain('No carrier bookings');
  await page
    .getByRole('button', { name: 'Remove plan for Updated Recipient', exact: true })
    .click();
  await page.getByRole('button', { name: 'Keep record', exact: true }).click();
  await expect(page.getByRole('cell', { name: /^Updated Recipient/ })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Remove plan for Updated Recipient', exact: true }),
  ).toBeFocused();
  await page
    .getByRole('button', { name: 'Remove plan for Updated Recipient', exact: true })
    .click();
  await page.getByRole('button', { name: 'Remove record', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Your next shipment starts with a plan' }),
  ).toBeVisible();
});

test('address book auto-generates a free sample address that can be saved', async ({ page }) => {
  await createProfile(page);
  await page.goto('/dashboard?tab=addresses');
  await expect(page.getByRole('heading', { name: 'Your address book' })).toBeVisible();
  await page.getByRole('button', { name: 'Generate sample address', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add an address', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#address-name')).not.toHaveValue('');
  await expect(page.locator('#address-city')).not.toHaveValue('');
  await expect(page.locator('#address-region')).not.toHaveValue('');
  await expect(page.locator('#address-postalCode')).toHaveValue(/^\d{5}$/);
  await expect(page.getByText('Sample address generated locally', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Sample address saved.', { exact: false })).toBeVisible();
  await expect(page.locator('.workspace-address')).toHaveCount(1);
});

test('address book validates records and supports edit, preferred default, removal, and reload', async ({
  page,
}) => {
  await createProfile(page);
  await page.goto('/dashboard?tab=addresses');
  await page.getByRole('button', { name: 'Add address', exact: true }).click();
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Complete');
  await addressFields(page);
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.locator('.workspace-address').filter({ hasText: 'Home' })).toContainText(
    'Default',
  );
  await page.getByRole('button', { name: 'Add address', exact: true }).click();
  await addressFields(page, 'Office');
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await page.getByRole('button', { name: 'Set default Office', exact: true }).click();
  await page.reload();
  await expect(page.locator('.workspace-address').first()).toContainText('Office');
  await page.getByRole('button', { name: 'Edit Office', exact: true }).click();
  await page.getByLabel('Street address', { exact: false }).fill('2 Example Avenue');
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.locator('.workspace-address').first()).toContainText('2 Example Avenue');
  await page.getByRole('button', { name: 'Remove address Office', exact: true }).click();
  await page.getByRole('button', { name: 'Remove record', exact: true }).click();
  await expect(page.locator('.workspace-address')).toHaveCount(1);
  await expect(page.locator('.workspace-address')).toContainText('Home');
  await expect(page.locator('.workspace-address')).toContainText('Default');
});

test('personal workspace records and exports are scoped to the selected local profile', async ({
  page,
}) => {
  await createProfile(page);
  await createPlan(page, 'Private Local Recipient');
  await page.goto('/dashboard?tab=addresses');
  await page.getByRole('button', { name: 'Add address', exact: true }).click();
  await addressFields(page);
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await page.goto('/dashboard?tab=profile');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my records', exact: true }).click();
  const download = await downloading;
  const raw = await readFile((await download.path())!, 'utf8');
  expect(raw).not.toMatch(/digest|salt|passphrase/i);
  expect(JSON.parse(raw).plans).toHaveLength(1);
  await signOut(page);
  await createProfile(page, false, 'Second Planner', 'second@example.test');
  await expect(page.locator('.workspace-stat strong')).toHaveText(['0', '0', '0']);
  await page.goto('/dashboard?tab=plans');
  await expect(page.getByText('Private Local Recipient', { exact: true })).toHaveCount(0);
  await page.goto('/dashboard?tab=addresses');
  await expect(page.locator('.workspace-address')).toHaveCount(0);
  const users = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).users,
    DATA_KEY,
  );
  expect(users).toHaveLength(2);
  expect(users[0].salt).not.toBe(users[1].salt);
  expect(users[0].digest).not.toBe(users[1].digest);
});

test('profile changes and current-passphrase verification work without plaintext storage', async ({
  page,
}) => {
  await createProfile(page);
  await page.goto('/dashboard?tab=profile');
  await page.getByLabel('Display name', { exact: true }).fill('Alex Updated');
  await page.getByLabel('Workspace email', { exact: true }).fill('updated@example.test');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.locator('.workspace-identity')).toContainText('updated@example.test');
  const newPhrase = 'new-test-only-phrase-2026';
  await page.getByLabel('Current workspace passphrase', { exact: true }).fill('incorrect-phrase');
  await page.getByLabel('New workspace passphrase', { exact: true }).fill(newPhrase);
  await page.getByLabel('Confirm new workspace passphrase', { exact: true }).fill(newPhrase);
  await page.getByRole('button', { name: 'Update workspace passphrase', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('current workspace passphrase is incorrect');
  await page.getByLabel('Current workspace passphrase', { exact: true }).fill(phrase);
  await page.getByRole('button', { name: 'Update workspace passphrase', exact: true }).click();
  await expect(
    page.getByText('Your workspace passphrase was updated.', { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), DATA_KEY)).not.toContain(
    newPhrase,
  );
  await signOut(page);
  await signIn(page, false, 'updated@example.test', phrase);
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await signIn(page, false, 'updated@example.test', newPhrase);
  await expect(page.getByRole('heading', { name: 'Hello, Alex' })).toBeVisible();
});

test('administrator setup requires an owner-created passphrase and rejects a member in admin routes', async ({
  page,
}) => {
  await createProfile(page);
  await page.goto('/admin/settings?tab=members');
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
  await expect(page.getByRole('heading', { name: 'Set up your admin workspace' })).toBeVisible();
  await createProfile(page, true);
  await expect(page.locator('.workspace-stat strong')).toHaveText(['2', '2', '0', '0', '0', '0', '0', '0']);
  await signOut(page);
  await expect(page.getByRole('heading', { name: 'Administrator sign-in' })).toBeVisible();
  await page.getByLabel('Workspace email', { exact: true }).fill('owner@example.test');
  await page.getByLabel('Workspace passphrase', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Sign in as administrator', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await signIn(page, true, 'alex@example.test');
  await expect(page.getByRole('alert')).toContainText('required access');
  await signIn(page, true);
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();
});

test('administrator profile search and suspension affect local sign-in without changing carrier accounts', async ({
  page,
}) => {
  await createProfile(page);
  await signOut(page);
  await createProfile(page, true);
  await page.goto('/admin/settings?tab=members');
  await page.getByLabel('Search workspace profiles', { exact: true }).fill('alex@');
  await expect(page.locator('.workspace-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Suspend profile Alex Planner', exact: true }).click();
  await expect(page.locator('.workspace-table tbody tr')).toContainText('Suspended');
  await page.getByLabel('Access status', { exact: true }).selectOption('active');
  await expect(
    page.getByRole('heading', { name: 'No profiles match these filters' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear profile filters', exact: true }).click();
  await expect(page.locator('.workspace-table tbody tr')).toHaveCount(2);
  await signOut(page);
  await signIn(page);
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await signIn(page, true);
  await page.goto('/admin/settings?tab=members');
  await page.getByRole('button', { name: 'Activate profile Alex Planner', exact: true }).click();
  await signOut(page);
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('administrator reviews member plans, retains record ownership, and exports no credentials', async ({
  page,
}) => {
  await createProfile(page);
  await createPlan(page, 'Member Recipient');
  await signOut(page);
  await createProfile(page, true);
  await page.goto('/admin/settings?tab=plans');
  await expect(page.getByRole('cell', { name: 'Alex Planner', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'Edit plan for Member Recipient', exact: true }).click();
  await page
    .getByLabel('Planning notes (optional)', { exact: true })
    .fill('Reviewed locally by the workspace owner.');
  await page.getByRole('button', { name: 'Save shipment plan', exact: true }).click();
  await page.getByLabel('Status for Member Recipient', { exact: true }).selectOption('archived');
  await page.goto('/admin/settings');
  await expect(page.locator('.workspace-stat strong')).toHaveText(['2', '2', '1', '0', '0', '0', '0', '0']);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export workspace data', exact: true }).click();
  const download = await downloading;
  const raw = await readFile((await download.path())!, 'utf8');
  const data = JSON.parse(raw);
  expect(data.users).toHaveLength(2);
  expect(data.plans[0].userId).toBe(
    data.users.find((profile: { role: string }) => profile.role === 'member').id,
  );
  expect(data.plans[0].status).toBe('archived');
  expect(raw).not.toMatch(/"digest"|"salt"|"passphrase"|"secret"/i);
});

test('administrator settings persist and announcements appear in personal workspaces', async ({
  page,
}) => {
  await createProfile(page, true);
  await page.goto('/admin/settings?tab=settings');
  await page.getByLabel('Workspace name', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save workspace settings', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('workspace name');
  await page.getByLabel('Workspace name', { exact: true }).fill('Parcel planning team');
  await page
    .getByLabel('Workspace announcement (optional)', { exact: true })
    .fill('Review notes before visiting official shipping tools.');
  await page.getByRole('button', { name: 'Save workspace settings', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Workspace name', { exact: true })).toHaveValue(
    'Parcel planning team',
  );
  await page.getByRole('link', { name: 'Open personal workspace', exact: true }).click();
  await expect(page.locator('.workspace-heading')).toContainText('Parcel planning team');
  await expect(page.locator('.workspace-announcement')).toHaveText(
    'Review notes before visiting official shipping tools.',
  );
});

test('tracking attachment upload validates files and keeps backend authorization separate', async ({
  page,
}) => {
  await createProfile(page, true);
  await page.goto('/admin/settings?tab=attachments&number=LOCAL-12345');
  await expect(page.getByLabel('Tracking reference', { exact: true })).toHaveValue('LOCAL-12345');
  await page.getByRole('button', { name: 'Upload through protected API', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('JPG or PNG');
  await page.locator('#admin-image-file').setInputFiles({
    name: 'unsafe.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByRole('alert')).toContainText('JPG or PNG');
  await page.locator('#admin-image-file').setInputFiles({
    name: 'oversized.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole('alert')).toContainText('2 MB');
  await page.locator('#admin-image-file').setInputFiles('public/images/fedex/office-packing.jpg');
  await page.getByRole('button', { name: 'Upload through protected API', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('server upload key');
  await page.route('**/api/upload-tracking-image', (route) =>
    route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
  );
  await page.getByLabel('Server upload key', { exact: true }).fill('TEST_ONLY_INVALID_UPLOAD_KEY');
  await page.getByRole('button', { name: 'Upload through protected API', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Unauthorized');
  await page.unroute('**/api/upload-tracking-image');
  await page.route('**/api/upload-tracking-image', (route) =>
    route.fulfill({ status: 200, json: { ok: true } }),
  );
  await page.getByRole('button', { name: 'Upload through protected API', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('private attachment API contract');
  await expect(page.getByLabel('Server upload key', { exact: true })).toHaveValue(
    'TEST_ONLY_INVALID_UPLOAD_KEY',
  );
  await page.unroute('**/api/upload-tracking-image');
  let submitted:
    | {
        headers: Record<string, string>;
        body: { trackingNumber: string; eventType: string; dataUrl: string };
      }
    | undefined;
  await page.route('**/api/upload-tracking-image', async (route) => {
    const request = route.request();
    submitted = { headers: await request.allHeaders(), body: request.postDataJSON() };
    await route.fulfill({ status: 200, json: { ok: true, access: 'private' } });
  });
  await page.getByLabel('Attachment category', { exact: true }).selectOption('delivered');
  await page.getByRole('button', { name: 'Upload through protected API', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('configured image API confirmed');
  expect(submitted!.headers['x-admin-secret']).toBe('TEST_ONLY_INVALID_UPLOAD_KEY');
  expect(submitted!.body.trackingNumber).toBe('LOCAL-12345');
  expect(submitted!.body.eventType).toBe('delivered');
  await expect(page.getByText('Saved images are private.', { exact: false })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'View saved application attachment', exact: true }),
  ).toHaveCount(0);
  expect(submitted!.body.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  await expect(page.getByLabel('Server upload key', { exact: true })).toHaveValue('');
  expect(
    await page.evaluate(() => `${JSON.stringify(localStorage)} ${JSON.stringify(sessionStorage)}`),
  ).not.toContain('TEST_ONLY_INVALID_UPLOAD_KEY');
});

test('shipment wizard saves a local plan and downloads a brief without collecting cards or creating a tracking number', async ({
  page,
}) => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url());
  });
  await createProfile(page);
  await page.goto('/shipping/create?from=10003&to=90001&weight=4&service=priority');
  await page.getByLabel('Full Name *', { exact: true }).fill('Sample Sender');
  await page.getByLabel('Street Address *', { exact: true }).fill('1 Example Street');
  await page.getByLabel('City *', { exact: true }).fill('New York');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Full Name *', { exact: true }).fill('Wizard Recipient');
  await page.getByLabel('Street Address *', { exact: true }).fill('2 Example Street');
  await page.getByLabel('City *', { exact: true }).fill('Los Angeles');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.locator('#image-upload').setInputFiles({
    name: 'not-image.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('local fixture'),
  });
  await expect(page.getByRole('alert')).toContainText('JPG or PNG');
  await page.locator('#image-upload').setInputFiles('public/images/fedex/office-packing.jpg');
  await expect(
    page.getByRole('img', { name: 'Local preview of office-packing.jpg', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('button', { name: /FedEx Priority Overnight/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Review your shipment plan', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/Card Number|CVV|Expiry Date/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Save to my workspace', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(
    'No shipping label, tracking number, booking, or charge',
  );
  await page.getByRole('button', { name: 'Update saved plan', exact: true }).click();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).plans.length, DATA_KEY),
  ).toBe(1);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download planning brief', exact: true }).click();
  const download = await downloading;
  const brief = await readFile((await download.path())!, 'utf8');
  expect(brief).toContain('1 Example Street');
  expect(brief).toContain('Wizard Recipient');
  expect(brief).toContain('FedEx Priority Overnight');
  expect(brief).toContain('photo contents are not included or uploaded');
  expect(brief).toContain('No payment information is collected');
  await page.getByRole('link', { name: 'View saved plans', exact: true }).click();
  await expect(page.getByRole('cell', { name: /^Wizard Recipient/ })).toBeVisible();
  expect(posts).toEqual([]);
});

test('workspace routes have genuine photos, bounded layouts, and updated wording; corrupted data fails closed', async ({
  page,
  request,
}) => {
  for (const path of ['/login', '/login?mode=create', '/admin/login']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    const bodyText = await page.locator('body').innerText();
    if (path.startsWith('/login')) {
      await expect(
        page.getByRole('button', { name: 'One-click demo login', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'One-click admin login', exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole('button', { name: 'One-click admin login', exact: true }),
      ).toBeVisible();
    }
    // Only the user-requested one-click demo/admin-demo entries may use the old wording.
    expect(
      bodyText
        .replace(/one-click admin login/gi, '')
        .replace(/admin demo login/gi, '')
        .replace(/demo login/gi, '')
        .replace(/admin demo/gi, '')
        .replace(/demo administrator/gi, ''),
    ).not.toMatch(/de[m]o/i);
    expect(await page.title()).not.toMatch(/de[m]o/i);
    for (const image of await page.locator('.workspace-access-page img').all()) {
      const src = await image.getAttribute('src');
      expect(src).toMatch(/^\/images\/fedex\//);
      expect((await request.get(src!)).ok()).toBeTruthy();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      path,
    ).toBeTruthy();
  }
  await createProfile(page, true);
  for (const path of [
    '/dashboard',
    '/dashboard?tab=plans',
    '/dashboard?tab=addresses',
    '/dashboard?tab=profile',
    '/dashboard?tab=services',
    '/admin/settings',
    '/admin/settings?tab=plans',
    '/admin/settings?tab=members',
    '/admin/settings?tab=settings',
    '/admin/settings?tab=security',
    '/admin/settings?tab=attachments',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(await page.locator('body').innerText()).not.toMatch(/de[m]o/i);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      path,
    ).toBeTruthy();
  }
  await page.evaluate((key) => localStorage.setItem(key, '{broken json'), DATA_KEY);
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
  await expect(page.getByRole('heading', { name: 'Set up your admin workspace' })).toBeVisible();
});

test('a new tab requires its own session and external next URLs are not followed', async ({
  page,
  context,
}) => {
  await createProfile(page);
  const other = await context.newPage();
  await other.goto('/dashboard');
  await expect(other).toHaveURL(/\/login\?next=/);
  await expect(page).toHaveURL(/\/dashboard$/);
  await other.close();
  await signOut(page);
  await page.goto('/login?next=https%3A%2F%2Fexample.test%2Foutside');
  await page.getByLabel('Workspace email', { exact: true }).fill('alex@example.test');
  await page.getByLabel('Workspace passphrase', { exact: true }).fill(phrase);
  await page.getByRole('button', { name: 'Sign in to workspace', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('workspace writes report storage failures without claiming records were saved', async ({
  page,
}) => {
  await createProfile(page);
  await page.goto('/dashboard?tab=plans');
  await page.getByRole('button', { name: 'New plan', exact: true }).click();
  await planFields(page);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Fixture quota failure', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, DATA_KEY);
  await page.getByRole('button', { name: 'Save shipment plan', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Your change was not saved');
  await expect(
    page.getByRole('dialog', { name: 'Create a shipment plan', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).plans.length, DATA_KEY),
  ).toBe(0);
});

test('suspension in another tab invalidates local access and activation requires a new sign-in', async ({
  page,
  context,
}) => {
  await createProfile(page);
  const administrator = await context.newPage();
  const errors: string[] = [];
  administrator.on('pageerror', (error) => errors.push(error.message));
  await createProfile(administrator, true);
  await administrator.goto('/admin/settings?tab=members');
  await administrator
    .getByRole('button', { name: 'Suspend profile Alex Planner', exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(await page.evaluate((key) => sessionStorage.getItem(key), TAB_KEY)).toBeNull();
  await administrator
    .getByRole('button', { name: 'Activate profile Alex Planner', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible();
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(errors).toEqual([]);
  await administrator.close();
});

test('application image attachments use the selected event category without implying live delivery proof', async ({
  page,
}) => {
  const bytes = await readFile('public/images/fedex/office-packing.jpg');
  const dataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`;
  let requestedEvent = '';
  await page.route('**/api/get-tracking-image?**', async (route) => {
    requestedEvent = new URL(route.request().url()).searchParams.get('event') || '';
    await route.fulfill({ status: 200, json: { access: 'private', found: true, dataUrl } });
  });
  await page.goto('/tracking?number=LOCAL-12345&event=delivered');
  await page.getByRole('button', { name: 'Track', exact: true }).click();
  const image = page.getByRole('img', { name: 'Application image attachment', exact: true });
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('src', dataUrl);
  expect(requestedEvent).toBe('delivered');
  await expect(page.getByText('Delivered (sample)', { exact: true })).toBeVisible();
  await expect(page.getByText('not live FedEx carrier scans', { exact: false })).toBeVisible();
  await page.goto('/tracking?number=LOCAL-12345&event=unsupported');
  await page.getByRole('button', { name: 'Track', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Application image attachment', exact: true }),
  ).toBeVisible();
  expect(requestedEvent).toBe('default');
});
