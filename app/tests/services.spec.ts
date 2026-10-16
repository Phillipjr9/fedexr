import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const pageErrors = new WeakMap<Page, string[]>();
const refreshedPages = ['/shipping', '/design-print', '/locations', '/support', '/rate-calculator', '/shipping/pickup'];

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page), 'unexpected browser runtime errors').toEqual([]);
});

test('refreshed pages load genuine local photography without overflow or placeholder links', async ({ page, request }) => {
  const supported = new Set(['/', '/shipping', '/shipping/create', '/shipping/pickup', '/tracking', '/design-print', '/locations', '/support', '/login', '/rate-calculator', '/dashboard', '/store', '/returns']);
  for (const path of refreshedPages) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    const images = page.locator('.service-page img');
    expect(await images.count()).toBeGreaterThan(0);
    for (const image of await images.all()) {
      const src = await image.getAttribute('src');
      expect(src).toMatch(/^\/images\/fedex\//);
      expect(await image.getAttribute('alt')).toBeTruthy();
      expect(Number(await image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(await image.getAttribute('height'))).toBeGreaterThan(0);
      expect((await request.get(src!)).ok()).toBeTruthy();
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveJSProperty('complete', true);
      expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
    }
    for (const link of await page.locator('.service-page a').all()) {
      const href = await link.getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).not.toBe('#');
      if (href!.startsWith('https://')) {
        expect(await link.getAttribute('target')).toBe('_blank');
        expect(await link.getAttribute('rel')).toContain('noopener');
      } else if (href!.startsWith('tel:')) {
        expect(href).toMatch(/^tel:\+\d{11}$/);
      } else {
        expect(supported.has(new URL(href!, 'http://example.test').pathname)).toBeTruthy();
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBeTruthy();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: test.info().outputPath(`${path.replace(/\//g, '-')}.png`), fullPage: true });
  }
});

test('shipping validates inputs and preserves ZIP codes, weight, date, and selected service through the wizard', async ({ page }) => {
  await page.goto('/shipping');
  await page.getByRole('button', { name: 'Get rates', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('From ZIP');
  await expect(page.getByLabel('From ZIP code')).toBeFocused();
  await page.getByLabel('From ZIP code').fill('10003');
  await page.getByLabel('To ZIP code').fill('invalid');
  await page.getByRole('button', { name: 'Get rates', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('To ZIP');
  await page.getByLabel('To ZIP code').fill('90001');
  await page.getByLabel('Package weight (lb)').fill('0');
  await page.getByRole('button', { name: 'Get rates', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('0.1 to 150');
  await page.getByLabel('Package weight (lb)').fill('5.4');
  await page.getByRole('button', { name: 'Get rates', exact: true }).click();
  await expect(page).toHaveURL(/\/rate-calculator\?from=10003&to=90001&weight=5\.4&date=/);
  await expect(page.getByLabel('From ZIP code')).toHaveValue('10003');
  await expect(page.getByLabel('To ZIP code')).toHaveValue('90001');
  await expect(page.getByLabel('Package weight (lb)')).toHaveValue('5.4');
  const date = await page.getByLabel('Planned ship date').inputValue();
  await expect(page.locator('.service-rate-row')).toHaveCount(6);
  const priority = page.locator('.service-rate-row').filter({ has: page.getByRole('heading', { name: 'FedEx Priority Overnight', exact: true }) });
  const price = (await priority.locator('.service-rate-price').innerText()).match(/\$\d+\.\d{2}/)![0];
  await priority.getByRole('link', { name: 'Select FedEx Priority Overnight for shipment plan' }).click();
  await expect(page).toHaveURL(/\/shipping\/create\?.*service=priority/);
  await expect(page.getByLabel('ZIP *', { exact: true })).toHaveValue('10003');
  await expect(page.getByLabel('Country')).toHaveValue('US');
  await expect(page.getByText(`Planned ship date: ${date}. All prices below are illustrative sample estimates.`)).toBeVisible();
  await page.getByLabel('Full Name *', { exact: true }).fill('Sample Sender');
  await page.getByLabel('Street Address *', { exact: true }).fill('1 Example Street');
  await page.getByLabel('City *', { exact: true }).fill('New York');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ship To', exact: true })).toBeVisible();
  await expect(page.getByLabel('ZIP *', { exact: true })).toHaveValue('90001');
  await page.getByLabel('Full Name *', { exact: true }).fill('Sample Recipient');
  await page.getByLabel('Street Address *', { exact: true }).fill('2 Example Street');
  await page.getByLabel('City *', { exact: true }).fill('Los Angeles');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Package Details', exact: true })).toBeVisible();
  await expect(page.locator('#plan-packageDetails-weight')).toHaveValue('5.4');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const chosen = page.getByRole('button', { name: /FedEx Priority Overnight/ });
  await expect(chosen).toHaveAttribute('aria-pressed', 'true');
  await expect(chosen).toContainText(price);
});

test('calculator rejects malformed and nonpositive inputs, and dimensions change sample estimates', async ({ page }) => {
  await page.goto('/rate-calculator?from=ABCDE&to=90001&weight=-1');
  await expect(page.locator('.service-rate-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Calculate sample rates' }).click();
  await expect(page.getByRole('alert')).toContainText('correct');
  await expect(page.getByLabel('From ZIP code')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Package weight (lb)')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('From ZIP code').fill('10003-1234');
  await page.getByLabel('Package weight (lb)').fill('10');
  await page.getByRole('button', { name: 'Calculate sample rates' }).click();
  const ground = page.locator('.service-rate-row').filter({ has: page.getByRole('heading', { name: 'FedEx Ground', exact: true }) });
  const basePrice = Number((await ground.locator('.service-rate-price').innerText()).match(/\$(\d+\.\d{2})/)![1]);
  await page.getByLabel('Length (in)').fill('20');
  await page.getByRole('button', { name: 'Calculate sample rates' }).click();
  await expect(page.locator('.service-rate-row')).toHaveCount(0);
  await expect(page.getByLabel('Width (in)')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Width (in)').fill('20');
  await page.getByLabel('Height (in)').fill('20');
  await page.getByRole('button', { name: 'Calculate sample rates' }).click();
  const dimensionalPrice = Number((await ground.locator('.service-rate-price').innerText()).match(/\$(\d+\.\d{2})/)![1]);
  expect(dimensionalPrice).toBeGreaterThan(basePrice);
  await page.getByLabel('Planned ship date').fill('2000-01-01');
  await page.getByRole('button', { name: 'Calculate sample rates' }).click();
  await expect(page.getByLabel('Planned ship date')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.service-rate-row')).toHaveCount(0);
});

test('pickup planning validates ZIP, package count, date, and time without pretending to book', async ({ page }) => {
  await page.goto('/shipping/pickup');
  await page.getByRole('button', { name: 'Review pickup plan' }).click();
  await expect(page.getByRole('alert')).toContainText('ZIP');
  await page.getByLabel('Pickup ZIP code').fill('10003');
  await page.getByLabel('Number of packages').fill('0');
  await page.getByRole('button', { name: 'Review pickup plan' }).click();
  await expect(page.getByRole('alert')).toContainText('1 to 99');
  await page.getByLabel('Number of packages').fill('3');
  const date = await page.getByLabel('Pickup date').inputValue();
  await page.getByLabel('Pickup date').fill('2000-01-01');
  await page.getByRole('button', { name: 'Review pickup plan' }).click();
  await expect(page.getByRole('alert')).toContainText('future');
  await page.getByLabel('Pickup date').fill(date);
  await page.getByLabel('Pickup location closes at').fill('09:00');
  await page.getByRole('button', { name: 'Review pickup plan' }).click();
  await expect(page.getByRole('alert')).toContainText('later');
  await page.getByLabel('Pickup location closes at').fill('17:00');
  await page.getByLabel('Package service', { exact: true }).selectOption('FedEx Express');
  await page.getByRole('button', { name: 'Review pickup plan' }).click();
  await expect(page.getByRole('heading', { name: 'Your plan is ready—not booked' })).toBeVisible();
  await expect(page.locator('.pickup-review')).toContainText('10003');
  await expect(page.locator('.pickup-review')).toContainText('FedEx Express');
  await expect(page.getByRole('link', { name: /Continue to FedEx booking/ })).toHaveAttribute('href', 'https://www.fedex.com/en-us/shipping/schedule-manage-pickups/login.html');
  await page.getByLabel('Number of packages').fill('4');
  await expect(page.locator('.pickup-review')).toHaveCount(0);
});

test('print planner selects a real product, keeps files local, and downloads a truthful brief', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') posts.push(request.url()); });
  await page.goto('/design-print');
  await page.getByRole('button', { name: 'Plan posters', exact: true }).click();
  await expect(page.getByLabel('Print product', { exact: true })).toHaveValue('posters');
  await page.getByLabel('Desired quantity').fill('25');
  await page.getByLabel('Project notes (optional)').fill('Sample project: discuss paper and size.');
  await page.locator('#print-file').setInputFiles({ name: 'example-artwork.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nSample reference file\n%%EOF') });
  await expect(page.getByText('Selected locally. Not uploaded.')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download project brief' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('print-posters-brief.txt');
  const brief = await readFile((await download.path())!, 'utf8');
  expect(brief).toContain('Product: Posters');
  expect(brief).toContain('Desired quantity: 25');
  expect(brief).toContain('example-artwork.pdf');
  expect(brief).toContain('Sample project: discuss paper and size.');
  expect(brief).toContain('NOT a print order');
  expect(brief).toContain('No file contents have been uploaded');
  expect(posts).toEqual([]);
  await expect(page.getByRole('link', { name: /Continue at FedEx Office/ })).toHaveAttribute('href', 'https://www.office.fedex.com/default/posters');
  await expect(page.getByText('Your project brief was downloaded. No order was placed and no file was uploaded.')).toBeVisible();
  await page.getByLabel('Desired quantity').fill('30');
  await expect(page.getByText('Your project brief was downloaded. No order was placed and no file was uploaded.')).toHaveCount(0);
});

test('print planner rejects unsupported, empty, or oversized files and invalid quantities', async ({ page }) => {
  await page.goto('/design-print?product=invitations');
  await expect(page.getByLabel('Print product', { exact: true })).toHaveValue('invitations');
  for (const fixture of [
    { name: 'unsafe.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('sample') },
    { name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) },
    { name: 'large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(20 * 1024 * 1024 + 1) },
  ]) {
    await page.locator('#print-file').setInputFiles(fixture);
    await expect(page.getByRole('alert')).toHaveText('Choose a non-empty PDF, JPG, or PNG file up to 20 MB.');
    await expect(page.locator('#print-file')).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('button', { name: 'Clear selected file' }).click();
  }
  await page.getByLabel('Desired quantity').fill('0');
  await page.getByRole('button', { name: 'Download project brief' }).click();
  await expect(page.getByRole('alert')).toContainText('whole-number');
  await expect(page.getByLabel('Desired quantity')).toBeFocused();
});

test('locations use verified addresses and filter the curated list rather than returning fake nearby results', async ({ page }) => {
  await page.goto('/locations');
  await expect(page.locator('.location-card')).toHaveCount(5);
  await expect(page.locator('.location-card address').filter({ hasText: '10 Union Sq E, Suite 108' })).toBeVisible();
  const input = page.getByRole('searchbox', { name: 'City, street, or ZIP code' });
  await input.fill('10003');
  await input.press('Enter');
  await expect(page.locator('.location-card')).toHaveCount(1);
  await expect(page.getByRole('link', { name: /Hours & details/ })).toHaveAttribute('href', 'https://local.fedex.com/en-us/ny/new-york/office-4483');
  await expect(page.getByRole('link', { name: /View on map/ })).toHaveAttribute('href', 'https://maps.google.com/maps?cid=9306430979333423787');
  await input.fill('Boston');
  await page.getByRole('button', { name: 'Search locations' }).click();
  await expect(page.locator('.location-card')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No saved locations match this search' })).toBeVisible();
  await expect(page.getByText('It does not mean there are no FedEx locations in your area.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Retail partners', exact: true }).click();
  await expect(page.locator('.location-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'FedEx at Walgreens' })).toBeVisible();
  await page.goto('/locations?type=office&q=Union+Square');
  await expect(page.getByRole('button', { name: 'FedEx Office', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.location-card')).toHaveCount(1);
});

test('support search, topic filters, and keyboard FAQ expansion return meaningful answers', async ({ page }) => {
  await page.goto('/support');
  const input = page.getByRole('searchbox', { name: 'Search help topics' });
  await input.fill('xyz-no-article');
  await input.press('Enter');
  await expect(page.getByRole('heading', { name: 'No answers match this search' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all answers' }).click();
  await input.fill('pickup');
  await page.getByRole('button', { name: 'Search answers' }).click();
  await expect(page.locator('.service-faq-list details')).toHaveCount(1);
  const question = page.locator('summary').filter({ hasText: 'How do I schedule a pickup?' });
  await question.focus();
  await question.press('Enter');
  await expect(page.getByRole('link', { name: 'Prepare a pickup plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Design & printing', exact: true }).click();
  await expect(page.locator('.service-faq-list details')).toHaveCount(2);
  await page.locator('summary').filter({ hasText: 'What files can I use for a print project?' }).click();
  await expect(page.getByRole('link', { name: 'Prepare a print project' })).toHaveAttribute('href', '/design-print');
});

test('support opens the sample assistant and never promises a live agent connection', async ({ page }) => {
  await page.goto('/support');
  await page.getByRole('button', { name: 'Open assistant', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Shipping Assistant' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Chat message', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: 'Talk to an agent', exact: true }).click();
  await expect(dialog.getByText('No live agents are connected to this assistant.', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /Contact real FedEx support/ })).toHaveAttribute('href', 'https://www.fedex.com/en-us/customer-support.html');
  await expect(dialog.getByText(/connecting you|estimated wait/i)).toHaveCount(0);
  await dialog.getByRole('textbox', { name: 'Chat message', exact: true }).fill('Schedule a pickup');
  await dialog.getByRole('textbox', { name: 'Chat message', exact: true }).press('Enter');
  await dialog.getByRole('link', { name: 'Prepare a pickup plan', exact: true }).click();
  await expect(page).toHaveURL(/\/shipping\/pickup$/);
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Open chat', exact: true }).click();
  await page.getByRole('textbox', { name: 'Chat message', exact: true }).press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('reduced motion opens a fully opaque assistant without a fade-in', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/support');
  await page.getByRole('button', { name: 'Open assistant', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Shipping Assistant' });
  expect(await dialog.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await dialog.getByRole('button', { name: 'Talk to an agent', exact: true }).click();
  expect(await dialog.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await expect(dialog.getByRole('link', { name: /Contact real FedEx support/ })).toHaveCSS('color', 'rgb(0, 115, 173)');
});

test('new pickup page is discoverable through site search and tracking app buttons have genuine destinations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search this site' }).click();
  const search = page.getByRole('searchbox', { name: 'Search this site' });
  await search.fill('pickup');
  await search.press('Enter');
  await expect(page).toHaveURL(/\/shipping\/pickup$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Schedule a pickup');
  await page.goto('/tracking');
  await expect(page.getByRole('link', { name: /Download for iOS/ })).toHaveAttribute('href', 'https://apps.apple.com/app/fedex/id1010729050');
  await expect(page.getByRole('link', { name: /Download for Android/ })).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=com.fedex.ida.android');
  await expect(page.getByRole('link', { name: /Explore Delivery Manager/ })).toHaveAttribute('href', 'https://www.fedex.com/en-us/delivery-manager.html');
});
