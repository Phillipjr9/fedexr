import { test, expect, type Page } from '@playwright/test';

test.skip(
  process.env.PLAYWRIGHT_SERVER_ACCOUNTS === '1',
  'Browser-local public-shipment flow; server authorization is covered separately.',
);

const trackingNumber = 'CUST-1001';

async function openPublicShipments(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'One-click admin login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await page.getByRole('link', { name: 'Public shipments', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Public shipments', exact: true })).toBeVisible();
}

async function createPublicShipment(
  page: Page,
  trackingNumber: string,
  status = 'label_created',
  location = 'NEW YORK, NY',
) {
  await page.getByRole('button', { name: 'Create shipment', exact: true }).first().click();
  await page.locator('#shipment-tracking').fill(trackingNumber);
  await page.locator('#shipment-recipient').fill('Operations Recipient');
  await page.locator('#shipment-origin-city').fill('New York');
  await page.locator('#shipment-origin-region').fill('NY');
  await page.locator('#shipment-origin-postal').fill('10001');
  await page.locator('#shipment-destination-city').fill('Boston');
  await page.locator('#shipment-destination-region').fill('MA');
  await page.locator('#shipment-destination-postal').fill('02101');
  await page.locator('#shipment-status').selectOption(status);
  await page.locator('#shipment-current-location').fill(location);
  await page.locator('#shipment-public-note').fill('Public operations note');
  await page.getByRole('button', { name: 'Create shipment', exact: true }).last().click();
  await expect(page.getByText(`${trackingNumber} is ready`, { exact: false })).toBeVisible();
}

test('administrator creates and updates a shipment that can be tracked after sign-out', async ({
  page,
}) => {
  await openPublicShipments(page);
  await page.getByRole('button', { name: 'Create shipment', exact: true }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Create shipment for tracking', exact: true }),
  ).toBeVisible();

  const customerSelect = page.locator('#shipment-user');
  const demoValue = await customerSelect
    .locator('option')
    .filter({ hasText: 'demo@workspace.local' })
    .getAttribute('value');
  expect(demoValue).toBeTruthy();
  await customerSelect.selectOption(demoValue!);
  await page.locator('#shipment-tracking').fill(trackingNumber);
  await page.locator('#shipment-recipient').fill('Demo User');
  await page.locator('#shipment-origin-city').fill('New York');
  await page.locator('#shipment-origin-region').fill('NY');
  await page.locator('#shipment-origin-postal').fill('10001');
  await page.locator('#shipment-destination-city').fill('Boston');
  await page.locator('#shipment-destination-region').fill('MA');
  await page.locator('#shipment-destination-postal').fill('02101');
  await page.locator('#shipment-estimated-delivery').fill('2026-10-20');
  await page.locator('#shipment-status').selectOption('in_transit');
  await page.locator('#shipment-current-location').fill('New York, NY');
  await page.locator('#shipment-public-note').fill('Your order is moving to Boston.');
  await page.getByRole('button', { name: 'Create shipment', exact: true }).last().click();

  await expect(page.getByText(`${trackingNumber} is ready`, { exact: false })).toBeVisible();
  const row = page.locator('tr').filter({ hasText: trackingNumber });
  await expect(row).toContainText('Demo User');
  await expect(row).toContainText('In transit');

  await row.getByRole('button', { name: 'Modify status', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Modify shipping status', exact: true })).toBeVisible();
  await page.locator('#shipment-update-status').selectOption('out_for_delivery');
  await page.locator('#shipment-update-location').fill('Boston, MA');
  await page.locator('#shipment-update-note').fill('On vehicle for delivery in Boston');
  await page.getByRole('button', { name: 'Save status update', exact: true }).click();
  await expect(page.getByText(`Status update published for ${trackingNumber}`)).toBeVisible();
  await expect(row).toContainText('Out for delivery');

  await page.getByRole('button', { name: 'Sign out of workspace', exact: true }).click();
  await expect(page).toHaveURL(/\/(?:admin\/login|login)(?:\?|$)/);
  await page.goto(`/tracking?number=${trackingNumber}`);
  await expect(page.getByRole('list', { name: 'Public shipment progress', exact: true })).toBeVisible();
  await expect(page.getByText('Out for delivery', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Boston, MA', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('On vehicle for delivery in Boston', { exact: true })).toBeVisible();
  await expect(page.getByText('New York, NY', { exact: false }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('demo@workspace.local');

  await page.getByRole('button', { name: 'See full details', exact: true }).click();
  await expect(page.getByText('Your order is moving to Boston.').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Shipment facts', exact: true }).click();
  await expect(page.getByText('Demo User', { exact: true })).toBeVisible();
  await expect(page.getByText('Out for delivery', { exact: true }).first()).toBeVisible();
});

test('automatic progression advances a generated route and pauses on manual takeover', async ({
  page,
}) => {
  await openPublicShipments(page);
  await page.getByRole('button', { name: 'Generate trackable route', exact: true }).click();
  const feedback = page.getByText('Trackable route created:', { exact: false });
  await expect(feedback).toBeVisible();
  const trackingNumber = /Trackable route created: (\S+)/.exec(
    (await feedback.textContent()) || '',
  )?.[1];
  expect(trackingNumber).toBeTruthy();
  const row = page.locator('tr').filter({ hasText: trackingNumber });
  await expect(row).toContainText('Auto progression on');

  // A manual status update takes over the route and pauses progression.
  await row.getByRole('button', { name: 'Modify status', exact: true }).click();
  await page.locator('#shipment-update-status').selectOption('out_for_delivery');
  await page.getByRole('button', { name: 'Save status update', exact: true }).click();
  await expect(page.getByText(`Status update published for ${trackingNumber}`)).toBeVisible();
  await expect(row.getByText('Auto progression on', { exact: true })).toHaveCount(0);

  // Re-enable progression from Shipment operations with a one-minute interval.
  await row
    .getByRole('button', { name: `Open shipment operations for ${trackingNumber}` })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Shipment operations', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Automatic update interval', { exact: true }).selectOption('1');
  await dialog
    .getByRole('button', { name: 'Enable automatic progression', exact: true })
    .click();
  await expect(
    dialog.getByText(`Automatic progression enabled for ${trackingNumber}`),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(row.getByText('Auto progression on', { exact: true })).toBeVisible();

  // Move the stored schedule into the past; reloading applies the due step.
  await page.evaluate((number) => {
    const key = 'fedexr:workspace:v1';
    const data = JSON.parse(localStorage.getItem(key)!) as {
      shipments: Array<Record<string, unknown>>;
    };
    const shipment = data.shipments.find((entry) => entry.trackingNumber === number)!;
    shipment.autoProgressNextAt = new Date(Date.now() - 11 * 60_000).toISOString();
    localStorage.setItem(key, JSON.stringify(data));
  }, trackingNumber);
  await page.reload();
  const updatedRow = page.locator('tr').filter({ hasText: trackingNumber });
  await expect(updatedRow).toContainText('Delivered');
  await expect(updatedRow.getByText('Auto progression on', { exact: true })).toHaveCount(0);

  await page.goto(`/tracking?number=${trackingNumber}`);
  await expect(
    page.getByRole('list', { name: 'Public shipment progress', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Delivered', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText('Automatic update generated by this application', { exact: false }).first(),
  ).toBeVisible();
});

test('administrator generates a trackable route from free sample addresses', async ({ page }) => {
  await openPublicShipments(page);
  await page.getByRole('button', { name: 'Generate trackable route', exact: true }).click();
  const feedback = page.getByText('Trackable route created:', { exact: false });
  await expect(feedback).toBeVisible();
  const message = (await feedback.textContent()) || '';
  const trackingNumber = /Trackable route created: (\S+)/.exec(message)?.[1];
  expect(trackingNumber).toMatch(/^\d{15}$/);
  const row = page.locator('tr').filter({ hasText: trackingNumber });
  await expect(row).toContainText('(sample route)');
  await expect(row).toContainText('In transit');

  await page.goto(`/tracking?number=${trackingNumber}`);
  await expect(
    page.getByRole('list', { name: 'Public shipment progress', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('In transit', { exact: true }).first()).toBeVisible();
});

test('administrator attaches a public photo to the on-route and delivery stages', async ({
  page,
}) => {
  await openPublicShipments(page);
  await createPublicShipment(page, 'PHOTO-1001');
  const row = page.locator('tr').filter({ hasText: 'PHOTO-1001' });

  // Attach an on-route photo while moving the shipment to In transit.
  await row.getByRole('button', { name: 'Modify status', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Modify shipping status', exact: true })).toBeVisible();
  const photoBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP4z8DA8B+MgBgAHfAD/dPQfSYAAAAASUVORK5CYII=',
    'base64',
  );
  await page.locator('#shipment-update-status').selectOption('in_transit');
  await page.locator('#shipment-update-note').fill('On route to Boston');
  await page.locator('#shipment-update-photo').setInputFiles({
    name: 'on-route.png',
    mimeType: 'image/png',
    buffer: photoBuffer,
  });
  await expect(page.getByAltText('Attached shipment stage photo')).toBeVisible();
  await page.getByRole('button', { name: 'Save status update', exact: true }).click();
  await expect(page.getByText('Status update published for PHOTO-1001')).toBeVisible();

  // Attach a delivery photo when marking the shipment Delivered.
  await row.getByRole('button', { name: 'Modify status', exact: true }).click();
  await page.locator('#shipment-update-status').selectOption('delivered');
  await page.locator('#shipment-update-location').fill('Boston, MA');
  await page.locator('#shipment-update-note').fill('Delivered at the front door');
  await page.locator('#shipment-update-photo').setInputFiles({
    name: 'delivery.png',
    mimeType: 'image/png',
    buffer: photoBuffer,
  });
  await expect(page.getByAltText('Attached shipment stage photo')).toBeVisible();
  await page.getByRole('button', { name: 'Save status update', exact: true }).click();
  await expect(page.getByText('Status update published for PHOTO-1001')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out of workspace', exact: true }).click();
  await page.goto('/tracking?number=PHOTO-1001');
  await expect(page.getByAltText('Public delivery photo for this shipment')).toBeVisible();
  await expect(
    page.getByText('Public delivery photo added by the shipment administrator', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('.fx-journey-photo')).toHaveCount(2);
  await page
    .getByRole('button', { name: 'Enlarge public delivery photo', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Public delivery photo', exact: true })).toBeVisible();
  await expect(page.getByAltText('Public delivery photo enlarged')).toBeVisible();
});

test('assigned customer sees the shipment in their workspace', async ({ page }) => {
  await openPublicShipments(page);
  await page.getByRole('button', { name: 'Create shipment', exact: true }).first().click();
  const customerSelect = page.locator('#shipment-user');
  const demoValue = await customerSelect
    .locator('option')
    .filter({ hasText: 'demo@workspace.local' })
    .getAttribute('value');
  await customerSelect.selectOption(demoValue!);
  await page.locator('#shipment-tracking').fill('CUST-2002');
  await page.locator('#shipment-origin-city').fill('Chicago');
  await page.locator('#shipment-origin-postal').fill('60601');
  await page.locator('#shipment-destination-city').fill('New York');
  await page.locator('#shipment-destination-postal').fill('10001');
  await page.locator('#shipment-current-location').fill('CHICAGO, IL');
  await page.getByRole('button', { name: 'Create shipment', exact: true }).last().click();
  await expect(page.getByText('CUST-2002 is ready', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out of workspace', exact: true }).click();
  await page.goto('/login');
  await page.getByRole('button', { name: 'One-click demo login', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('heading', { name: 'Shipments created for you', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('CUST-2002', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Track publicly', exact: true }).first().click();
  await expect(page).toHaveURL(/\/tracking\?number=CUST-2002$/);
  await expect(page.getByText('Label created', { exact: true }).first()).toBeVisible();
});

test('administrator can manually change a shipment status directly from the table', async ({
  page,
}) => {
  await openPublicShipments(page);
  const demoTracking = '748512903645';
  const statusSelect = page.getByLabel(`Manually change status for ${demoTracking}`, {
    exact: true,
  });
  await expect(statusSelect).toHaveValue('in_transit');
  await statusSelect.selectOption('delivered');
  await page.getByRole('button', { name: `Save status for ${demoTracking}`, exact: true }).click();
  await expect(
    page.getByText(`Status for ${demoTracking} manually updated to Delivered.`),
  ).toBeVisible();
  await expect(statusSelect).toHaveValue('delivered');

  await page.goto(`/tracking?number=${demoTracking}`);
  await expect(page.getByRole('list', { name: 'Public shipment progress', exact: true })).toBeVisible();
  await expect(page.getByText('Delivered', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText('Delivered');
});

test('public shipments table keeps readable columns and scrolls on narrow screens', async ({
  page,
}) => {
  await openPublicShipments(page);
  const wrap = page.locator('.public-shipments-table-wrap');
  const table = page.locator('.public-shipments-table');
  await expect(table).toBeVisible();
  await expect(table.locator('thead th')).toHaveText([
    'Tracking / recipient',
    'Customer',
    'Route',
    'Status',
    'Updated',
    'Actions',
  ]);

  for (const width of [1000, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const metrics = await wrap.evaluate((element) => {
      const tableElement = element.querySelector('table')!;
      const headers = [...element.querySelectorAll('thead th')].map((header) =>
        Math.round(header.getBoundingClientRect().width),
      );
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        tableWidth: Math.round(tableElement.getBoundingClientRect().width),
        headers,
        documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(metrics.documentOverflow, `document overflow at ${width}px`).toBeLessThanOrEqual(0);
    expect(metrics.tableWidth, `table width at ${width}px`).toBeGreaterThanOrEqual(1180);
    expect(metrics.scrollWidth, `scrollable table width at ${width}px`).toBeGreaterThan(
      metrics.clientWidth,
    );
    expect(metrics.headers[0], 'tracking column width').toBeGreaterThanOrEqual(200);
    expect(metrics.headers[1], 'customer column width').toBeGreaterThanOrEqual(130);
    expect(metrics.headers[2], 'route column width').toBeGreaterThanOrEqual(165);
    expect(metrics.headers[3], 'status column width').toBeGreaterThanOrEqual(300);
    expect(metrics.headers[4], 'updated column width').toBeGreaterThanOrEqual(120);
    expect(metrics.headers[5], 'actions column width').toBeGreaterThanOrEqual(190);

    await wrap.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const actionsBounds = await table.locator('thead th').last().evaluate((header) => {
      const wrapElement = header.closest('.public-shipments-table-wrap')!;
      const headerRect = header.getBoundingClientRect();
      const wrapRect = wrapElement.getBoundingClientRect();
      return { headerRight: headerRect.right, headerLeft: headerRect.left, wrapRight: wrapRect.right, wrapLeft: wrapRect.left };
    });
    expect(actionsBounds.headerRight).toBeLessThanOrEqual(actionsBounds.wrapRight + 1);
    expect(actionsBounds.headerLeft).toBeGreaterThanOrEqual(actionsBounds.wrapLeft - 1);
  }
});

test('the current in-transit journey marker stays still', async ({ page }) => {
  await openPublicShipments(page);
  await page.goto('/tracking?number=748512903645');
  const marker = page.locator('.fx-journey-list > li.is-current .fx-journey-node');
  await expect(marker).toBeVisible();
  await expect(page.locator('.fx-journey-list > li.is-current')).toContainText('In transit');
  await page.waitForTimeout(500);
  const sample = () =>
    marker.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: rect.x,
        y: rect.y,
        animationName: style.animationName,
        transitionProperty: style.transitionProperty,
      };
    });
  const first = await sample();
  await page.waitForTimeout(1200);
  const second = await sample();
  expect(first.animationName).toBe('none');
  expect(Math.abs(second.x - first.x)).toBeLessThan(0.5);
  expect(Math.abs(second.y - first.y)).toBeLessThan(0.5);
});

test('a shipment jumped from in transit to delivered shows the complete route', async ({
  page,
}) => {
  await openPublicShipments(page);
  const demoTracking = '748512903645';
  const statusSelect = page.getByLabel(`Manually change status for ${demoTracking}`, {
    exact: true,
  });
  await expect(statusSelect).toHaveValue('in_transit');
  await statusSelect.selectOption('delivered');
  await page
    .getByRole('button', { name: `Save status for ${demoTracking}`, exact: true })
    .click();
  await expect(
    page.getByText(`Status for ${demoTracking} manually updated to Delivered.`),
  ).toBeVisible();

  await page.goto(`/tracking?number=${demoTracking}`);
  const journey = page.getByRole('list', { name: 'Public shipment progress', exact: true });
  await expect(journey).toBeVisible();
  await expect(journey.getByText('Picked up', { exact: true })).toBeVisible();
  await expect(journey.getByText('In transit', { exact: true })).toBeVisible();
  await expect(journey.getByText('Out for delivery', { exact: true })).toBeVisible();
  await expect(journey.getByText('Delivered', { exact: true })).toBeVisible();
  await expect(
    journey.getByText('Route stage completed — no separate update recorded'),
  ).toHaveCount(2);
  await expect(page.locator('[aria-current="step"]')).toContainText('Delivered');

  await page.getByRole('button', { name: 'See full details', exact: true }).click();
  const history = page.getByRole('region', {
    name: 'Public shipment travel history',
    exact: true,
  });
  await expect(history.getByText('Picked up — route completed', { exact: true })).toBeVisible();
  await expect(
    history.getByText('Out for delivery — route completed', { exact: true }),
  ).toBeVisible();
  await expect(history.getByText('Delivered', { exact: true }).first()).toBeVisible();
});

test('administrator puts a shipment on hold and the public page shows the selected issue', async ({
  page,
}) => {
  await openPublicShipments(page);
  const demoTracking = '748512903645';
  const statusSelect = page.getByLabel(`Manually change status for ${demoTracking}`, {
    exact: true,
  });
  await statusSelect.selectOption('on_hold');
  const holdReason = page.getByLabel(`Hold reason for ${demoTracking}`, { exact: true });
  await expect(holdReason).toBeVisible();
  await expect(holdReason.locator('option')).toHaveCount(43);
  await page
    .getByRole('button', { name: `Save status for ${demoTracking}`, exact: true })
    .click();
  await expect(
    page.getByText(`Choose a hold reason for ${demoTracking} before saving On hold.`),
  ).toBeVisible();
  await holdReason.selectOption('customs_inspection');
  await page
    .getByRole('button', { name: `Save status for ${demoTracking}`, exact: true })
    .click();
  await expect(
    page.getByText(
      `Status for ${demoTracking} manually updated to On hold: Held for customs inspection.`,
    ),
  ).toBeVisible();
  const row = page.locator('tr').filter({ hasText: demoTracking });
  await expect(row).toContainText('Hold issue: Held for customs inspection');

  await page.goto(`/tracking?number=${demoTracking}`);
  const alert = page.locator('.fx-hold-alert');
  await expect(alert).toContainText('Shipment on hold');
  await expect(alert).toContainText('Held for customs inspection');
  await expect(alert).toContainText('Delivery is paused while this issue is resolved');
  await expect(page.getByText('On hold', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toContainText(
    'Hold issue: Held for customs inspection',
  );
  await page.getByRole('button', { name: 'See full details', exact: true }).click();
  await page.getByRole('tab', { name: 'Shipment facts', exact: true }).click();
  await expect(page.getByText('Current hold issue', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('tabpanel', { name: 'Shipment facts', exact: true })
      .getByText('Held for customs inspection', { exact: true }),
  ).toBeVisible();

  await page.goto('/admin/settings?tab=shipments');
  await page
    .getByLabel(`Manually change status for ${demoTracking}`, { exact: true })
    .selectOption('in_transit');
  await page
    .getByRole('button', { name: `Save status for ${demoTracking}`, exact: true })
    .click();
  await expect(
    page.getByText(`Status for ${demoTracking} manually updated to In transit.`),
  ).toBeVisible();
  await page.goto(`/tracking?number=${demoTracking}`);
  await expect(page.locator('.fx-hold-alert')).toHaveCount(0);
  await expect(page.getByText('In transit', { exact: true }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Current hold issue');
  await expect(page.locator('body')).toContainText(
    'Hold issue: Held for customs inspection',
  );
});

test('administrator manages internal notes, timeline corrections, and undo from shipment operations', async ({
  page,
}) => {
  await openPublicShipments(page);
  await createPublicShipment(page, 'CUST-OPS', 'in_transit', 'NEW YORK, NY');
  const row = page.locator('tr').filter({ hasText: 'CUST-OPS' });
  await row
    .getByRole('button', { name: 'Open shipment operations for CUST-OPS', exact: true })
    .click();
  const operations = page.locator('.workspace-dialog-wide');
  await expect(
    operations.getByRole('heading', { name: 'Shipment operations', exact: true }),
  ).toBeVisible();
  await operations
    .getByLabel('Internal note (administrators only)', { exact: true })
    .fill('Call before redelivery');
  await operations.getByRole('button', { name: 'Save internal note', exact: true }).click();
  await expect(operations.getByText('Internal note saved for CUST-OPS.')).toBeVisible();

  await operations.getByRole('button', { name: 'Modify status', exact: true }).click();
  await page.locator('#shipment-update-status').selectOption('out_for_delivery');
  await page.locator('#shipment-update-location').fill('BOSTON, MA');
  await page.locator('#shipment-update-note').fill('On vehicle for delivery');
  await page.getByRole('button', { name: 'Save status update', exact: true }).click();
  await expect(operations.getByText('Out for delivery', { exact: true }).first()).toBeVisible();
  await expect(operations.getByText('BOSTON, MA', { exact: false }).first()).toBeVisible();

  await operations
    .getByRole('button', {
      name: 'Edit tracking event Out for delivery for CUST-OPS',
      exact: true,
    })
    .click();
  await page.getByLabel('Event status', { exact: true }).selectOption('delivered');
  await page.getByLabel('Event date and time', { exact: true }).fill('2026-10-16T09:30');
  await page.getByLabel('Location *', { exact: true }).fill('CAMBRIDGE, MA');
  await page.getByLabel('Public event note', { exact: true }).fill('Corrected delivery event');
  await page.getByRole('button', { name: 'Save event correction', exact: true }).click();
  await expect(operations.getByText('Tracking event corrected for CUST-OPS.')).toBeVisible();
  await expect(operations.getByText('Delivered', { exact: true }).first()).toBeVisible();
  await expect(operations.getByText('CAMBRIDGE, MA', { exact: false }).first()).toBeVisible();

  await operations.getByRole('button', { name: 'Undo latest update', exact: true }).first().click();
  await page.getByRole('button', { name: 'Undo latest update', exact: true }).last().click();
  await expect(operations.getByText('Latest tracking update undone for CUST-OPS.')).toBeVisible();
  await expect(operations.getByText('In transit', { exact: true }).first()).toBeVisible();
  await expect(operations.getByText('NEW YORK, NY', { exact: false }).first()).toBeVisible();

  await page.goto('/tracking?number=CUST-OPS');
  await expect(page.getByText('In transit', { exact: true }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Call before redelivery');
});

test('administrator archives, restores, duplicates, and controls public visibility', async ({
  page,
}) => {
  await openPublicShipments(page);
  await createPublicShipment(page, 'CUST-SHARE');
  const row = page.locator('tr').filter({ hasText: 'CUST-SHARE' });
  const visibility = page.getByLabel('Public tracking for CUST-SHARE', { exact: true });
  await visibility.uncheck();
  await expect(page.getByText('Public tracking hidden for CUST-SHARE.')).toBeVisible();
  await page.goto('/tracking?number=CUST-SHARE');
  await expect(page.getByText('Tracking number not found', { exact: true })).toBeVisible();

  await page.goto('/admin/settings?tab=shipments');
  await page.getByLabel('Public tracking for CUST-SHARE', { exact: true }).check();
  await expect(page.getByText('Public tracking enabled for CUST-SHARE.')).toBeVisible();
  await row
    .getByRole('button', { name: 'Open shipment operations for CUST-SHARE', exact: true })
    .click();
  const operations = page.locator('.workspace-dialog-wide');
  await operations.getByRole('button', { name: 'Duplicate shipment', exact: true }).click();
  await expect(page.getByText(/Shipment duplicated as \d{15}\./)).toBeVisible();
  const duplicateNumber = await operations
    .locator('[data-slot="dialog-description"]')
    .textContent()
    .then((text) => text?.match(/\d{15}/)?.[0]);
  expect(duplicateNumber).toBeTruthy();
  await expect(operations.getByText('Label created', { exact: true }).first()).toBeVisible();
  await operations.getByRole('button', { name: 'Archive shipment', exact: true }).click();
  await expect(
    operations.getByText(new RegExp(`Shipment ${duplicateNumber} archived`)),
  ).toBeVisible();
  await operations.getByRole('button', { name: 'Close', exact: true }).click();

  await expect(page.locator('tr').filter({ hasText: duplicateNumber! })).toHaveCount(0);
  await page.getByLabel('Record state', { exact: true }).selectOption('archived');
  const archivedRow = page.locator('tr').filter({ hasText: duplicateNumber! });
  await expect(archivedRow).toContainText('Archived');
  await archivedRow
    .getByRole('button', {
      name: `Open shipment operations for ${duplicateNumber}`,
      exact: true,
    })
    .click();
  await operations.getByRole('button', { name: 'Restore shipment', exact: true }).click();
  await expect(
    operations.getByText(new RegExp(`Shipment ${duplicateNumber} restored`)),
  ).toBeVisible();
  await operations.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByLabel('Record state', { exact: true }).selectOption('active');
  await expect(page.locator('tr').filter({ hasText: duplicateNumber! })).toHaveCount(1);

  await page.goto(`/tracking?number=${duplicateNumber}`);
  await expect(page.getByText('Label created', { exact: true }).first()).toBeVisible();
});

test('generated tracking numbers use FedEx-style lengths for Ground and Express services', async ({
  page,
}) => {
  await openPublicShipments(page);
  await page.getByRole('button', { name: 'Create shipment', exact: true }).first().click();
  const trackingInput = page.locator('#shipment-tracking');
  await expect(trackingInput).toHaveValue('');

  await page.getByRole('button', { name: 'Generate tracking number', exact: true }).click();
  await expect(trackingInput).toHaveValue(/^\d{15}$/);
  await page.locator('#shipment-service').selectOption('2day');
  await page.getByRole('button', { name: 'Generate tracking number', exact: true }).click();
  await expect(trackingInput).toHaveValue(/^\d{12}$/);

  await page.locator('#shipment-service').selectOption('ground');
  await trackingInput.fill('');
  await page.locator('#shipment-recipient').fill('Generated Number Recipient');
  await page.locator('#shipment-origin-city').fill('Chicago');
  await page.locator('#shipment-origin-postal').fill('60601');
  await page.locator('#shipment-destination-city').fill('New York');
  await page.locator('#shipment-destination-postal').fill('10001');
  await page.locator('#shipment-current-location').fill('CHICAGO, IL');
  await page.getByRole('button', { name: 'Create shipment', exact: true }).last().click();

  const feedback = page.locator('.workspace-feedback').first();
  await expect(feedback).toContainText(/^\d{15} is ready/);
  const generated = (await feedback.textContent())?.match(/\d{15}/)?.[0];
  expect(generated).toBeTruthy();
  const row = page.locator('tr').filter({ hasText: generated! });
  await expect(row.locator('strong').first()).toHaveText(generated!);
  await page.goto(`/tracking?number=${generated}`);
  await expect(page.getByRole('list', { name: 'Public shipment progress', exact: true })).toBeVisible();
  await expect(page.locator('.fx-reference-number')).toHaveText(generated!);
});

test('unknown tracking numbers do not receive an invented shipment timeline', async ({ page }) => {
  await page.goto('/tracking?number=UNKNOWN-4040');
  await expect(page.getByText('Tracking number not found', { exact: true })).toBeVisible();
  await expect(page.getByText('No public shipment matches this number', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'See full details', exact: true })).toHaveCount(0);
  await expect(page.getByText('Delivered (sample)', { exact: true })).toHaveCount(0);
});
