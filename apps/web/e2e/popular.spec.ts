import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  createAccount,
  createTrip,
  deleteAccount,
  goToDay,
  mockOpenMeteo,
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
  opts: { located?: boolean; days?: Record<string, typeof BOSTON>; end?: string } = {},
) {
  const { located = true, days = {}, end = '2027-04-05' } = opts;
  await signIn(page, account);
  await createTrip(page, name, '2027-04-01', end);
  const id = tripIdOf(page.url());
  if (located) await setTripLocationDirect(id, NEW_YORK);
  for (const [date, loc] of Object.entries(days)) await setDayLocationDirect(id, date, loc);
  await page.reload();
  await setItemPanel(page, true);
  await list(page).getByRole('tab', { name: 'Popular' }).click();
}

/** Switches the Popular tab to its FOOD sub-tab. */
async function showFood(page: Page) {
  await list(page).getByRole('tab', { name: 'Food', exact: true }).click();
}

/** Places a card with its menu: "Place in a block", then the day and block pickers. */
async function placeFromMenu(page: Page, name: string, date: string, block: string) {
  await list(page)
    .getByRole('button', { name: `Actions for ${name}` })
    .click();
  await page.getByRole('menuitem', { name: 'Place in a block' }).click();
  await pickCell(page, name, date, block);
}

/** Fills the day and block pickers of the open "Place “name”" dialog and confirms. */
async function pickCell(page: Page, name: string, date: string, block: string) {
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

/** The struck-through name element of a card, if it has one. */
const struck = (row: Locator) => row.locator('[class*="placed"]');

/** Removes the event named `name` from the given cell via its chip menu. */
async function removeEvent(page: Page, date: string, block: string, name: string) {
  const cell = cellOf(page, date, block);
  await cell.getByRole('button', { name: `Actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: `Remove ${name}`, exact: true }).click();
  await expect(cell.getByTestId('chip')).toHaveCount(0);
}

test.describe('US2: placed cards are struck through', () => {
  test('dropping a card back over the panel places nothing, even over hidden grid columns', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    // Two weeks: on desktop the later day columns scroll off to the right, behind the panel;
    // on a phone the panel is a sheet over the grid.
    await openPopular(page, 'NYC pop drop', { end: '2027-04-14' });
    const met = card(page, MET);
    const box = (await met.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x, y + i * 15);
    await page.mouse.up();

    await expect(page.getByTestId('chip')).toHaveCount(0);
    await expect(struck(met)).toHaveCount(0);
    await expect(met).not.toContainText('placed');
  });

  test('quickstart 2 and 3: a placed popular card is struck through and can be placed again', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    await openPopular(page, 'NYC pop i');
    const met = card(page, MET);
    await expect(struck(met)).toHaveCount(0);

    await placeFromMenu(page, MET, '2027-04-01', 'Afternoon');
    await expect(struck(met)).toHaveCSS('text-decoration-line', 'line-through');
    await expect(met).toContainText(`${MET}, placed`);
    await expect(met).not.toContainText('×');

    // Still usable: a second event from the same struck-through card.
    await placeFromMenu(page, MET, '2027-04-02', 'Morning');
    await expect(struck(met)).toHaveCSS('text-decoration-line', 'line-through');

    await showGrid(page, 1);
    await expect(cellOf(page, '2027-04-01', 'Afternoon').getByTestId('chip')).toContainText(MET);
    await goToDay(page, 2);
    await expect(cellOf(page, '2027-04-02', 'Morning').getByTestId('chip')).toContainText(MET);
  });

  test('quickstart 7: a placed list item is struck through without a count, and clears when its events go', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'NYC pop j', '2027-04-01', '2027-04-05');
    await setItemPanel(page, true);
    await list(page).getByRole('button', { name: 'Add', exact: true }).click();
    await list(page).getByLabel('Name', { exact: true }).fill('Rest day');
    await list(page).getByRole('button', { name: 'Add to list' }).click();
    const row = list(page).getByRole('listitem').filter({ hasText: 'Rest day' });
    await expect(row).toBeVisible();
    await expect(struck(row)).toHaveCount(0);

    await row.getByRole('button', { name: 'Actions for Rest day' }).click();
    await page.getByRole('menuitem', { name: 'Place Rest day in a block' }).click();
    await pickCell(page, 'Rest day', '2027-04-01', 'Morning');
    await expect(struck(row)).toHaveCSS('text-decoration-line', 'line-through');
    await expect(row).toContainText('Rest day, placed');
    await expect(list(page).getByText(/placed \d+×/)).toHaveCount(0);

    // Place it a second time: still one strikethrough, no count.
    await row.getByRole('button', { name: 'Actions for Rest day' }).click();
    await page.getByRole('menuitem', { name: 'Place Rest day in a block' }).click();
    await pickCell(page, 'Rest day', '2027-04-02', 'Morning');
    await expect(list(page).getByText(/placed \d+×/)).toHaveCount(0);

    await showGrid(page, 1);
    await removeEvent(page, '2027-04-01', 'Morning', 'Rest day');
    await goToDay(page, 2);
    await removeEvent(page, '2027-04-02', 'Morning', 'Rest day');
    await setItemPanel(page, true);
    await expect(struck(row)).toHaveCount(0);
    await expect(row).not.toContainText('placed');
  });

  test.describe('dragging (desktop)', () => {
    test.skip(({ hasTouch }) => hasTouch, 'mouse drag is exercised on desktop');
    test.use({ viewport: { width: 1440, height: 900 } });

    test('quickstart 3: a struck-through card can be dragged again', async ({ page }) => {
      test.setTimeout(60_000);
      await mockPlaces(page, 'ok');
      await openPopular(page, 'NYC pop k');
      await placeFromMenu(page, MET, '2027-04-01', 'Afternoon');
      await expect(struck(card(page, MET))).toHaveCSS('text-decoration-line', 'line-through');

      const from = await center(card(page, MET));
      const target = cellOf(page, '2027-04-02', 'Morning');
      const to = await center(target);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) {
        await page.mouse.move(
          from.x + ((to.x - from.x) * i) / 12,
          from.y + ((to.y - from.y) * i) / 12,
        );
      }
      await page.mouse.up();
      await expect(target.getByTestId('chip')).toContainText(MET);
      await expect(struck(card(page, MET))).toHaveCSS('text-decoration-line', 'line-through');
    });
  });
});

test.describe('US1: browse popular places and place them', () => {
  test('each sub-tab fills half the bar and is underlined in its event color', async ({ page }) => {
    await mockPlaces(page, 'ok');
    await openPopular(page, 'NYC pop halves');
    const groups = list(page).getByRole('tablist', { name: 'Popular groups' });
    const todo = groups.getByRole('tab', { name: 'Things to do' });
    const food = groups.getByRole('tab', { name: 'Food', exact: true });
    const bar = (await groups.boundingBox())!;
    const todoBox = (await todo.boundingBox())!;
    expect(Math.abs(todoBox.width - bar.width / 2)).toBeLessThan(2);

    // Blank space just right of the middle (well away from the word FOOD) selects Food.
    await page.mouse.click(bar.x + bar.width * 0.55, bar.y + bar.height / 2);
    await expect(food).toHaveAttribute('aria-selected', 'true');
    await expect(card(page, KATZ)).toBeVisible();

    const underline = (tab: typeof todo) =>
      tab.evaluate((el) => getComputedStyle(el).borderBottomColor);
    const token = (name: string) =>
      page.evaluate((n) => {
        const probe = document.createElement('div');
        probe.style.color = `var(${n})`;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      }, name);
    expect(await underline(food)).toBe(await token('--color-food'));
    await todo.click();
    expect(await underline(todo)).toBe(await token('--color-activity'));
  });

  test('quickstart 1 and FR-012: both groups load with details, sending only the city', async ({
    page,
  }) => {
    const requests = await mockPlaces(page, 'ok');
    await openPopular(page, 'NYC pop a');

    const groups = list(page).getByRole('tablist', { name: 'Popular groups' });
    await expect(groups.getByRole('tab', { name: 'Things to do' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(groups.getByRole('tab', { name: 'Food', exact: true })).toBeVisible();
    const met = card(page, MET);
    await expect(met).toContainText('Art museum');
    await expect(met).toContainText('1000 5th Ave, New York');
    await expect(met).toContainText('4.8 (104,512 reviews)');
    await expect(card(page, 'Central Park')).toBeVisible();
    await expect(card(page, KATZ)).toHaveCount(0);
    await showFood(page);
    await expect(card(page, KATZ)).toContainText('4.5 (40,211 reviews)');
    await expect(card(page, MET)).toHaveCount(0);
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
    await showFood(page);
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
    await showFood(page);
    await placeFromMenu(page, KATZ, '2027-04-03', 'Lunch');

    await setItemPanel(page, true);
    await showFood(page);
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

  test('quickstart 10: the City dropdown switches trip cities and adds a searched city', async ({
    page,
  }) => {
    await mockOpenMeteo(page, 'ok');
    const requests = await mockPlaces(page, 'ok');
    await openPopular(page, 'NYC pop e', { days: { '2027-04-03': BOSTON } });
    const select = list(page).getByLabel('City');
    await expect(select.locator('option')).toHaveText([
      NEW_YORK.name,
      BOSTON.name,
      'Search for city…',
    ]);
    await expect(card(page, MET)).toBeVisible();

    await select.selectOption({ label: BOSTON.name });
    await expect.poll(() => requests.filter((r) => r.city === BOSTON.name).length).toBe(2);
    for (const body of requests.filter((r) => r.city === BOSTON.name)) {
      expect(body.near).toEqual({ lat: BOSTON.lat, lon: BOSTON.lon });
    }

    // "Search for city…" asks for any city and adds it to the dropdown.
    await select.selectOption({ label: 'Search for city…' });
    const dialog = page.getByRole('dialog', { name: 'Search for a city' });
    await dialog.getByRole('combobox').fill('Kyo');
    await dialog
      .getByRole('option', { name: /^Kyoto/ })
      .first()
      .click();
    await expect(dialog).toBeHidden();
    await expect(select.locator('option')).toHaveCount(4);
    await expect(select).toHaveValue(/35\.02/);
    await expect
      .poll(
        () =>
          requests.filter((r) => r.action === 'popular' && /^Kyoto/.test(String(r.city))).length,
      )
      .toBe(2);
  });

  test('quickstart 11: a trip without a location asks for one and opens the location dialog', async ({
    page,
  }) => {
    const requests = await mockPlaces(page, 'ok');
    await openPopular(page, 'NYC pop f', { located: false });
    await expect(
      list(page).getByText('Set where this trip is, or search for a city, to see popular places'),
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

test.describe('US3: the top line quick-adds and filters', () => {
  const line = (page: Page) => list(page).getByRole('combobox', { name: 'Add or filter items' });
  const rows = (page: Page) => list(page).getByRole('listitem');

  /** A located trip with the list open and two plain items already on it. */
  async function openList(page: Page, name: string) {
    await signIn(page, account);
    await createTrip(page, name, '2027-04-01', '2027-04-05');
    await setTripLocationDirect(tripIdOf(page.url()), NEW_YORK);
    await page.reload();
    await setItemPanel(page, true);
    for (const item of ['Ramen crawl', 'Museum day']) {
      await line(page).fill(item);
      await line(page).press('Enter');
      await expect(rows(page).filter({ hasText: item })).toBeVisible();
    }
  }

  test('double-clicking a list item opens its edit dialog', async ({ page }) => {
    await mockPlaces(page, 'fail');
    await openList(page, 'NYC dblclick');
    await rows(page).filter({ hasText: 'Museum day' }).getByText('Museum day').dblclick();
    const dialog = page.getByRole('dialog', { name: 'Edit item' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Museum day');
  });

  test('quickstart 8: typing narrows the list, Enter adds an Activity and clears the line', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    await openList(page, 'NYC quick a');
    await expect(rows(page)).toHaveCount(2);

    await line(page).fill('ram');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Ramen crawl');
    await line(page).press('Enter');

    await expect(line(page)).toHaveValue('');
    await expect(line(page)).toBeFocused();
    await expect(rows(page)).toHaveCount(3);
    const added = rows(page).filter({ hasText: /^ram/ });
    await expect(added).toHaveCount(1);
    await expect(added.getByLabel('Linked place')).toHaveCount(0);
  });

  test('quickstart 9: picking a suggestion adds a linked Food item', async ({ page }) => {
    const requests = await mockPlaces(page, 'ok');
    await openList(page, 'NYC quick b');
    await line(page).fill('Katz');
    await page.getByRole('option', { name: /Katz's Delicatessen/ }).click();

    const row = rows(page).filter({ hasText: KATZ });
    await expect(row.getByLabel('Linked place')).toBeVisible();
    await expect(row).toContainText('205 E Houston St, New York');
    await expect(line(page)).toHaveValue('');
    await list(page).getByRole('button', { name: 'Food', exact: true }).click();
    await expect(row).toBeVisible();
    expect(requests.some((r) => r.action === 'details' && r.placeId === 'test-katz')).toBe(true);
  });

  test('Enter on an empty line adds nothing', async ({ page }) => {
    await mockPlaces(page, 'ok');
    await openList(page, 'NYC quick c');
    await line(page).press('Enter');
    await expect(rows(page)).toHaveCount(2);
  });
});
