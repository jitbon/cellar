import { expect, test } from '@playwright/test';
import {
  createAccount,
  createTrip,
  deleteAccount,
  mockWikimedia,
  setTripLocationDirect,
  signIn,
  type Account,
} from './helpers';

const KYOTO = { name: 'Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: 'Asia/Tokyo' };

let account: Account;

test.beforeAll(async () => {
  account = await createAccount();
});
test.afterAll(async () => {
  await deleteAccount(account);
});

const tripIdOf = (url: string) => url.split('/').pop()!;

test('clicking the trip name renames it in place, with undo and Escape', async ({ page }) => {
  await signIn(page, account);
  await createTrip(page, 'Rename me', '2027-04-01', '2027-04-03');

  await page.getByRole('button', { name: 'Rename trip (Rename me)' }).click();
  const field = page.getByRole('textbox', { name: 'Trip name' });
  await expect(field).toBeFocused();
  await field.fill('Spring in Kyoto');
  await field.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Spring in Kyoto');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rename me');

  await page.getByRole('button', { name: 'Rename trip (Rename me)' }).click();
  await page.getByRole('textbox', { name: 'Trip name' }).fill('Not this');
  await page.getByRole('textbox', { name: 'Trip name' }).press('Escape');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rename me');

  // Saved: still renamed after a reload.
  await page.getByRole('button', { name: 'Rename trip (Rename me)' }).click();
  await page.getByRole('textbox', { name: 'Trip name' }).fill('Kept name');
  await page.getByRole('textbox', { name: 'Trip name' }).press('Enter');
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kept name');
});

test('the city shows once: on the banner, which changes the location', async ({ page }) => {
  await mockWikimedia(page, 'ok');
  await signIn(page, account);
  await createTrip(page, 'One city', '2027-04-01', '2027-04-03');
  await setTripLocationDirect(tripIdOf(page.url()), KYOTO);
  await page.reload();

  const banner = page.getByTestId('city-banner');
  const cityButton = banner.getByRole('button', { name: 'Change trip location (Kyoto, Japan)' });
  await expect(cityButton).toBeVisible();
  // The header chip is left out while the banner shows the city.
  await expect(
    page.getByRole('banner').getByRole('button', { name: /Change trip location/ }),
  ).toHaveCount(0);

  await cityButton.click();
  await expect(page.getByRole('dialog', { name: 'Trip location' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Hiding the banner brings the header chip back.
  await page.getByRole('button', { name: 'More trip actions' }).click();
  await page.getByRole('menuitem', { name: 'Hide city banner' }).click();
  await expect(banner).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Change trip location (Kyoto, Japan)' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'More trip actions' }).click();
  await page.getByRole('menuitem', { name: 'Show city banner' }).click();
});

test('a trip without a location keeps the "Add a location" chip', async ({ page }) => {
  await signIn(page, account);
  await createTrip(page, 'No city', '2027-04-01', '2027-04-03');
  await expect(page.getByRole('button', { name: 'Add a location' })).toBeVisible();
});
