import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  admin,
  createAccount,
  createTrip,
  deleteAccount,
  goToDay,
  signIn,
  type Account,
} from './helpers';

let account: Account;

test.beforeAll(async () => {
  account = await createAccount();
});
test.afterAll(async () => {
  await deleteAccount(account);
});

const cellOf = (page: Page, date: string, block: string) =>
  page.getByTestId(`cell:${date}:${block}`);

async function addEvent(page: Page, date: string, block: string, name: string) {
  await page.getByRole('button', { name: `Add event to ${block} on ${date}` }).click();
  await page.getByRole('combobox', { name: new RegExp(`Add event to ${block}`) }).fill(name);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(cellOf(page, date, block).getByText(name, { exact: true })).toBeVisible();
}

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const STEPS = 12;

/** Presses on `from`, moves toward `to` in STEPS steps and returns the points visited. */
async function dragTo(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  during?: (step: number, point: { x: number; y: number }) => Promise<void>,
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= STEPS; i++) {
    const point = {
      x: from.x + ((to.x - from.x) * i) / STEPS,
      y: from.y + ((to.y - from.y) * i) / STEPS,
    };
    await page.mouse.move(point.x, point.y);
    await during?.(i, point);
  }
}

test.describe('drag (desktop)', () => {
  test.skip(({ hasTouch }) => hasTouch, 'mouse drag is measured on desktop');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the lifted chip follows the pointer, the target highlights, and the drop lands', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await signIn(page, account);
    await createTrip(page, 'Drag', '2027-04-01', '2027-04-05');
    await addEvent(page, '2027-04-01', 'Lunch', 'Walk');

    const chip = cellOf(page, '2027-04-01', 'Lunch').getByTestId('chip');
    const target = cellOf(page, '2027-04-04', 'Dinner');
    const from = await center(chip);
    const to = await center(target);

    await dragTo(page, from, to, async (step, point) => {
      if (step < 3) return;
      const overlay = page.locator('[data-drag-overlay]');
      await expect(overlay).toBeVisible();
      if (step === 3 || step === 6 || step === 9) {
        const c = await center(overlay);
        expect(Math.abs(c.x - point.x)).toBeLessThanOrEqual(8);
        expect(Math.abs(c.y - point.y)).toBeLessThanOrEqual(8);
      }
    });

    await expect(page.locator('[data-placeholder]')).toHaveCount(1);
    await expect(target).toHaveAttribute('data-drop-target', 'true');
    await page.mouse.up();

    await expect(target.getByText('Walk', { exact: true })).toBeVisible();
    await expect(cellOf(page, '2027-04-01', 'Lunch').getByText('Walk')).toHaveCount(0);
  });

  test('Escape cancels a drag and the chip stays where it was', async ({ page }) => {
    await signIn(page, account);
    await createTrip(page, 'Drag cancel', '2027-04-01', '2027-04-05');
    await addEvent(page, '2027-04-01', 'Lunch', 'Walk');

    const origin = cellOf(page, '2027-04-01', 'Lunch');
    const from = await center(origin.getByTestId('chip'));
    const to = await center(cellOf(page, '2027-04-03', 'Dinner'));
    await dragTo(page, from, to);
    await expect(page.locator('[data-drag-overlay]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.mouse.up();

    await expect(page.locator('[data-drag-overlay]')).toHaveCount(0);
    await expect(origin.getByText('Walk', { exact: true })).toBeVisible();
    await expect(cellOf(page, '2027-04-03', 'Dinner').getByText('Walk')).toHaveCount(0);
  });

  test('with reduced motion the lifted chip is not rotated or scaled', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await signIn(page, account);
    await createTrip(page, 'Drag reduced', '2027-04-01', '2027-04-05');
    await addEvent(page, '2027-04-01', 'Lunch', 'Walk');

    const from = await center(cellOf(page, '2027-04-01', 'Lunch').getByTestId('chip'));
    const to = await center(cellOf(page, '2027-04-02', 'Dinner'));
    await dragTo(page, from, to);
    const overlay = page.locator('[data-drag-overlay]');
    await expect(overlay).toBeVisible();
    const transform = await overlay.evaluate((el) => getComputedStyle(el).transform);
    expect(transform === 'none' || /^matrix\(1, 0, 0, 1,/.test(transform)).toBe(true);
    await page.mouse.up();
  });

  test('greyed cells (before arrival) show no Add and take no drop', async ({ page }) => {
    await signIn(page, account);
    await createTrip(page, 'Greyed', '2027-04-01', '2027-04-05');
    const tripId = page.url().split('/').pop()!;
    const { data: lunch, error: blockError } = await admin
      .from('blocks')
      .select('id')
      .eq('trip_id', tripId)
      .eq('name', 'Lunch')
      .single();
    if (blockError) throw blockError;
    const day = await admin
      .from('day_settings')
      .upsert({ trip_id: tripId, date: '2027-04-02', arrival_block_id: lunch.id });
    if (day.error) throw day.error;
    const item = await admin
      .from('items')
      .insert({ id: randomUUID(), trip_id: tripId, name: 'Early market', type: 'food' });
    if (item.error) throw item.error;
    await page.reload();

    const greyed = cellOf(page, '2027-04-02', 'Morning');
    await expect(
      greyed.getByRole('img', { name: 'Outside travel window (before arrival)' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Add event to Morning on 2027-04-02' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Add event to Lunch on 2027-04-02' }),
    ).toBeVisible();

    const panel = page.getByRole('complementary', { name: 'Activities and food' });
    const row = panel.getByText('Early market', { exact: true });
    await dragTo(page, await center(row), await center(greyed));
    await expect(greyed).not.toHaveAttribute('data-drop-target', 'true');
    await page.mouse.up();
    await expect(page.getByTestId('chip')).toHaveCount(0);

    // The same item still drops into the first open block that day.
    const open = cellOf(page, '2027-04-02', 'Lunch');
    await dragTo(page, await center(row), await center(open));
    await page.mouse.up();
    await expect(open.getByText('Early market', { exact: true })).toBeVisible();
  });

  test('a list item dragged from the panel shows the same lifted chip and lands in the cell', async ({
    page,
  }) => {
    await signIn(page, account);
    await createTrip(page, 'Drag panel', '2027-04-01', '2027-04-05');
    const tripId = page.url().split('/').pop()!;
    const { error } = await admin
      .from('items')
      .insert({ id: randomUUID(), trip_id: tripId, name: 'Ichiran Ramen', type: 'food' });
    if (error) throw error;
    await page.reload();

    const panel = page.getByRole('complementary', { name: 'Activities and food' });
    const row = panel.getByText('Ichiran Ramen', { exact: true });
    await expect(row).toBeVisible();
    const target = cellOf(page, '2027-04-02', 'Lunch');
    await dragTo(page, await center(row), await center(target));
    await expect(page.locator('[data-drag-overlay]')).toBeVisible();
    await expect(target).toHaveAttribute('data-drop-target', 'true');
    await page.mouse.up();

    await expect(target.getByText('Ichiran Ramen', { exact: true })).toBeVisible();
  });
});

test.describe('drag (touch)', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'long-press drag is measured on the phone project');

  test('a long press lifts the chip and moves it to another block', async ({ page }) => {
    test.setTimeout(60_000);
    await signIn(page, account);
    await createTrip(page, 'Drag touch', '2027-04-01', '2027-04-03');
    await goToDay(page, 1);
    await addEvent(page, '2027-04-01', 'Lunch', 'Walk');

    await cellOf(page, '2027-04-01', 'Breakfast').scrollIntoViewIfNeeded();
    const from = await center(cellOf(page, '2027-04-01', 'Lunch').getByTestId('chip'));
    const to = await center(cellOf(page, '2027-04-01', 'Breakfast'));
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', p?: { x: number; y: number }) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: p ? [{ x: p.x, y: p.y }] : [],
      });

    await touch('touchStart', from);
    await page.waitForTimeout(350);
    for (let i = 1; i <= STEPS; i++) {
      await touch('touchMove', {
        x: from.x + ((to.x - from.x) * i) / STEPS,
        y: from.y + ((to.y - from.y) * i) / STEPS,
      });
      await page.waitForTimeout(16);
    }
    await expect(page.locator('[data-drag-overlay]')).toBeVisible();
    await touch('touchEnd');

    await expect(
      cellOf(page, '2027-04-01', 'Breakfast').getByText('Walk', { exact: true }),
    ).toBeVisible();
  });
});
