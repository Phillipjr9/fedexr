import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const imagePath = 'public/images/fedex/office-packing.jpg';
const privateMissing = { access: 'private', found: false };
test.beforeEach(async ({ page }) => {
  await page.route('**/api/get-tracking-image?**', (route) =>
    route.fulfill({ status: 404, json: privateMissing }),
  );
});

test('tracking entry follows the reference form, uses genuine photos, and does not claim live services', async ({
  page,
}) => {
  await page.goto('/tracking');
  await expect(page.getByRole('heading', { level: 1, name: 'FedEx Tracking' })).toBeVisible();
  await expect(page.getByText('not live FedEx carrier scans', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: /Track by reference/ })).toHaveAttribute(
    'href',
    'https://www.fedex.com/en-us/tracking.html',
  );
  await expect(page.getByRole('link', { name: /Track by TCN/ })).toHaveAttribute(
    'href',
    'https://www.fedex.com/en-us/tracking.html',
  );
  for (const image of await page.locator('.fx-resource-card img').all()) {
    await expect(image).toHaveAttribute('src', /^\/images\/fedex\//);
    await expect
      .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  }
  await expect(page.getByText('Delivered (sample)', { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

test('tracking form validates, encodes the reference, and offers an explicit sample view', async ({
  page,
}) => {
  await page.goto('/tracking');
  await page.getByRole('button', { name: 'Track', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Please enter a tracking number.');
  await expect(page.getByLabel('Tracking number', { exact: true })).toBeFocused();
  await page.getByLabel('Tracking number', { exact: true }).fill('   ');
  await page.getByLabel('Tracking number', { exact: true }).press('Enter');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Tracking number', { exact: true }).fill('  REF & / ? 123  ');
  await page.getByRole('button', { name: 'Track', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('number')).toBe('REF & / ? 123');
  await expect(page.locator('.fx-reference-number')).toHaveText('REF & / ? 123');
  await page.getByRole('button', { name: 'Track another shipment', exact: true }).click();
  await expect(page).toHaveURL(/\/tracking$/);
  await expect(page.getByLabel('Tracking number', { exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'View a sample shipment', exact: true }).click();
  await expect(page.getByText('Delivered (sample)', { exact: true })).toBeVisible();
  await expect(page.locator('.fx-reference-number')).toHaveText('LOCAL-12345');
});

test('a tracking URL opens the three-column sample overview and green scan journey', async ({
  page,
}) => {
  await page.goto('/tracking?number=LOCAL-12345');
  await expect(page.getByText('Delivered (sample)', { exact: true })).toBeVisible();
  await expect(page.locator('.fx-delivery-day')).toHaveText('Thursday');
  await expect(page.locator('.fx-delivery-time')).toHaveText('4/2/2026 at 12:45 PM');
  const journey = page.getByRole('list', { name: 'Public shipment progress', exact: true });
  await expect(journey.locator('li')).toHaveCount(5);
  await expect(journey.locator('[aria-current="step"]')).toContainText('Delivered');
  await expect(page.getByRole('link', { name: /Obtain proof of delivery/ })).toHaveAttribute(
    'href',
    'https://www.fedex.com/fedextrack/?trknbr=LOCAL-12345',
  );
  await expect(page.getByRole('link', { name: /Get Status Updates/ })).toHaveAttribute(
    'href',
    'https://www.fedex.com/en-us/delivery-manager.html',
  );
  await expect(page.getByRole('button', { name: 'See full details', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(
    page.getByRole('img', { name: 'Application image attachment', exact: true }),
  ).toHaveCount(0);
});

test('official FedEx API results stay separate from application records', async ({ page }) => {
  await page.route('**/api/carrier/status', (route) =>
    route.fulfill({
      json: {
        carrier: {
          provider: 'FedEx',
          configured: true,
          environment: 'sandbox',
          trackingEnabled: true,
          accountConfigured: true,
          shipmentCreationEnabled: false,
          missing: [],
        },
      },
    }),
  );
  await page.route('**/api/carrier/track/**', (route) =>
    route.fulfill({
      json: {
        carrier: {
          found: true,
          trackingNumber: '123456789012',
          status: 'In transit',
          statusCode: 'IT',
          service: 'FedEx Ground',
          latestLocation: 'Memphis, TN, US',
          estimatedDelivery: '2026-10-20T20:00:00Z',
          actualDelivery: '',
          events: [
            {
              at: '2026-10-18T12:00:00Z',
              description: 'Arrived at FedEx location',
              detail: '',
              location: 'Memphis, TN',
            },
          ],
        },
      },
    }),
  );
  await page.goto('/tracking?number=123456789012');
  const panel = page.locator('.fx-carrier-panel');
  await expect(panel.getByRole('heading', { name: 'Application record and official FedEx' })).toBeVisible();
  await expect(panel.locator('.fx-carrier-card').first()).toContainText('No matching record');
  await expect(panel.locator('.fx-carrier-card').nth(1)).toContainText('FedEx status: In transit');
  await expect(panel.getByText('Memphis, TN, US', { exact: true })).toBeVisible();
  await expect(panel.getByText('sandbox test', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'See full details', exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

test('full details support keyboard tabs, meaningful time zones, and chronological sorting', async ({
  page,
}) => {
  await page.goto('/tracking?number=LOCAL-12345');
  await page.getByRole('button', { name: 'See full details', exact: true }).click();
  await expect(page.locator('#tracking-full-details')).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Travel history', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('.fx-history-table tbody time').first()).toHaveText('12:45 PM');
  await page.getByLabel('Time zone', { exact: true }).selectOption('America/New_York');
  await expect(page.locator('.fx-history-table tbody time').first()).toHaveText('8:45 AM');
  await page.getByRole('button', { name: 'Newest first', exact: true }).click();
  await expect(page.locator('.fx-history-table tbody time').first()).toHaveText('9:30 AM');
  await page.getByRole('tab', { name: 'Travel history', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Shipment facts', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText('4.2 lb', { exact: true })).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Shipment overview', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText('No carrier shipment was booked', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Hide full details', exact: true }).click();
  await expect(page.locator('#tracking-full-details')).toHaveCount(0);
});

test('copy, temporary nickname, visit marker, and print actions work without storing carrier changes', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/tracking?number=LOCAL-12345');
  await page.getByRole('button', { name: 'Copy tracking reference', exact: true }).click();
  await expect(page.locator('.fx-tracking-feedback')).toHaveText('Tracking reference copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('LOCAL-12345');
  await page.getByRole('button', { name: 'Add shipment nickname', exact: true }).click();
  await page.getByLabel('Shipment nickname', { exact: true }).fill('My sample parcel');
  await page.getByRole('button', { name: 'Save nickname', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.fx-shipment-nickname')).toHaveText('My sample parcel');
  await page.getByRole('button', { name: 'Mark reference for this visit', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Unmark reference for this visit', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(
    await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage)),
  ).not.toContain('My sample parcel');
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printInvoked = 'true';
    };
  });
  await page.getByRole('button', { name: 'Print sample tracking details', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-print-invoked', 'true');
  await page.reload();
  await expect(page.locator('.fx-shipment-nickname')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Mark reference for this visit', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
});

test('only confirmed private images render and an authorized image opens in an accessible viewer', async ({
  page,
}) => {
  const dataUrl = `data:image/jpeg;base64,${(await readFile(imagePath)).toString('base64')}`;
  await page.unroute('**/api/get-tracking-image?**');
  await page.route('**/api/get-tracking-image?**', (route) =>
    route.fulfill({ status: 200, json: { found: true, dataUrl } }),
  );
  await page.goto('/tracking?number=LOCAL-12345&event=delivered');
  await expect(page.getByRole('status')).toContainText('did not confirm safe private access');
  await expect(
    page.getByRole('img', { name: 'Application image attachment', exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/get-tracking-image?**');
  let category = '';
  await page.route('**/api/get-tracking-image?**', (route) => {
    category = new URL(route.request().url()).searchParams.get('event') || '';
    return route.fulfill({ status: 200, json: { access: 'private', found: true, dataUrl } });
  });
  await page.getByRole('button', { name: 'Track', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Application image attachment', exact: true }),
  ).toBeVisible();
  expect(category).toBe('delivered');
  await expect(
    page.getByText('not carrier-provided delivery proof', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Enlarge private application attachment', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Private attachment enlarged', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close image', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('changing references aborts old attachment requests and never displays a stale image', async ({
  page,
}) => {
  const firstImage = `data:image/jpeg;base64,${(await readFile(imagePath)).toString('base64')}`;
  const secondImage = `data:image/jpeg;base64,${(await readFile('public/images/fedex/delivery-professional.jpg')).toString('base64')}`;
  let release = () => {};
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.unroute('**/api/get-tracking-image?**');
  await page.route('**/api/get-tracking-image?**', async (route) => {
    const first = new URL(route.request().url()).searchParams.get('number') === 'FIRST-1001';
    if (first) await waiting;
    try {
      await route.fulfill({
        status: 200,
        json: { access: 'private', found: true, dataUrl: first ? firstImage : secondImage },
      });
    } catch {
      /* The old request is expected to abort. */
    }
  });
  await page.goto('/tracking?number=FIRST-1001');
  await page.getByLabel('Tracking number', { exact: true }).fill('SECOND-1002');
  await page.getByRole('button', { name: 'Track', exact: true }).click();
  const image = page.getByRole('img', { name: 'Application image attachment', exact: true });
  await expect(image).toHaveAttribute('src', secondImage);
  release();
  await expect(image).toHaveAttribute('src', secondImage);
  await expect(page.locator('.fx-reference-number')).toHaveText('SECOND-1002');
});

test('long unknown references stay inside the page and do not invent details', async ({
  page,
}) => {
  await page.goto(`/tracking?number=${'M'.repeat(80)}`);
  await expect(page.locator('.fx-reference-number')).toHaveText('M'.repeat(80));
  await expect(page.getByText('Tracking number not found', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'See full details', exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();

  await page.goto('/tracking?number=LOCAL-12345');
  await page.getByRole('button', { name: 'See full details', exact: true }).click();
  const table = page.getByRole('region', { name: 'Public shipment travel history', exact: true });
  await expect(table).toBeVisible();
  await page.getByRole('tab', { name: 'Shipment facts', exact: true }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

test('timeline rail, dots, delivered badge, and labels remain aligned across responsive breakpoints', async ({
  page,
}) => {
  await page.goto('/tracking?number=LOCAL-12345');
  const journey = page.getByRole('list', { name: 'Public shipment progress', exact: true });
  await expect(journey).toBeVisible();
  for (const width of [320, 390, 600, 768, 900, 901, 1050, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const geometry = await journey.evaluate((list) => {
      const bounds = list.getBoundingClientRect();
      const rail = getComputedStyle(list, '::before');
      const railCenter =
        bounds.left + Number.parseFloat(rail.left) + Number.parseFloat(rail.width) / 2;
      const current = list.querySelector<HTMLElement>('.is-current')!;
      const background = getComputedStyle(current, '::before');
      const header = list
        .closest('.fx-tracking-journey')!
        .querySelector('.fx-reference-heading')!
        .getBoundingClientRect();
      const markers = [...list.querySelectorAll<HTMLElement>('.fx-journey-node')].map((node) => {
        const marker = node.getBoundingClientRect();
        const title = node.nextElementSibling!.querySelector('h3')!.getBoundingClientRect();
        const label = node.nextElementSibling!.getBoundingClientRect();
        return {
          centerOffset: marker.left + marker.width / 2 - railCenter,
          headingOffset: marker.top + marker.height / 2 - (title.top + title.height / 2),
          labelLeft: label.left,
          layer: Number(getComputedStyle(node).zIndex),
        };
      });
      return {
        markers,
        headerOffset: bounds.left - header.left,
        railWidth: Number.parseFloat(rail.width),
        railLayer: Number(rail.zIndex),
        backgroundLayer: Number(background.zIndex),
        rowBackground: getComputedStyle(current).backgroundColor,
        cardRailOffset:
          current.getBoundingClientRect().left +
          Number.parseFloat(background.left) -
          (bounds.left + Number.parseFloat(rail.left)),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(geometry.overflow, `document overflow at ${width}px`).toBeLessThanOrEqual(0);
    expect(Math.abs(geometry.headerOffset), `header/list alignment at ${width}px`).toBeLessThan(
      0.5,
    );
    expect(geometry.railWidth).toBe(12);
    expect(geometry.rowBackground).toBe('rgba(0, 0, 0, 0)');
    expect(geometry.railLayer).toBeGreaterThan(geometry.backgroundLayer);
    expect(
      Math.abs(geometry.cardRailOffset),
      `delivered card/rail alignment at ${width}px`,
    ).toBeLessThan(0.5);
    for (const marker of geometry.markers) {
      expect(Math.abs(marker.centerOffset), `marker/rail center at ${width}px`).toBeLessThan(0.5);
      expect(Math.abs(marker.headingOffset), `marker/title alignment at ${width}px`).toBeLessThan(
        0.5,
      );
      expect(
        Math.abs(marker.labelLeft - geometry.markers[0].labelLeft),
        `label alignment at ${width}px`,
      ).toBeLessThan(0.5);
      expect(marker.layer).toBeGreaterThan(geometry.railLayer);
    }
  }
});
