import { test, expect, type Page } from '@playwright/test';

// Run against the explicit server-mode Vite instance and isolated PostgreSQL test engine.
test.skip(
  process.env.PLAYWRIGHT_SERVER_ACCOUNTS !== '1',
  'Requires isolated server account fixture.',
);
const password = 'test-only-workspace-passphrase-42';
async function signin(page: Page, admin = false) {
  await page.goto(admin ? '/admin/login' : '/login');
  await page
    .getByLabel('Workspace email', { exact: true })
    .fill(admin ? 'owner-server@example.test' : 'member-server@example.test');
  await page.getByLabel('Workspace passphrase', { exact: true }).fill(password);
  await page
    .getByRole('button', {
      name: admin ? 'Sign in as administrator' : 'Sign in to workspace',
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(admin ? /\/admin\/settings$/ : /\/dashboard$/);
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const values: string[] = [];
  errors.set(page, values);
  page.on('pageerror', (error) => values.push(error.message));
});
test.afterEach(({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

test('server account access ignores browser flags and has no public administrator setup', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('isAdmin', 'true');
    localStorage.setItem('isLoggedIn', 'true');
  });
  await page.goto('/admin/settings');
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
  await expect(page.getByRole('heading', { name: 'Administrator sign-in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create administrator profile' })).toHaveCount(0);
  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: 'Administrator sign-in' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'One-click admin login', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Set up local administrator', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create administrator profile' })).toHaveCount(0);
  await expect(page.getByText('Independent server-backed account', { exact: true })).toBeVisible();
  await page.getByLabel('Workspace email', { exact: true }).fill('member-server@example.test');
  await page.getByLabel('Workspace passphrase', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in as administrator', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('does not have administrator access');
});

test('server login does not offer one-click demo access', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Admin login', exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Continue to admin login', exact: true }),
  ).toHaveAttribute('href', '/admin/login');
  await expect(
    page.getByRole('button', { name: 'One-click demo login', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'One-click admin login', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('One-click demo login is disabled when server accounts are enabled', {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=/);
});

test('server sign-in persists through reload without JavaScript-stored credentials and sign-out revokes it', async ({
  page,
}) => {
  await signin(page);
  await expect(page.getByText('Server-backed records', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hello, Server' })).toBeVisible();
  const stored = await page.evaluate(
    () => JSON.stringify(localStorage) + JSON.stringify(sessionStorage) + document.cookie,
  );
  expect(stored).not.toContain(password);
  expect(stored).not.toContain('session_token');
  expect(stored).not.toContain('member-server@example.test');
  await page.getByRole('button', { name: 'Sign out of workspace', exact: true }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=/);
});

test('saved plans are database-backed and visible in another signed-in browser context', async ({
  page,
  browser,
}) => {
  await signin(page);
  await page.goto('/dashboard?tab=plans');
  await page.getByRole('button', { name: 'New plan', exact: true }).click();
  const recipient = `Shared ${test.info().project.name} ${Date.now()}`;
  await page.getByLabel('Recipient / project', { exact: true }).fill(recipient);
  await page.getByLabel('From ZIP code', { exact: true }).fill('10003');
  await page.getByLabel('To ZIP code', { exact: true }).fill('90001');
  await page.getByRole('button', { name: 'Save shipment plan', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: new RegExp(`^${recipient}`) })).toBeVisible();
  const otherContext = await browser.newContext({
    baseURL: test.info().project.use.baseURL || process.env.PLAYWRIGHT_BASE_URL,
  });
  const other = await otherContext.newPage();
  await signin(other);
  await other.goto('/dashboard?tab=plans');
  await expect(other.getByRole('cell', { name: new RegExp(`^${recipient}`) })).toBeVisible();
  await otherContext.close();
  await page.getByRole('button', { name: `Remove plan for ${recipient}`, exact: true }).click();
  await page.getByRole('button', { name: 'Remove record', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: new RegExp(`^${recipient}`) })).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

test('address and administrator settings mutations wait for server confirmation', async ({
  page,
}) => {
  await signin(page);
  await page.goto('/dashboard?tab=addresses');
  await page.getByRole('button', { name: 'Add address', exact: true }).click();
  const label = `Office ${test.info().project.name} ${Date.now()}`;
  for (const [field, value] of [
    ['Address label', label],
    ['Recipient name', 'Server Member'],
    ['Street address', '1 Example Street'],
    ['City', 'New York'],
    ['Postal code', '10003'],
  ])
    await page.getByLabel(field, { exact: false }).fill(value);
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.workspace-address').filter({ hasText: label })).toBeVisible();
  await page.getByRole('button', { name: `Remove address ${label}`, exact: true }).click();
  await page.getByRole('button', { name: 'Remove record', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out of workspace', exact: true }).click();
  await signin(page, true);
  await page.goto('/admin/settings?tab=settings');
  await page.getByLabel('Workspace name', { exact: true }).fill('Shared server workspace');
  await page
    .getByLabel('Workspace announcement (optional)', { exact: true })
    .fill('Saved to the account database.');
  await page.getByRole('button', { name: 'Save workspace settings', exact: true }).click();
  await expect(
    page.getByText('Workspace settings saved to the shared database.', { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Workspace name', { exact: true })).toHaveValue(
    'Shared server workspace',
  );
});

test('registration requires email verification and recovery does not reveal account existence', async ({
  page,
}) => {
  await page.goto('/login?mode=create');
  await page.getByLabel('Display name', { exact: true }).fill('Pending Member');
  await page
    .getByLabel('Workspace email', { exact: true })
    .fill(`pending-${Date.now()}@example.test`);
  await page.getByLabel('New workspace passphrase', { exact: true }).fill(password);
  await page.getByLabel('Confirm workspace passphrase', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create workspace profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check your workspace email' })).toBeVisible();
  await expect(page).not.toHaveURL(/\/dashboard/);
  await page.goto('/login?mode=recover');
  await page.getByLabel('Workspace email', { exact: true }).fill('missing@example.test');
  await page.getByRole('button', { name: 'Request recovery email', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('If an eligible account matches');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

test('server administrator creates a public shipment tracked by guests and assigned members', async ({
  page,
  browser,
}) => {
  await signin(page, true);
  const number = `SERVER-${test.info().project.name.toUpperCase()}-${Date.now()}`;
  await page.goto('/admin/settings?tab=shipments');
  await page.getByRole('button', { name: 'Create shipment', exact: true }).first().click();
  await page
    .locator('#shipment-user')
    .selectOption({ label: 'Server Member — member-server@example.test' });
  await page.locator('#shipment-tracking').fill(number);
  await page.locator('#shipment-origin-city').fill('New York');
  await page.locator('#shipment-origin-region').fill('NY');
  await page.locator('#shipment-origin-postal').fill('10001');
  await page.locator('#shipment-destination-city').fill('Boston');
  await page.locator('#shipment-destination-region').fill('MA');
  await page.locator('#shipment-destination-postal').fill('02101');
  await page.locator('#shipment-estimated-delivery').fill('2026-10-20');
  await page.locator('#shipment-status').selectOption('in_transit');
  await page.locator('#shipment-current-location').fill('NEW YORK, NY');
  await page.locator('#shipment-public-note').fill('Server-backed public shipment.');
  await page.getByRole('button', { name: 'Create shipment', exact: true }).last().click();
  await expect(page.getByText(`${number} is ready`, { exact: false })).toBeVisible();
  const row = page.locator('tr').filter({ hasText: number });
  await row.getByRole('button', { name: 'Modify status', exact: true }).click();
  await page.locator('#shipment-update-status').selectOption('out_for_delivery');
  await page.locator('#shipment-update-location').fill('BOSTON, MA');
  await page.locator('#shipment-update-note').fill('Out for delivery from the server database');
  await page.getByRole('button', { name: 'Save status update', exact: true }).click();
  await expect(page.getByText(`Status update published for ${number}`)).toBeVisible();

  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5174',
  });
  const guest = await context.newPage();
  try {
    await guest.goto(`/tracking?number=${number}`);
    await expect(
      guest.getByRole('list', { name: 'Public shipment progress', exact: true }),
    ).toBeVisible();
    await expect(guest.getByText('Out for delivery', { exact: true }).first()).toBeVisible();
    await expect(guest.getByText('Out for delivery from the server database')).toBeVisible();
    await expect(guest.locator('body')).not.toContainText('member-server@example.test');

    await signin(guest);
    await expect(
      guest.getByRole('heading', { name: 'Shipments created for you', exact: true }),
    ).toBeVisible();
    await expect(guest.getByText(number, { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }

  await page.getByRole('button', { name: 'Sign out of workspace', exact: true }).click();
  await signin(page, true);
  await page.goto('/admin/settings?tab=shipments');
  const cleanupRow = page.locator('tr').filter({ hasText: number });
  await cleanupRow
    .getByRole('button', { name: `Remove shipment ${number}`, exact: true })
    .click();
  await page.getByRole('button', { name: 'Remove record', exact: true }).click();
  await expect(page.getByText('Public shipment removed.')).toBeVisible();
});

test('server administrator can create an official FedEx shipment without merging local records', async ({
  page,
}) => {
  let submitted: Record<string, unknown> | null = null;
  await page.route('**/api/carrier/status', (route) =>
    route.fulfill({
      json: {
        carrier: {
          provider: 'FedEx',
          configured: true,
          environment: 'sandbox',
          trackingEnabled: true,
          accountConfigured: true,
          shipmentCreationEnabled: true,
          missing: [],
        },
      },
    }),
  );
  await page.route('**/api/carrier/shipments', async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      json: {
        carrierShipment: {
          trackingNumber: '123456789012',
          serviceType: 'FEDEX_GROUND',
          jobId: '',
          label: { format: 'PDF', url: 'https://example.test/fedex-label.pdf', encodedLabel: '' },
        },
      },
    });
  });
  await signin(page, true);
  await expect(page.getByRole('heading', { name: 'Official FedEx API', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create official FedEx shipment', exact: true }).click();
  await page.getByLabel('FedEx service', { exact: true }).selectOption('FEDEX_GROUND');
  await page
    .getByLabel('Ship date', { exact: true })
    .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  await page.getByLabel('Package weight (lb)', { exact: true }).fill('2.5');
  for (const [label, value] of [
    ['Shipper name', 'Server Sender'],
    ['Shipper phone', '5555550100'],
    ['Shipper street address', '1 Example Street'],
    ['Shipper city', 'Memphis'],
    ['Shipper state', 'TN'],
    ['Shipper ZIP code', '38116'],
    ['Recipient name', 'Server Recipient'],
    ['Recipient phone', '5555550101'],
    ['Recipient street address', '2 Example Street'],
    ['Recipient city', 'New York'],
    ['Recipient state', 'NY'],
    ['Recipient ZIP code', '10001'],
  ] as const)
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.locator('#carrier-create-confirmation').check();
  await page.getByRole('button', { name: 'Submit shipment to FedEx', exact: true }).click();
  const result = page.locator('.workspace-carrier-result');
  await expect(result).toContainText('FedEx shipment created');
  await expect(result).toContainText('123456789012');
  await expect(result.getByRole('link', { name: 'Open FedEx label', exact: false })).toHaveAttribute(
    'href',
    'https://example.test/fedex-label.pdf',
  );
  await expect(result.getByRole('link', { name: 'Track both sources', exact: true })).toHaveAttribute(
    'href',
    '/tracking?number=123456789012',
  );
  expect(submitted).toMatchObject({
    serviceType: 'FEDEX_GROUND',
    recipient: { postalCode: '10001', countryCode: 'US' },
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

test('private attachments use administrator sessions, explicit member visibility, and confirmed deletion', async ({
  page,
  browser,
}) => {
  await signin(page, true);
  const number = `IMAGE-${test.info().project.name}-${Date.now()}`;
  const manage = `/admin/settings?tab=attachments&number=${number}&event=delivered`;
  await page.goto(manage);
  await expect(page.getByLabel('Attachment category', { exact: true })).toHaveValue('delivered');
  await expect(page.getByLabel('Server upload key', { exact: true })).toHaveCount(0);
  await page
    .getByLabel('Visible to account', { exact: true })
    .selectOption({ label: 'Server Member — member-server@example.test' });
  await page.locator('#admin-image-file').setInputFiles('public/images/fedex/office-packing.jpg');
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('/api/upload-tracking-image') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Upload through protected API', exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('private, no-store');
  expect((await response.request().allHeaders())['x-admin-secret']).toBeUndefined();
  await expect(
    page.getByRole('img', { name: 'Saved private application attachment', exact: true }),
  ).toBeVisible();
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5174',
  });
  const member = await context.newPage();
  try {
    await signin(member);
    await member.goto(`/tracking?number=${number}&event=delivered`);
    await member.getByRole('button', { name: 'Track', exact: true }).click();
    await expect(
      member.getByRole('img', { name: 'Application image attachment', exact: true }),
    ).toBeVisible();
    await expect(member.getByText('Tracking number not found', { exact: true })).toBeVisible();
    await expect(
      member.getByText('not carrier-provided delivery proof', { exact: false }),
    ).toBeVisible();
    await page.getByLabel('Visible to account', { exact: true }).selectOption('');
    await page.getByRole('button', { name: 'Update visibility', exact: true }).click();
    await expect(page.locator('.workspace-feedback[role="status"]')).toContainText(
      'visibility was updated',
    );
    await member.reload();
    await member.getByRole('button', { name: 'Track', exact: true }).click();
    await expect(member.getByRole('status')).toContainText('No accessible application image');
    await expect(
      member.getByRole('img', { name: 'Application image attachment', exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
  await page.getByRole('button', { name: 'Load saved attachment', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Saved private application attachment', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Remove saved attachment', exact: true }).click();
  await page.getByRole('button', { name: 'Remove record', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.workspace-feedback[role="status"]')).toContainText(
    'Application attachment removed',
  );
  await expect(
    page.getByRole('img', { name: 'Saved private application attachment', exact: true }),
  ).toHaveCount(0);
});

test('spoofed image bytes are refused and public tracking references never expose private files', async ({
  page,
  browser,
}) => {
  await signin(page, true);
  const number = `PRIVATE-${test.info().project.name}-${Date.now()}`;
  await page.goto(`/admin/settings?tab=attachments&number=${number}&event=other`);
  await page.locator('#admin-image-file').setInputFiles({
    name: 'spoofed.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('<svg><script>invalid</script></svg>'),
  });
  await page.getByRole('button', { name: 'Upload through protected API', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('content does not match');
  await expect(
    page.getByRole('img', { name: 'Saved private application attachment', exact: true }),
  ).toHaveCount(0);
  await page.locator('#admin-image-file').setInputFiles('public/images/fedex/office-packing.jpg');
  await page.getByRole('button', { name: 'Upload through protected API', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Saved private application attachment', exact: true }),
  ).toBeVisible();
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5174',
    viewport: { width: 320, height: 844 },
  });
  const anonymous = await context.newPage();
  try {
    await anonymous.goto(`/tracking?number=${number}&event=other`);
    await anonymous.getByRole('button', { name: 'Track', exact: true }).click();
    await expect(anonymous.getByRole('status')).toContainText('attachments are private');
    await expect(
      anonymous.getByRole('img', { name: 'Application image attachment', exact: true }),
    ).toHaveCount(0);
    expect(
      await anonymous.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
  } finally {
    await context.close();
  }
  await page.getByRole('button', { name: 'Remove saved attachment', exact: true }).click();
  await page.getByRole('button', { name: 'Remove record', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
