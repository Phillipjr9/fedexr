import { expect, test, type Page } from '@playwright/test';

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page), 'unexpected browser runtime errors').toEqual([]);
});

test('homepage uses locally hosted genuine images and has no horizontal overflow', async ({ page, request }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Keep your automotive supply chain moving');
  await page.evaluate(() => document.fonts.ready);

  const images = page.locator('.site-header img, .home-page img');
  expect(await images.count()).toBeGreaterThanOrEqual(10);
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
    await expect(image).toHaveJSProperty('complete', true);
    expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: test.info().outputPath('homepage.png'), fullPage: true });
});

test('tracking validates empty input and preserves the encoded tracking number', async ({ page }) => {
  const input = page.getByLabel('Tracking number', { exact: true });
  await page.getByRole('button', { name: 'Track', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Please enter a tracking number.');
  await expect(input).toBeFocused();

  await input.fill('   ');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toBeVisible();
  await input.fill('  1234 & 5678  ');
  await page.getByRole('button', { name: 'Track', exact: true }).click();
  await expect(page).toHaveURL(/\/tracking\?number=1234\+%26\+5678$/);
  await expect(page.getByPlaceholder('Enter tracking number')).toHaveValue('1234 & 5678');
});

test('featured services can be changed without an automatic timer', async ({ page }) => {
  await page.getByRole('button', { name: 'Next featured service' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ship, manage, track, deliver');
  await page.getByRole('button', { name: 'Previous featured service' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Keep your automotive supply chain moving');
});

test('search filters actual pages, handles no results, and navigates on Enter', async ({ page }) => {
  await page.getByRole('button', { name: 'Search this site' }).click();
  const input = page.getByRole('searchbox', { name: 'Search this site' });
  await expect(input).toBeFocused();
  await input.fill('xyz-no-such-page');
  await expect(page.getByText('No matching pages.', { exact: false })).toBeVisible();
  await input.fill('quote');
  await expect(page.getByRole('link', { name: /Get a shipping quote/ })).toBeVisible();
  await input.press('Enter');
  await expect(page).toHaveURL(/\/rate-calculator$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('desktop dropdowns and the mobile drawer keep existing routes accessible', async ({ page }) => {
  const shippingButton = page.getByRole('button', { name: 'Shipping', exact: true });
  if (await shippingButton.isVisible()) {
    await shippingButton.focus();
    await shippingButton.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(shippingButton).toBeFocused();
    await shippingButton.click();
    await page.getByRole('menuitem', { name: 'Create a shipment', exact: true }).click();
    await expect(page).toHaveURL(/\/shipping\/create$/);
  } else {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Main menu' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Shipping', exact: true }).click();
    await expect(page).toHaveURL(/\/shipping$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('homepage links target supported routes or explicit external sites', async ({ page }) => {
  const supported = new Set(['/', '/shipping', '/shipping/create', '/tracking', '/design-print', '/locations', '/support', '/login', '/rate-calculator', '/dashboard', '/store', '/returns']);
  const links = await page.locator('.home-page a').evaluateAll((elements) => elements.map((element) => ({
    href: element.getAttribute('href'), target: element.getAttribute('target'), rel: element.getAttribute('rel'),
  })));
  for (const link of links) {
    if (link.href?.startsWith('https://')) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
    } else {
      expect(supported.has(link.href || '')).toBeTruthy();
    }
  }
});

test('cookie information is dismissible and the independent sample is disclosed', async ({ page }) => {
  await page.getByRole('button', { name: 'Cookie preferences' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Independent project, not affiliated with FedEx.', { exact: false })).toBeVisible();
});

test('reference-style homepage URL works on direct navigation', async ({ page }) => {
  await page.goto('/en-us/home.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Keep your automotive supply chain moving');
});
