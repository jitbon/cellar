import { expect, test, type Page } from '@playwright/test';
import {
  createAccount,
  createTrip,
  deleteAccount,
  goToDay,
  mockPlaces,
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
