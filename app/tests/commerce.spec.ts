import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const KEY = 'fedexr:supply-list:v1';
const photo = path.resolve('public/images/fedex/office-packing.jpg');
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(pageErrors.get(page), 'unexpected browser runtime errors').toEqual([]); });

async function openSupplyList(page: Page) {
  await page.getByRole('button', { name: /View supply list \(/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Supply planning list' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function startReturnDetails(page: Page) {
  await page.goto('/returns?number=EXAMPLE-12345');
  await page.getByRole('radio', { name: /I have a retailer QR code/ }).check();
  await page.getByRole('button', { name: 'Continue to details', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add details and local photos' })).toBeFocused();
}

async function completeReview(page: Page) {
  await page.getByRole('button', { name: 'Review local brief', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review your preparation brief' })).toBeFocused();
  await page.getByLabel('I understand this only prepares a local brief.', { exact: false }).check();
  await page.getByRole('button', { name: 'Prepare local brief', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your local brief is ready', exact: true })).toBeVisible();
}

test('supplies and returns use genuine local images, supported links, and responsive layouts', async ({ page, request }) => {
  const supported = new Set(['/', '/store', '/returns', '/support', '/tracking', '/locations']);
  for (const route of ['/store', '/returns']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    const images = page.locator('.service-page img');
    expect(await images.count()).toBeGreaterThanOrEqual(2);
    for (const image of await images.all()) {
      const src = await image.getAttribute('src');
      expect(src).toMatch(/^\/images\/fedex\//);
      expect(await image.getAttribute('alt')).toBeTruthy();
      expect(Number(await image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(await image.getAttribute('height'))).toBeGreaterThan(0);
      const response = await request.get(src!);
      expect(response.ok()).toBeTruthy();
      expect(response.headers()['content-type']).toMatch(/^image\//);
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    }
    for (const link of await page.locator('.service-page a').all()) {
      const href = await link.getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).not.toBe('#');
      if (href!.startsWith('https://')) {
        expect(await link.getAttribute('target')).toBe('_blank');
        expect(await link.getAttribute('rel')).toContain('noopener');
      } else expect(supported.has(new URL(href!, 'https://example.test').pathname)).toBeTruthy();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: test.info().outputPath(`${route.slice(1)}.png`), fullPage: true });
  }
});

test('supplies search and category filters use correct packaging photos rather than fake free-box SKUs', async ({ page }) => {
  await page.goto('/store');
  await expect(page.locator('.supply-product-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Boxes', exact: true }).click();
  await expect(page.locator('.supply-product-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Custom self-sealing boxes', exact: true })).toBeVisible();
  await expect(page.locator('.supply-product-card img')).toHaveAttribute('src', '/images/fedex/custom-self-sealing-box.jpg');
  await expect(page.locator('.supply-product-card')).toContainText('not complimentary FedEx Express boxes');
  await page.getByRole('searchbox', { name: 'Search packaging options' }).fill('no-such-package');
  await expect(page.getByRole('heading', { name: 'No packaging options match your filters' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear packaging filters' }).click();
  await page.getByRole('searchbox', { name: 'Search packaging options' }).fill('rigid');
  await expect(page.locator('.supply-product-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Custom rigid mailers' })).toBeVisible();
  await expect(page.getByText('FREE', { exact: true })).toHaveCount(0);
  await page.goto('/store?category=mailers&q=padded');
  await expect(page.locator('.supply-product-card')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Mailers & paks', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('planning cart supports quantities, persistence, downloads, removal, and keyboard focus without checkout', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') posts.push(request.url()); });
  await page.goto('/store');
  await page.getByRole('button', { name: 'Add Custom self-sealing boxes to supply list', exact: true }).click();
  await page.getByRole('button', { name: 'Add FedEx Reusable Padded Pak to supply list', exact: true }).click();
  let dialog = await openSupplyList(page);
  const boxQuantity = dialog.getByRole('spinbutton', { name: 'Desired quantity for Custom self-sealing boxes' });
  await dialog.getByRole('button', { name: 'Increase Custom self-sealing boxes quantity' }).click();
  await expect(boxQuantity).toHaveValue('2');
  await boxQuantity.fill('99');
  await boxQuantity.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Increase Custom self-sealing boxes quantity' })).toBeDisabled();
  await boxQuantity.fill('100');
  await expect(dialog.getByRole('alert')).toContainText('1 to 99');
  await expect(dialog.getByRole('button', { name: 'Download supply list' })).toBeDisabled();
  await boxQuantity.fill('3');
  await boxQuantity.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Download supply list' })).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download supply list' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('supply-planning-list.txt');
  const text = await readFile((await download.path())!, 'utf8');
  expect(text).toContain('Custom self-sealing boxes: 3 boxes');
  expect(text).toContain('FedEx Reusable Padded Pak: 1 paks');
  expect(text).toContain('NOT an order');
  expect(text).toContain('No payment or order has been processed');
  await expect(dialog.getByText('Your supply list was downloaded. No order was placed.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Checkout', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View supply list (2 selections)' })).toBeFocused();
  await page.reload();
  dialog = await openSupplyList(page);
  await expect(dialog.getByRole('spinbutton', { name: 'Desired quantity for Custom self-sealing boxes' })).toHaveValue('3');
  await dialog.getByRole('button', { name: 'Remove FedEx Reusable Padded Pak from supply list' }).click();
  await expect(dialog.locator('.supply-cart-item')).toHaveCount(1);
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBeTruthy();
  }
  await dialog.getByRole('button', { name: 'Clear supply list', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Your supply list is empty' })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull();
  await dialog.getByRole('button', { name: 'Browse supplies' }).click();
  await expect(dialog).toHaveCount(0);
  expect(posts).toEqual([]);
});

test('malformed saved carts are safely ignored and blocked storage falls back to the current session', async ({ page }) => {
  await page.goto('/store');
  await page.evaluate((key) => localStorage.setItem(key, '{broken-json'), KEY);
  await page.reload();
  await expect(page.getByRole('button', { name: 'View supply list (0 selections)' })).toBeVisible();
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ version: 1, items: [
    { id: 'unknown-product', quantity: 1 }, { id: 'padded-pak', quantity: -1 }, { id: 'rigid-mailers', quantity: 100 }, { id: 'self-sealing-boxes', quantity: 2 },
  ] })), KEY);
  await page.reload();
  let dialog = await openSupplyList(page);
  await expect(dialog.locator('.supply-cart-item')).toHaveCount(1);
  await expect(dialog.getByRole('spinbutton', { name: 'Desired quantity for Custom self-sealing boxes' })).toHaveValue('2');
  await dialog.getByRole('button', { name: 'Clear supply list', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => { Object.defineProperty(Storage.prototype, 'setItem', { configurable: true, value: () => { throw new DOMException('Storage blocked', 'QuotaExceededError'); } }); });
  await page.getByRole('button', { name: 'Add Custom rigid mailers to supply list', exact: true }).click();
  dialog = await openSupplyList(page);
  await expect(dialog.locator('.supply-cart-item')).toHaveCount(1);
  await expect(dialog.getByText('Browser storage is unavailable.', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Download supply list' })).toBeEnabled();
});

test('return planning validates choices, reviews QR instructions, edits, downloads, and resets without submitting', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') posts.push(request.url()); });
  await page.goto('/returns');
  await page.getByRole('button', { name: 'Continue to details', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Choose whether');
  await page.getByLabel('Tracking number or reference (optional)').fill('bad&reference');
  await page.getByRole('radio', { name: /I have a retailer QR code/ }).check();
  await page.getByRole('button', { name: 'Continue to details', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('4–40');
  await page.getByLabel('Tracking number or reference (optional)').fill('EXAMPLE-12345');
  await page.getByRole('button', { name: 'Continue to details', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add details and local photos' })).toBeFocused();
  await page.getByRole('button', { name: 'Review local brief', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Choose a reason');
  await page.getByLabel('Return reason', { exact: true }).selectOption('wrong');
  await page.getByLabel('Package condition').selectOption('opened');
  await page.getByLabel('Notes (optional)').fill('Sample retailer return. Wrong item in the box.');
  await page.getByRole('button', { name: 'Review local brief', exact: true }).click();
  await expect(page.locator('.return-next-steps')).toContainText('participating location listed in its instructions');
  await page.getByRole('button', { name: 'Prepare local brief', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('local brief only');
  await page.getByLabel('I understand this only prepares a local brief.', { exact: false }).check();
  await page.getByRole('button', { name: 'Prepare local brief', exact: true }).click();
  await expect(page.getByText('Your notes are ready—not submitted.', { exact: false })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download return brief', exact: true }).click();
  const download = await downloadPromise;
  const text = await readFile((await download.path())!, 'utf8');
  expect(download.suggestedFilename()).toBe('return-preparation-brief.txt');
  expect(text).toContain('NOTHING has been submitted');
  expect(text).toContain('EXAMPLE-12345');
  expect(text).toContain('I have a retailer QR code');
  expect(text).toContain('Wrong item received');
  expect(text).toContain('Sample retailer return. Wrong item in the box.');
  await expect(page.getByRole('link', { name: /Continue with official return guidance/ })).toHaveAttribute('href', 'https://www.fedex.com/en-us/shipping/returns.html');
  await page.getByRole('button', { name: 'Edit this plan', exact: true }).click();
  await expect(page.getByLabel('Notes (optional)')).toHaveValue('Sample retailer return. Wrong item in the box.');
  await page.getByLabel('Notes (optional)').fill('Updated sample notes.');
  await completeReview(page);
  await page.getByRole('button', { name: 'Start a new plan', exact: true }).click();
  await expect(page.getByLabel('Tracking number or reference (optional)')).toHaveValue('');
  await expect(page.getByRole('radio', { name: /I have a retailer QR code/ })).not.toBeChecked();
  expect(posts).toEqual([]);
});

test('claim preparation is distinct from a retailer return and hands off to the real claim center', async ({ page }) => {
  await page.goto('/returns?mode=claim&number=EXAMPLE-CLAIM-1');
  await expect(page.getByRole('radio', { name: /Shipping claim notes/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /I have a return label/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue to details', exact: true }).click();
  await page.getByLabel('Claim preparation reason').selectOption('lost');
  await page.getByLabel('Package condition').selectOption('unavailable');
  await completeReview(page);
  await expect(page.getByRole('link', { name: /Open official claim center/ })).toHaveAttribute('href', 'https://www.fedex.com/eclaims/#/claimcenter?locale=en_US');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download claim brief', exact: true }).click();
  const download = await downloadPromise;
  const text = await readFile((await download.path())!, 'utf8');
  expect(text).toContain('CLAIM PREPARATION BRIEF');
  expect(text).toContain('Lost shipment');
  expect(text).toContain('Package unavailable');
  expect(text).toContain('No shipment lookup');
  await expect(page.getByText('Return Request Submitted!', { exact: true })).toHaveCount(0);
  await expect(page.getByText('5-7 business days', { exact: false })).toHaveCount(0);
});

test('local reference photos preview, validate type/size/count, revoke URLs, and never upload or persist', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') posts.push(request.url()); });
  await page.addInitScript(() => {
    const state = { created: [] as string[], revoked: [] as string[] };
    Object.defineProperty(window, '__photoUrlAudit', { value: state });
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (object) => { const url = create(object); state.created.push(url); return url; };
    URL.revokeObjectURL = (url) => { state.revoked.push(url); revoke(url); };
  });
  await startReturnDetails(page);
  await page.locator('#return-photos').setInputFiles(photo);
  await expect(page.locator('.return-photo-card')).toHaveCount(1);
  const preview = page.getByRole('img', { name: 'Local preview of office-packing.jpg', exact: true });
  await expect.poll(() => preview.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  const blob = await preview.getAttribute('src');
  expect(blob).toMatch(/^blob:/);
  for (const fixture of [
    { name: 'unsafe.txt', mimeType: 'text/plain', buffer: Buffer.from('sample') },
    { name: 'empty.png', mimeType: 'image/png', buffer: Buffer.alloc(0) },
    { name: 'large.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) },
  ]) {
    await page.locator('#return-photos').setInputFiles(fixture);
    await expect(page.getByRole('alert')).toContainText('JPG or PNG');
    await expect(page.locator('.return-photo-card')).toHaveCount(1);
  }
  const bytes = await readFile(photo);
  await page.locator('#return-photos').setInputFiles([1, 2, 3].map((index) => ({ name: `extra-${index}.jpg`, mimeType: 'image/jpeg', buffer: bytes })));
  await expect(page.getByRole('alert')).toContainText('at most 3');
  await expect(page.locator('.return-photo-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Remove local photo office-packing.jpg', exact: true }).click();
  await expect(page.locator('.return-photo-card')).toHaveCount(0);
  expect(await page.evaluate((url) => (window as unknown as { __photoUrlAudit: { revoked: string[] } }).__photoUrlAudit.revoked.includes(url!), blob)).toBeTruthy();
  await page.locator('#return-photos').setInputFiles(photo);
  await page.getByLabel('Return reason', { exact: true }).selectOption('damaged');
  await page.getByLabel('Package condition').selectOption('damaged');
  await completeReview(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download return brief', exact: true }).click();
  const download = await downloadPromise;
  const text = await readFile((await download.path())!, 'utf8');
  expect(text).toContain('office-packing.jpg');
  expect(text).toContain('file contents are NOT included or uploaded');
  expect(posts).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /return|photo/i.test(key)))).toEqual([]);
  await page.reload();
  await page.getByRole('radio', { name: /I have a return label/ }).check();
  await page.getByRole('button', { name: 'Continue to details', exact: true }).click();
  await expect(page.locator('.return-photo-card')).toHaveCount(0);
});

test('claim planning is discoverable and storage/privacy information accurately describes the new tools', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search this site' }).click();
  const search = page.getByRole('searchbox', { name: 'Search this site' });
  await search.fill('claims');
  await search.press('Enter');
  await expect(page).toHaveURL(/\/returns$/);
  await page.getByRole('button', { name: 'Prepare a claim brief', exact: true }).click();
  await expect(page.getByRole('radio', { name: /Shipping claim notes/ })).toBeChecked();
  await page.getByRole('button', { name: 'Cookie preferences' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cookie preferences' });
  await expect(dialog).toContainText('product identifiers and desired quantities only');
  await expect(dialog).toContainText('Return-plan notes and photos');
  await expect(dialog).toContainText('not uploaded or saved in browser storage');
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toHaveCount(0);
});
