import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  createAccount,
  createTrip,
  dateIn,
  deleteAccount,
  mockOpenMeteo,
  mockWikimedia,
  mockPlaces,
  mockProviderReturn,
  mockProviders,
  goToDay,
  openDayMenu,
  setItemPanel,
  setTripLocationDirect,
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

const DESKTOP = { width: 1440, height: 900 };

async function fullyInViewport(page: Page, locator: Locator) {
  const view = page.viewportSize()!;
  const count = await locator.count();
  let inside = 0;
  for (let i = 0; i < count; i++) {
    const box = await locator.nth(i).boundingBox();
    if (
      box &&
      box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= view.width &&
      box.y + box.height <= view.height
    ) {
      inside++;
    }
  }
  return inside;
}

test.describe('layout (desktop)', () => {
  test.skip(({ hasTouch }) => hasTouch, 'measured on desktop');
  test.use({ viewport: DESKTOP });

  test('SC-001: 5 days and 8 blocks fit with the panel closed; 4 days with it open', async ({
    page,
  }) => {
    await signIn(page, account);
    await createTrip(page, 'Layout', '2027-04-01', '2027-04-05');

    await setItemPanel(page, false);
    expect(await fullyInViewport(page, page.getByTestId('day-header'))).toBeGreaterThanOrEqual(5);
    expect(
      await fullyInViewport(page, page.getByRole('button', { name: /^Rename / })),
    ).toBeGreaterThanOrEqual(8);

    await setItemPanel(page, true);
    expect(await fullyInViewport(page, page.getByTestId('day-header'))).toBeGreaterThanOrEqual(4);
  });

  test('FR-012: the panel toggle widens the grid and the choice survives a reload', async ({
    page,
  }) => {
    await signIn(page, account);
    await createTrip(page, 'Panel', '2027-04-01', '2027-04-05');
    const panel = page.getByRole('complementary', { name: 'Activities and food' });
    const gridWidth = async () =>
      (await page.getByTestId('day-header').first().boundingBox())!.width;

    await setItemPanel(page, true);
    await expect(panel).toBeVisible();
    const withPanel = await gridWidth();
    await setItemPanel(page, false);
    await expect(panel).toHaveCount(0);
    expect(await gridWidth()).toBeGreaterThan(withPanel);

    await page.reload();
    await expect(panel).toHaveCount(0);
    await setItemPanel(page, true);
    await page.reload();
    await expect(panel).toBeVisible();
  });

  test('block names stay on one line and show no time range', async ({ page }) => {
    await signIn(page, account);
    await createTrip(page, 'Labels', '2027-04-01', '2027-04-03');
    const labels = page.getByRole('button', { name: /^Rename / });
    const count = await labels.count();
    expect(count).toBeGreaterThanOrEqual(10);
    for (let i = 0; i < count; i++) {
      const el = labels.nth(i);
      expect(await el.evaluate((n) => n.scrollHeight <= n.clientHeight + 1)).toBe(true);
      expect(await el.innerText()).not.toMatch(/\d{1,2}\s*[–-]\s*\d{1,2}/);
    }
  });

  test('SC-002: chips are one line, columns keep their width, rows grow to 3 lines then "+N more"', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await signIn(page, account);
    await createTrip(page, 'Chips', '2027-04-01', '2027-04-05');
    await setItemPanel(page, false);

    const headers = page.getByTestId('day-header');
    const widths = async () => {
      const out: number[] = [];
      for (let i = 0; i < (await headers.count()); i++) {
        out.push(Math.round((await headers.nth(i).boundingBox())!.width));
      }
      return out;
    };
    const before = await widths();
    const cell = page.getByTestId('cell:2027-04-02:Afternoon');
    const heightFor = (lines: number) => 24 * lines + 4 * (lines - 1) + 12;
    const expectedLines = [1, 2, 3, 3, 3];

    for (let n = 1; n <= 5; n++) {
      await page.getByRole('button', { name: 'Add event to Afternoon on 2027-04-02' }).click();
      await page
        .getByRole('combobox', { name: /Add event to Afternoon/ })
        .fill(`Event number ${n}`);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');

      const box = (await cell.boundingBox())!;
      expect(Math.abs(box.height - heightFor(expectedLines[n - 1]!))).toBeLessThanOrEqual(4);
      expect(await widths()).toEqual(before);
    }

    await expect(
      page.getByRole('button', { name: 'Show all 5 events in Afternoon on 2027-04-02' }),
    ).toHaveText('+3 more');
    const chips = cell.getByTestId('chip');
    await expect(chips).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      expect((await chips.nth(i).boundingBox())!.height).toBeLessThanOrEqual(32);
    }
  });

  test('SC-004: day headers are at most two lines, the trip header is one row tall, no text links', async ({
    page,
  }) => {
    await mockOpenMeteo(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Headers', '2027-04-01', '2027-04-05');
    await setItemPanel(page, false);

    await openDayMenu(page, '2027-04-01');
    await page.getByRole('menuitem', { name: 'Set arrival and departure for 2027-04-01' }).click();
    await page.getByLabel('Arrival block').selectOption({ label: 'Lunch' });
    await page.getByRole('button', { name: 'Save' }).click();
    await openDayMenu(page, '2027-04-03');
    await page.getByRole('menuitem', { name: 'Set location for 2027-04-03' }).click();
    await page.getByRole('combobox', { name: 'Search for a place' }).fill('Osa');
    await page.getByRole('option', { name: 'Osaka, Japan' }).click();
    await expect(page.getByText('Arrive · Lunch')).toBeVisible();
    await expect(page.getByText('Osaka', { exact: true })).toBeVisible();

    const headers = page.getByTestId('day-header');
    for (let i = 0; i < (await headers.count()); i++) {
      expect((await headers.nth(i).boundingBox())!.height).toBeLessThanOrEqual(48);
    }
    const rowHeight = (await page.getByTestId('cell:2027-04-02:Morning').boundingBox())!.height;
    const bar = (await page.locator('header').first().boundingBox())!;
    expect(bar.height).toBeLessThanOrEqual(rowHeight + 12);

    await expect(page.getByText('Travel…')).toHaveCount(0);
    await expect(page.getByText('Location…')).toHaveCount(0);
  });
});

test.describe('layout (360 px)', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'measured on the phone project');

  test('the Places group fits without horizontal scroll in a cell and in the item form', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Phone places', '2027-04-01', '2027-04-03');
    const pageScrolls = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );

    await setItemPanel(page, false);
    await goToDay(page, 1);
    await page.getByRole('button', { name: 'Add event to Lunch on 2027-04-01' }).click();
    await page.getByRole('combobox', { name: /Add event to Lunch/ }).fill('chel');
    const group = page.getByRole('group', { name: 'Places' });
    await expect(group).toBeVisible();
    const box = (await group.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    expect(await pageScrolls()).toBe(false);
    await page.keyboard.press('Escape');

    await setItemPanel(page, true);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Chelsea Mar');
    const formGroup = page.getByRole('group', { name: 'Places' });
    await expect(formGroup).toBeVisible();
    const formBox = (await formGroup.boundingBox())!;
    expect(formBox.x).toBeGreaterThanOrEqual(0);
    expect(formBox.x + formBox.width).toBeLessThanOrEqual(360);
    expect(await pageScrolls()).toBe(false);
  });

  test('quickstart 14: the tabs and Popular cards fit without horizontal scroll', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Phone popular', '2027-04-01', '2027-04-03');
    await setTripLocationDirect(page.url().split('/').pop()!, {
      name: 'New York, USA',
      lat: 40.7128,
      lon: -74.006,
      tz: 'America/New_York',
    });
    await page.reload();
    await setItemPanel(page, true);
    const list = page.getByRole('complementary', { name: 'Activities and food' });
    const inside = async (locator: Locator) => {
      const box = (await locator.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
    };
    const pageScrolls = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );

    await inside(list.getByRole('tablist', { name: 'List views' }));
    await list.getByRole('tab', { name: 'Popular' }).click();
    await expect(list.getByText('The Metropolitan Museum of Art')).toBeVisible();
    const groups = list.getByRole('tablist', { name: 'Popular groups' });
    await inside(groups);
    const cards = list.getByRole('listitem');
    expect(await cards.count()).toBe(12);
    for (let i = 0; i < 12; i++) await inside(cards.nth(i));
    expect(await pageScrolls()).toBe(false);

    await groups.getByRole('tab', { name: 'Food', exact: true }).click();
    await expect(list.getByText("Katz's Delicatessen")).toBeVisible();
    expect(await cards.count()).toBe(3);
    for (let i = 0; i < 3; i++) await inside(cards.nth(i));
    expect(await pageScrolls()).toBe(false);
    await groups.getByRole('tab', { name: 'Things to do' }).click();

    await list.getByRole('button', { name: 'Actions for The Metropolitan Museum of Art' }).click();
    await inside(page.getByRole('menu'));
    expect(await pageScrolls()).toBe(false);
  });
});

test.describe('photos layout (360 px)', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'measured on the phone project');

  test('the banner uses the small height; trip cards and the detail view fit without horizontal scroll', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await mockPlaces(page, 'ok');
    await mockWikimedia(page, 'ok');
    await signIn(page, account);
    await createTrip(
      page,
      'Layout photos',
      dateIn('America/New_York', -1),
      dateIn('America/New_York', 3),
    );
    await setTripLocationDirect(page.url().split('/').pop()!, {
      name: 'New York, USA',
      lat: 40.7128,
      lon: -74.006,
      tz: 'America/New_York',
    });
    const pageScrolls = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );

    await page.reload();
    const banner = page.getByTestId('city-banner');
    await expect(banner.locator('img')).toBeVisible();
    expect((await banner.boundingBox())!.height).toBeCloseTo(56, 0);
    const box = (await banner.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360);
    expect(await pageScrolls()).toBe(false);

    await setItemPanel(page, true);
    const list = page.getByRole('complementary', { name: 'Activities and food' });
    await list.getByRole('tab', { name: 'Popular' }).click();
    await list.getByRole('button', { name: 'The Metropolitan Museum of Art', exact: true }).click();
    const detail = page.getByRole('dialog', { name: 'The Metropolitan Museum of Art' });
    await expect(detail.getByRole('img')).toBeVisible();
    const dialogBox = (await detail.boundingBox())!;
    expect(dialogBox.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(360);
    expect(await pageScrolls()).toBe(false);
    await detail.getByRole('button', { name: 'Close' }).click();

    await page.goto('/');
    const card = page.getByRole('listitem').filter({ hasText: 'Layout photos' });
    await expect(card.getByRole('img', { name: 'New York, USA' })).toBeVisible();
    const cardBox = (await card.boundingBox())!;
    expect(cardBox.x).toBeGreaterThanOrEqual(0);
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(360);
    expect(await pageScrolls()).toBe(false);

    await card.getByRole('button', { name: 'Actions for Layout photos' }).click();
    await page.getByRole('menuitem', { name: 'Change cover photo' }).click();
    const picker = page.getByRole('dialog', { name: 'Change cover photo' });
    await expect(picker.getByRole('button', { name: /^Photo \d by / })).toHaveCount(6);
    const pickerBox = (await picker.boundingBox())!;
    expect(pickerBox.x + pickerBox.width).toBeLessThanOrEqual(360);
    expect(await pageScrolls()).toBe(false);
  });
});

test.describe('photos layout (all viewports)', () => {
  test('US2/AC5: the trip page has no vertical page scroll with the city banner shown or hidden', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    // Short enough that the grid is taller than the space under the header and banner.
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 400 });
    await mockWikimedia(page, 'ok');
    await mockOpenMeteo(page, 'ok');
    await signIn(page, account);
    await createTrip(
      page,
      'Banner height',
      dateIn('America/New_York', -1),
      dateIn('America/New_York', 3),
    );
    await setTripLocationDirect(page.url().split('/').pop()!, {
      name: 'New York, USA',
      lat: 40.7128,
      lon: -74.006,
      tz: 'America/New_York',
    });
    await page.reload();
    await setItemPanel(page, false);
    const fits = () =>
      page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight);

    await expect(page.getByTestId('city-banner').locator('img')).toBeVisible();
    expect(await fits()).toBe(true);

    await page.getByRole('button', { name: 'More trip actions' }).click();
    await page.getByRole('menuitem', { name: 'Hide city banner' }).click();
    await expect(page.getByTestId('city-banner')).toHaveCount(0);
    expect(await fits()).toBe(true);
  });
});

test.describe('provider buttons (360 px)', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'measured on the phone project');

  test('fit without horizontal scroll, are at least 44 px tall and work from the keyboard', async ({
    page,
  }) => {
    await mockProviders(page, ['google', 'apple', 'facebook']);
    await mockProviderReturn(page, 'google', { error: 'access_denied' });
    for (const path of ['/signin', '/signup']) {
      await page.goto(path);
      const buttons = page.getByRole('button', { name: /^Continue with/ });
      await expect(buttons).toHaveCount(3);
      for (let i = 0; i < 3; i++) {
        const box = (await buttons.nth(i).boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(360);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }

    // The first stop is the Google button; Enter starts the sign-in.
    await page.goto('/signin');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Sign-in with Google was cancelled.')).toBeVisible();
  });
});
