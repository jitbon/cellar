import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  createAccount,
  createTrip,
  deleteAccount,
  goToDay,
  mockPlaces,
  setDayLocationDirect,
  setItemPanel,
  setTripLocationDirect,
  signIn,
  type Account,
} from './helpers';

const NEW_YORK = { name: 'New York, USA', lat: 40.7128, lon: -74.006, tz: 'America/New_York' };
const BOSTON = { name: 'Boston, USA', lat: 42.3601, lon: -71.0589, tz: 'America/New_York' };
const MET = 'The Metropolitan Museum of Art';
const KATZ = "Katz's Delicatessen";

let account: Account;

test.beforeAll(async () => {
  account = await createAccount();
});
test.afterAll(async () => {
  await deleteAccount(account);
});

const tripIdOf = (url: string) => url.split('/').pop()!;
const list = (page: Page) => page.getByRole('complementary', { name: 'Activities and food' });
const cellOf = (page: Page, date: string, block: string) =>
  page.getByTestId(`cell:${date}:${block}`);
const card = (page: Page, name: string) =>
  list(page).getByRole('listitem').filter({ hasText: name });

/** A signed-in trip (2027-04-01 to 04-05), optionally located, with the Popular tab open. */
async function openPopular(
  page: Page,
  name: string,
  opts: { located?: boolean; days?: Record<string, typeof BOSTON> } = {},
) {
  const { located = true, days = {} } = opts;
  await signIn(page, account);
  await createTrip(page, name, '2027-04-01', '2027-04-05');
  const id = tripIdOf(page.url());
  if (located) await setTripLocationDirect(id, NEW_YORK);
  for (const [date, loc] of Object.entries(days)) await setDayLocationDirect(id, date, loc);
  await page.reload();
  await setItemPanel(page, true);
  await list(page).getByRole('tab', { name: 'Popular' }).click();
}

/** Places a card with its menu: "Place in a block", then the day and block pickers. */
async function placeFromMenu(page: Page, name: string, date: string, block: string) {
  await list(page)
    .getByRole('button', { name: `Actions for ${name}` })
    .click();
  await page.getByRole('menuitem', { name: 'Place in a block' }).click();
  const dialog = page.getByRole('dialog', { name: `Place “${name}”` });
  await dialog.getByLabel('Day').selectOption(date);
  await dialog.getByLabel('Time block').selectOption({ label: block });
  await dialog.getByRole('button', { name: 'Place', exact: true }).click();
}

/** Closes the panel on phones (where it covers the grid) and shows the given day. */
async function showGrid(page: Page, day: number) {
  await setItemPanel(page, false);
  await goToDay(page, day);
}

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('US1: browse popular places and place them', () => {
  test('quickstart 1 and FR-012: both groups load with details, sending only the city', async ({
    page,
  }) => {
    const requests = await mockPlaces(page, 'ok');
    await openPopular(page, 'NYC pop a');

    await expect(list(page).getByRole('heading', { name: 'Things to do' })).toBeVisible();
    await expect(list(page).getByRole('heading', { name: 'Food', exact: true })).toBeVisible();
    const met = card(page, MET);
    await expect(met).toContainText('Art museum');
    await expect(met).toContainText('1000 5th Ave, New York');
    await expect(met).toContainText('4.8 (104,512 reviews)');
    await expect(card(page, 'Central Park')).toBeVisible();
    await expect(card(page, KATZ)).toContainText('4.5 (40,211 reviews)');
    await expect(list(page).getByText(/^Popular on Google · \d{1,2}:\d{2}/)).toBeVisible();

    const popular = requests.filter((r) => r.action === 'popular');
    expect(popular.map((r) => r.group).sort()).toEqual(['food', 'todo']);
    for (const body of popular) {
      expect(Object.keys(body).sort()).toEqual(['action', 'city', 'group', 'near']);
      expect(body.city).toBe(NEW_YORK.name);
      expect(body.near).toEqual({ lat: NEW_YORK.lat, lon: NEW_YORK.lon });
    }
  });

  test('quickstart 13: switching tabs back and forth does not repeat requests', async ({
    page,
  }) => {
    const requests = await mockPlaces(page, 'ok');
    await openPopular(page, 'NYC pop b');
    await expect(card(page, MET)).toBeVisible();
    const count = () => requests.filter((r) => r.action === 'popular').length;
    expect(count()).toBe(2);

    await list(page).getByRole('tab', { name: 'My list' }).click();
    await expect(list(page).getByText('No items.')).toBeVisible();
    await list(page).getByRole('tab', { name: 'Popular' }).click();
    await expect(card(page, MET)).toBeVisible();
    expect(count()).toBe(2);
  });

  test('quickstart 4: Place in a block creates a linked Food event and leaves the list alone', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    await openPopular(page, 'NYC pop c');
    await placeFromMenu(page, KATZ, '2027-04-03', 'Lunch');

    await showGrid(page, 3);
    const chip = cellOf(page, '2027-04-03', 'Lunch').getByTestId('chip');
    await expect(chip).toContainText(KATZ);
    await expect(chip.getByLabel('Linked place')).toBeVisible();

    await setItemPanel(page, true);
    await list(page).getByRole('tab', { name: 'My list' }).click();
    await expect(list(page).getByText('No items.')).toBeVisible();
  });

  test('quickstart 5 and 6: Add to my list saves a linked item; undo removes both steps', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    await openPopular(page, 'NYC pop d');
    await placeFromMenu(page, KATZ, '2027-04-03', 'Lunch');

    await setItemPanel(page, true);
    await list(page).getByRole('button', { name: "Actions for Joe's Pizza" }).click();
    await page.getByRole('menuitem', { name: 'Add to my list' }).click();
    await list(page).getByRole('tab', { name: 'My list' }).click();
    const row = list(page).getByRole('listitem').filter({ hasText: "Joe's Pizza" });
    await expect(row.getByLabel('Linked place')).toBeVisible();
    await expect(row).toContainText('7 Carmine St, New York');

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(list(page).getByText('No items.')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await showGrid(page, 3);
    await expect(cellOf(page, '2027-04-03', 'Lunch').getByTestId('chip')).toHaveCount(0);
  });

  test('quickstart 10: a trip with another city offers a selector and requests the new city', async ({
    page,
  }) => {
    const requests = await mockPlaces(page, 'ok');
    await openPopular(page, 'NYC pop e', { days: { '2027-04-03': BOSTON } });
    const select = list(page).getByLabel('City');
    await expect(select).toBeVisible();
    await expect(select.locator('option')).toHaveText([NEW_YORK.name, BOSTON.name]);
    await expect(card(page, MET)).toBeVisible();

    await select.selectOption({ label: BOSTON.name });
    await expect.poll(() => requests.filter((r) => r.city === BOSTON.name).length).toBe(2);
    for (const body of requests.filter((r) => r.city === BOSTON.name)) {
      expect(body.near).toEqual({ lat: BOSTON.lat, lon: BOSTON.lon });
    }
  });

  test('quickstart 11: a trip without a location asks for one and opens the location dialog', async ({
    page,
  }) => {
    const requests = await mockPlaces(page, 'ok');
    await openPopular(page, 'NYC pop f', { located: false });
    await expect(
      list(page).getByText('Set where this trip is to see popular places'),
    ).toBeVisible();
    await list(page).getByRole('button', { name: 'Set trip location' }).click();
    await expect(page.getByRole('dialog', { name: 'Trip location' })).toBeVisible();
    expect(requests.filter((r) => r.action === 'popular')).toHaveLength(0);
  });

  test('quickstart 12: when the service is unavailable the tab says so and the list works', async ({
    page,
  }) => {
    await mockPlaces(page, 'fail');
    await openPopular(page, 'NYC pop g');
    await expect(list(page).getByText('Popular places unavailable right now')).toBeVisible();

    await list(page).getByRole('tab', { name: 'My list' }).click();
    await list(page).getByRole('button', { name: 'Add', exact: true }).click();
    await list(page).getByLabel('Name', { exact: true }).fill('Rest day');
    await list(page).getByRole('button', { name: 'Add to list' }).click();
    await expect(list(page).getByText('Rest day')).toBeVisible();
  });

  test.describe('dragging (desktop)', () => {
    test.skip(({ hasTouch }) => hasTouch, 'mouse drag is exercised on desktop');
    test.use({ viewport: { width: 1440, height: 900 } });

    test('quickstart 2: dragging a card onto a cell creates a linked Activity event only', async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await mockPlaces(page, 'ok');
      await openPopular(page, 'NYC pop h');

      const from = await center(card(page, MET));
      const target = cellOf(page, '2027-04-01', 'Afternoon');
      const to = await center(target);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) {
        await page.mouse.move(
          from.x + ((to.x - from.x) * i) / 12,
          from.y + ((to.y - from.y) * i) / 12,
        );
      }
      await expect(page.locator('[data-drag-overlay]')).toContainText(MET);
      await page.mouse.up();

      const chip = target.getByTestId('chip');
      await expect(chip).toContainText(MET);
      await expect(chip.getByLabel('Linked place')).toBeVisible();

      await list(page).getByRole('tab', { name: 'My list' }).click();
      await expect(list(page).getByText('No items.')).toBeVisible();
    });
  });
});
