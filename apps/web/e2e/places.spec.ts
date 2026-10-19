import { expect, test, type Page } from '@playwright/test';
import {
  admin,
  createAccount,
  createTrip,
  deleteAccount,
  goToDay,
  mockPlaces,
  openChipMenu,
  setItemPanel,
  setTripLocationDirect,
  signIn,
  type Account,
} from './helpers';

const NEW_YORK = { name: 'New York, USA', lat: 40.7128, lon: -74.006, tz: 'America/New_York' };

let account: Account;

test.beforeAll(async () => {
  account = await createAccount();
});
test.afterAll(async () => {
  await deleteAccount(account);
});

const tripIdOf = (url: string) => url.split('/').pop()!;

/** Creates a located trip and returns the item panel's add form, opened. */
async function openAddForm(page: Page, name: string) {
  await signIn(page, account);
  await createTrip(page, name, '2027-04-01', '2027-04-05');
  await setTripLocationDirect(tripIdOf(page.url()), NEW_YORK);
  await page.reload();
  await setItemPanel(page, true);
  const list = page.getByRole('complementary', { name: 'Activities and food' });
  await list.getByRole('button', { name: 'Add', exact: true }).click();
  return list;
}

test.describe('US1: place suggestions while typing', () => {
  test('quickstart 1-2: suggestions with attribution, pick and save a linked item', async ({
    page,
  }) => {
    const requests = await mockPlaces(page, 'ok');
    const list = await openAddForm(page, 'NYC US1 a');

    await list.getByLabel('Name', { exact: true }).fill('Chelsea Mar');
    await expect(page.getByRole('option', { name: /Chelsea Market/ })).toBeVisible();
    await expect(
      page.getByRole('listbox', { name: 'Place suggestions' }).getByRole('option'),
    ).toHaveCount(3);
    await expect(page.getByText('Powered by Google')).toBeVisible();

    await page.getByRole('option', { name: /Chelsea Market/ }).click();
    await expect(list.getByLabel('Name', { exact: true })).toHaveValue('Chelsea Market');
    await expect(list.getByLabel('Type')).toHaveValue('activity');
    await list.getByRole('button', { name: 'Add to list' }).click();

    const row = list.getByRole('listitem').filter({ hasText: 'Chelsea Market' });
    await expect(row).toContainText('75 9th Ave, New York');
    await expect(row.getByLabel('Linked place')).toBeVisible();

    // FR-014: only the typed text, a session token and the bias coordinates leave the app.
    const suggest = requests.filter((r) => r.action === 'suggest');
    expect(suggest.length).toBeGreaterThan(0);
    for (const body of suggest) {
      expect(Object.keys(body).sort()).toEqual(['action', 'input', 'near', 'sessionToken']);
      expect(body.near).toEqual({ lat: NEW_YORK.lat, lon: NEW_YORK.lon });
    }
    const details = requests.filter((r) => r.action === 'details');
    expect(details).toHaveLength(1);
    expect(Object.keys(details[0]).sort()).toEqual(['action', 'placeId', 'sessionToken']);
  });

  test('quickstart 3: picking a food place switches the type to Food', async ({ page }) => {
    await mockPlaces(page, 'ok');
    const list = await openAddForm(page, 'NYC US1 b');
    await list.getByLabel('Name', { exact: true }).fill('Los Tacos');
    await page.getByRole('option', { name: /Los Tacos No. 1/ }).click();
    await expect(list.getByLabel('Type')).toHaveValue('food');
  });

  test('quickstart 4: Enter without picking saves a plain item', async ({ page }) => {
    await mockPlaces(page, 'ok');
    const list = await openAddForm(page, 'NYC US1 c');
    await list.getByLabel('Name', { exact: true }).fill('Rest day');
    await page.keyboard.press('Enter');
    const row = list.getByRole('listitem').filter({ hasText: 'Rest day' });
    await expect(row).toBeVisible();
    await expect(row.getByLabel('Linked place')).toHaveCount(0);
  });

  test('quickstart 5: a grid cell lists places below the list items; pick links the chip', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'NYC US1 d', '2027-04-01', '2027-04-05');
    await setTripLocationDirect(tripIdOf(page.url()), NEW_YORK);
    await page.reload();
    await expect(page.getByRole('heading', { name: /NYC US1/ })).toBeVisible();
    await goToDay(page, 2);
    await page.getByRole('button', { name: 'Add event to Lunch on 2027-04-02' }).click();
    await page.getByRole('combobox', { name: /Add event to Lunch/ }).fill('taco');
    await page.getByRole('option', { name: /Los Tacos No. 1/ }).click();

    const chip = page.getByTestId('chip').filter({ hasText: 'Los Tacos No. 1' });
    await expect(chip).toBeVisible();
    await expect(chip.getByLabel('Linked place')).toBeVisible();
  });

  test('keyboard only: type, ArrowDown, Enter picks a place', async ({ page }) => {
    await mockPlaces(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'NYC US1 e', '2027-04-01', '2027-04-05');
    await goToDay(page, 2);
    await page.getByRole('button', { name: 'Add event to Lunch on 2027-04-02' }).click();
    await page.getByRole('combobox', { name: /Add event to Lunch/ }).fill('chel');
    await expect(page.getByRole('option', { name: /Chelsea Market/ })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(
      page.getByTestId('chip').filter({ hasText: 'Chelsea Market' }).getByLabel('Linked place'),
    ).toBeVisible();
  });

  test('quickstart 11: a failing function shows a note and plain saving still works', async ({
    page,
  }) => {
    await mockPlaces(page, 'fail');
    const list = await openAddForm(page, 'NYC US1 f');
    await list.getByLabel('Name', { exact: true }).fill('Sushi place');
    await expect(page.getByText('Place search unavailable')).toBeVisible();
    await list.getByRole('button', { name: 'Add to list' }).click();
    await expect(list.getByRole('listitem').filter({ hasText: 'Sushi place' })).toBeVisible();
  });

  test('no matches says "No places found"', async ({ page }) => {
    await mockPlaces(page, 'ok');
    const list = await openAddForm(page, 'NYC US1 g');
    await list.getByLabel('Name', { exact: true }).fill('zzzxqq');
    await expect(page.getByText('No places found')).toBeVisible();
  });
});

/** Captures window.open calls so map links can be asserted without leaving the page. */
async function captureOpens(page: Page) {
  await page.addInitScript(() => {
    const opened: string[][] = [];
    (window as unknown as { __opened: string[][] }).__opened = opened;
    window.open = (url?: string | URL, target?: string, features?: string) => {
      opened.push([String(url), target ?? '', features ?? '']);
      return null;
    };
  });
  return () => page.evaluate(() => (window as unknown as { __opened: string[][] }).__opened);
}

/** A located trip with one linked chip ("Chelsea Market" in Apr 2 Lunch), ready to use. */
async function tripWithLinkedChip(page: Page, name: string) {
  await signIn(page, account);
  await createTrip(page, name, '2027-04-01', '2027-04-05');
  await setTripLocationDirect(tripIdOf(page.url()), NEW_YORK);
  await page.reload();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await goToDay(page, 2);
  await page.getByRole('button', { name: 'Add event to Lunch on 2027-04-02' }).click();
  await page.getByRole('combobox', { name: /Add event to Lunch/ }).fill('chel');
  await page.getByRole('option', { name: /Chelsea Market/ }).click();
  await expect(page.getByTestId('chip').filter({ hasText: 'Chelsea Market' })).toBeVisible();
}

test.describe('US2: open a linked place in a map app', () => {
  test('quickstart 6-7: each app opens its link in a new tab; last choice is listed first', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    const opened = await captureOpens(page);
    await tripWithLinkedChip(page, 'NYC US2 a');

    await openChipMenu(page, 'Chelsea Market');
    await page.getByRole('menuitem', { name: 'Google Maps' }).click();
    await openChipMenu(page, 'Chelsea Market');
    await page.getByRole('menuitem', { name: 'Apple Maps' }).click();
    await openChipMenu(page, 'Chelsea Market');
    await page.getByRole('menuitem', { name: 'Waze' }).click();

    const calls = await opened();
    expect(calls.map((c) => c[1])).toEqual(['_blank', '_blank', '_blank']);
    expect(calls.map((c) => c[2])).toEqual(Array(3).fill('noopener,noreferrer'));
    expect(calls[0][0]).toContain(
      'https://www.google.com/maps/search/?api=1&query=Chelsea%20Market',
    );
    expect(calls[0][0]).toContain('query_place_id=test-chelsea');
    expect(calls[1][0]).toBe('https://maps.apple.com/?q=Chelsea%20Market&ll=40.7424,-74.0061');
    expect(calls[2][0]).toBe('https://waze.com/ul?ll=40.7424,-74.0061&navigate=yes');

    // Last choice (Waze) is now first.
    await openChipMenu(page, 'Chelsea Market');
    await expect(
      page
        .getByRole('menuitem')
        .filter({ hasText: /Maps$|Waze$/ })
        .first(),
    ).toHaveText('Waze');
  });

  test('quickstart 8: a copy of a linked item keeps the place and Open in maps works', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    const opened = await captureOpens(page);
    const list = await openAddForm(page, 'NYC US2 b');
    await list.getByLabel('Name', { exact: true }).fill('Chelsea Mar');
    await page.getByRole('option', { name: /Chelsea Market/ }).click();
    await list.getByRole('button', { name: 'Add to list' }).click();
    await list.getByRole('button', { name: 'Actions for Chelsea Market' }).click();
    await page.getByRole('menuitem', { name: 'Place Chelsea Market in a block' }).click();
    await page.getByRole('button', { name: 'Place', exact: true }).click();
    await setItemPanel(page, false);

    const chip = page.getByTestId('chip').filter({ hasText: 'Chelsea Market' });
    await expect(chip.getByLabel('Linked place')).toBeVisible();
    await openChipMenu(page, 'Chelsea Market');
    await page.getByRole('menuitem', { name: 'Waze' }).click();
    expect((await opened())[0][0]).toContain('https://waze.com/ul?ll=40.7424,-74.0061');
  });

  test('quickstart 11: Open in maps still works while place search is failing', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    const opened = await captureOpens(page);
    await tripWithLinkedChip(page, 'NYC US2 c');
    // Wait for the save to reach the database before reloading.
    await expect
      .poll(async () => {
        const { data } = await admin
          .from('placements')
          .select('id')
          .eq('trip_id', tripIdOf(page.url()));
        return data?.length;
      })
      .toBe(1);
    await page.unroute('**/functions/v1/places');
    await mockPlaces(page, 'fail');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'NYC US2 c' })).toBeVisible();
    await goToDay(page, 2);

    await openChipMenu(page, 'Chelsea Market');
    await page.getByRole('menuitem', { name: 'Google Maps' }).click();
    expect((await opened())[0][0]).toContain('query_place_id=test-chelsea');
  });
});

/** Adds a linked "Chelsea Market" item through the add form; returns the open item panel. */
async function addLinkedItem(page: Page, tripName: string) {
  const list = await openAddForm(page, tripName);
  await list.getByLabel('Name', { exact: true }).fill('Chelsea Mar');
  await page.getByRole('option', { name: /Chelsea Market/ }).click();
  await list.getByRole('button', { name: 'Add to list' }).click();
  await expect(
    list.getByRole('listitem').filter({ hasText: 'Chelsea Market' }).getByLabel('Linked place'),
  ).toBeVisible();
  return list;
}

test.describe('US3: link, change or remove a place', () => {
  test('quickstart 9: Remove place keeps the name; Undo restores the link', async ({ page }) => {
    await mockPlaces(page, 'ok');
    const list = await addLinkedItem(page, 'NYC US3 a');
    const row = () => list.getByRole('listitem').filter({ hasText: 'Chelsea Market' });

    await list.getByRole('button', { name: 'Actions for Chelsea Market' }).click();
    await page.getByRole('menuitem', { name: 'Edit Chelsea Market' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit item' });
    await dialog.getByRole('button', { name: 'Remove place' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(row()).toBeVisible();
    await expect(row().getByLabel('Linked place')).toHaveCount(0);
    await expect(row()).not.toContainText('75 9th Ave');

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(row().getByLabel('Linked place')).toBeVisible();
    await expect(row()).toContainText('75 9th Ave, New York');
  });

  test('quickstart 9: the row menu also removes the place', async ({ page }) => {
    await mockPlaces(page, 'ok');
    const list = await addLinkedItem(page, 'NYC US3 b');
    await list.getByRole('button', { name: 'Actions for Chelsea Market' }).click();
    await page.getByRole('menuitem', { name: 'Remove place from Chelsea Market' }).click();
    await expect(
      list.getByRole('listitem').filter({ hasText: 'Chelsea Market' }).getByLabel('Linked place'),
    ).toHaveCount(0);
  });

  test('quickstart 10: renaming keeps the place; Google Maps still opens Chelsea Market', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    const opened = await captureOpens(page);
    const list = await addLinkedItem(page, 'NYC US3 c');

    await list.getByRole('button', { name: 'Actions for Chelsea Market' }).click();
    await page.getByRole('menuitem', { name: 'Edit Chelsea Market' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit item' });
    await dialog.getByLabel('Name', { exact: true }).fill('Chelsea Market lunch');
    await dialog.getByRole('button', { name: 'Save' }).click();

    const row = list.getByRole('listitem').filter({ hasText: 'Chelsea Market lunch' });
    await expect(row.getByLabel('Linked place')).toBeVisible();
    await row.getByRole('button', { name: 'Actions for Chelsea Market lunch' }).click();
    await page.getByRole('menuitem', { name: 'Google Maps' }).click();
    const url = (await opened())[0][0];
    expect(url).toContain('query=Chelsea%20Market%2C');
    expect(url).toContain('query_place_id=test-chelsea');
  });

  test('editing a plain item and picking a place links it', async ({ page }) => {
    await mockPlaces(page, 'ok');
    const list = await openAddForm(page, 'NYC US3 d');
    await list.getByLabel('Name', { exact: true }).fill('Joes Pizza');
    await list.getByRole('button', { name: 'Add to list' }).click();
    const row = list.getByRole('listitem').filter({ hasText: 'Joes Pizza' });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: 'Actions for Joes Pizza' }).click();
    await page.getByRole('menuitem', { name: 'Edit Joes Pizza' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit item' });
    await dialog.getByLabel('Name', { exact: true }).fill('Los Tacos');
    await page.getByRole('option', { name: /Los Tacos No. 1/ }).click();
    await expect(dialog.getByLabel('Type')).toHaveValue('food');
    await dialog.getByRole('button', { name: 'Save' }).click();

    const linked = list.getByRole('listitem').filter({ hasText: 'Los Tacos No. 1' });
    await expect(linked.getByLabel('Linked place')).toBeVisible();
  });

  test('a placed chip can be edited to another place', async ({ page }) => {
    await mockPlaces(page, 'ok');
    await tripWithLinkedChip(page, 'NYC US3 e');
    await openChipMenu(page, 'Chelsea Market');
    await page.getByRole('menuitem', { name: 'Edit Chelsea Market' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit event' });
    await dialog.getByLabel('Name', { exact: true }).fill('taco');
    await page.getByRole('option', { name: /Los Tacos No. 1/ }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    const chip = page.getByTestId('chip').filter({ hasText: 'Los Tacos No. 1' });
    await expect(chip.getByLabel('Linked place')).toBeVisible();

    await openChipMenu(page, 'Los Tacos No. 1');
    await page.getByRole('menuitem', { name: 'Remove place from Los Tacos No. 1' }).click();
    await expect(chip.getByLabel('Linked place')).toHaveCount(0);
    await expect(chip).toBeVisible();
  });
});

test.describe('Cell suggestions float over the grid', () => {
  test('typing in a cell shows suggestions without making the cell taller', async ({ page }) => {
    await mockPlaces(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'NYC float', '2027-04-01', '2027-04-05');
    await setTripLocationDirect(tripIdOf(page.url()), NEW_YORK);
    await page.reload();

    const cell = page.getByTestId('cell:2027-04-01:Lunch');
    await page.getByRole('button', { name: 'Add event to Lunch on 2027-04-01' }).click();
    const input = page.getByRole('combobox', { name: /Add event to Lunch/ });
    const before = (await cell.boundingBox())!.height;

    await input.fill('chel');
    const options = page.getByRole('listbox', { name: 'Suggestions' });
    await expect(options.getByRole('option', { name: /Chelsea Market/ })).toBeVisible();
    expect((await cell.boundingBox())!.height).toBe(before);

    // The list is drawn over the cells below it, not under them.
    const box = (await options.boundingBox())!;
    const onTop = await page.evaluate(
      ([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('[role="listbox"]'),
      [box.x + box.width / 2, box.y + box.height / 2],
    );
    expect(onTop).toBe(true);

    // Picking a suggestion still works from the floating list.
    await options.getByRole('option', { name: /Chelsea Market/ }).click();
    await expect(cell.getByTestId('chip').filter({ hasText: 'Chelsea Market' })).toBeVisible();
  });
});

test.describe('012: details for linked places', () => {
  const infoRequests = (requests: { action: string }[]) =>
    requests.filter((r) => r.action === 'info');

  /** Adds "Chelsea Market" to My list from a suggestion and returns the list panel. */
  async function addChelsea(page: Page, tripName: string) {
    const list = await openAddForm(page, tripName);
    await list.getByLabel('Name', { exact: true }).fill('Chelsea Mar');
    await page.getByRole('option', { name: /Chelsea Market/ }).click();
    await list.getByRole('button', { name: 'Add to list' }).click();
    await expect(list.getByRole('listitem').filter({ hasText: 'Chelsea Market' })).toBeVisible();
    return list;
  }

  const dialogOf = (page: Page) => page.getByRole('dialog', { name: 'Chelsea Market' });

  test('quickstart 1-2, 5: a linked item opens its details, planned dates and a cached reopen', async ({
    page,
  }) => {
    const requests = await mockPlaces(page, 'ok');
    const list = await addChelsea(page, 'NYC 012 a');

    // Place it on two days from the item menu.
    for (const date of ['2027-04-02', '2027-04-04']) {
      await list.getByRole('button', { name: 'Actions for Chelsea Market' }).click();
      await page.getByRole('menuitem', { name: 'Place Chelsea Market in a block' }).click();
      const picker = page.getByRole('dialog', { name: 'Place “Chelsea Market”' });
      await picker.getByLabel('Day').selectOption(date);
      await picker.getByLabel('Time block').selectOption({ label: 'Lunch' });
      await picker.getByRole('button', { name: 'Place', exact: true }).click();
    }

    await list.getByRole('button', { name: 'Chelsea Market', exact: true }).click();
    const dialog = dialogOf(page);
    await expect(dialog).toBeVisible();
    // Stored facts at once; the rest follows.
    await expect(dialog).toContainText('75 9th Ave, New York');
    await expect(dialog.getByRole('button', { name: 'Open in maps' })).toBeVisible();
    await expect(dialog).toContainText('Market');
    await expect(dialog).toContainText('4.6 (31,204 reviews)');
    await expect(dialog.getByText(/^Open today 9:00\sAM–9:00\sPM$/)).toBeVisible();
    await expect(dialog.getByRole('img', { name: 'Chelsea Market' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Photo: Ann Lee' })).toBeVisible();
    const website = dialog.getByRole('link', { name: 'Website' });
    await expect(website).toHaveAttribute('href', 'https://chelseamarket.com/');
    await expect(website).toHaveAttribute('target', '_blank');
    await expect(website).toHaveAttribute('rel', 'noreferrer');
    await expect(dialog.getByText('Planned: Fri Apr 2 · Lunch')).toBeVisible();
    await expect(dialog.getByText('Planned: Sun Apr 4 · Lunch')).toBeVisible();

    const week = dialog.getByRole('button', { name: 'Show week' });
    await week.click();
    await expect(week).toHaveAttribute('aria-expanded', 'true');
    await expect(
      dialog.getByRole('list', { name: 'Opening hours' }).getByRole('listitem'),
    ).toHaveCount(7);
    await expect(dialog.getByText('Today', { exact: true })).toBeVisible();

    // Only the place id was sent, once.
    expect(infoRequests(requests)).toHaveLength(1);
    expect(Object.keys(infoRequests(requests)[0]).sort()).toEqual(['action', 'placeId']);

    // SC-003: reopening in the same session asks again for nothing.
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await list.getByRole('button', { name: 'Actions for Chelsea Market' }).click();
    await page.getByRole('menuitem', { name: 'View details' }).click();
    await expect(dialogOf(page).getByRole('link', { name: 'Website' })).toBeVisible();
    expect(infoRequests(requests)).toHaveLength(1);
  });

  test('quickstart 8: an unlinked item has no View details', async ({ page }) => {
    await mockPlaces(page, 'ok');
    const list = await openAddForm(page, 'NYC 012 b');
    await list.getByLabel('Name', { exact: true }).fill('Rest day');
    await page.keyboard.press('Enter');
    await expect(list.getByTestId('item-name').filter({ hasText: 'Rest day' })).toBeVisible();
    await expect(list.getByRole('button', { name: 'Rest day', exact: true })).toHaveCount(0);
    await list.getByRole('button', { name: 'Actions for Rest day' }).click();
    await expect(page.getByRole('menuitem', { name: 'View details' })).toHaveCount(0);
  });

  test('quickstart 3: View details on a linked event; clicking the event still edits', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'NYC 012 c', '2027-04-01', '2027-04-05');
    await setTripLocationDirect(tripIdOf(page.url()), NEW_YORK);
    await page.reload();
    await expect(page.getByRole('heading', { name: /NYC 012 c/ })).toBeVisible();
    await goToDay(page, 2);
    await page.getByRole('button', { name: 'Add event to Lunch on 2027-04-02' }).click();
    await page.getByRole('combobox', { name: /Add event to Lunch/ }).fill('chel');
    await page.getByRole('option', { name: /Chelsea Market/ }).click();
    const chip = page.getByTestId('chip').filter({ hasText: 'Chelsea Market' });
    await expect(chip).toBeVisible();

    await openChipMenu(page, 'Chelsea Market');
    await page.getByRole('menuitem', { name: 'View details' }).click();
    const dialog = dialogOf(page);
    await expect(dialog).toContainText('4.6 (31,204 reviews)');
    await expect(dialog.getByRole('button', { name: 'Open in maps' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Place in a block' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Edit event' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit event' })).toBeVisible();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await chip.getByText('Chelsea Market').click();
    await expect(page.getByRole('dialog', { name: 'Edit event' })).toBeVisible();
  });

  test('quickstart 6: with the details lookup failing, the stored facts and a note show', async ({
    page,
  }) => {
    await mockPlaces(page, 'ok', { info: 'fail' });
    const list = await addChelsea(page, 'NYC 012 d');
    await list.getByRole('button', { name: 'Chelsea Market', exact: true }).click();
    const dialog = dialogOf(page);
    await expect(dialog.getByText("More details aren't available right now.")).toBeVisible();
    await expect(dialog).toContainText('75 9th Ave, New York');
    await expect(dialog.getByRole('button', { name: 'Open in maps' })).toBeEnabled();
    await expect(dialog.getByRole('button', { name: 'Place in a block' })).toBeEnabled();
    await expect(dialog.getByTestId('place-photo-placeholder')).toBeVisible();

    // The trip stays editable.
    await dialog.getByRole('button', { name: 'Close' }).click();
    await list.getByRole('button', { name: 'Actions for Chelsea Market' }).click();
    await page.getByRole('menuitem', { name: 'Edit Chelsea Market' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit item' })).toBeVisible();
  });

  test('a place the provider no longer knows says so', async ({ page }) => {
    await mockPlaces(page, 'ok', { info: 'not-found' });
    const list = await addChelsea(page, 'NYC 012 e');
    await list.getByRole('button', { name: 'Chelsea Market', exact: true }).click();
    await expect(dialogOf(page).getByText('This place may no longer be listed.')).toBeVisible();
  });
});
