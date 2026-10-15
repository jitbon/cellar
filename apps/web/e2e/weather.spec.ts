import { expect, test } from '@playwright/test';
import {
  createAccount,
  createTrip,
  dateIn,
  deleteAccount,
  goToDay,
  mockOpenMeteo,
  setTripLocationDirect,
  signIn,
  type Account,
} from './helpers';

const KYOTO = { name: 'Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: 'Asia/Tokyo' };
// The mocked forecast starts "today" in Tokyo, so trips are dated relative to that.
const day = (offset: number) => dateIn(KYOTO.tz, offset);

let account: Account;

test.beforeAll(async () => {
  account = await createAccount();
});
test.afterAll(async () => {
  await deleteAccount(account);
});

const tripIdOf = (url: string) => url.split('/').pop()!;

test.describe('US1: weather icons on the grid', () => {
  test('cells show different icons for Morning and Afternoon', async ({ page }) => {
    await mockOpenMeteo(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Kyoto US1', day(0), day(2));
    await setTripLocationDirect(tripIdOf(page.url()), KYOTO);
    await page.reload();

    await expect(page.getByRole('button', { name: /^Morning weather: Clear/ })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Afternoon weather: Rain, 70% chance of rain/ }),
    ).toBeVisible();
  });

  test('a trip months away shows "Forecast from"', async ({ page }) => {
    await mockOpenMeteo(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Far away', day(90), day(92));
    await setTripLocationDirect(tripIdOf(page.url()), KYOTO);
    await page.reload();

    await expect(page.getByText(/^Forecast from /).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /weather:/ })).toHaveCount(0);
  });

  test('days beyond today + 15 show "Forecast from"', async ({ page }) => {
    await mockOpenMeteo(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Three weeks', day(0), day(20));
    await setTripLocationDirect(tripIdOf(page.url()), KYOTO);
    await page.reload();

    await goToDay(page, 1);
    await expect(page.getByRole('button', { name: /^Morning weather:/ }).first()).toBeVisible();
    await goToDay(page, 17);
    await expect(page.getByText(`Forecast from ${day(1)}`)).toBeVisible();
  });

  test('with the weather API down the banner shows and editing still works', async ({ page }) => {
    await mockOpenMeteo(page, 'fail');
    await signIn(page, account);
    await createTrip(page, 'Offline weather', day(0), day(2));
    await setTripLocationDirect(tripIdOf(page.url()), KYOTO);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.getByText('Weather unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: /weather:/ })).toHaveCount(0);

    await goToDay(page, 1);
    const date = day(0);
    await page.getByRole('button', { name: `Add event to Afternoon on ${date}` }).click();
    await page.getByRole('combobox', { name: /Add event to Afternoon/ }).fill('Walk');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(page.getByText('Walk', { exact: true })).toBeVisible();

    // drag the placement into Lunch
    const card = page.getByText('Walk', { exact: true });
    const lunch = page.getByRole('button', { name: `Add event to Lunch on ${date}` });
    const from = (await card.boundingBox())!;
    const to = (await lunch.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
    const after = (await page.getByText('Walk', { exact: true }).boundingBox())!;
    expect(after.y).toBeLessThan(from.y);
  });

  test('editing a block window changes it and undo restores it', async ({ page }) => {
    await mockOpenMeteo(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Window edit', day(0), day(1));

    await page.getByRole('button', { name: 'Edit time window for Lunch' }).click();
    await expect(page.getByLabel('Starts')).toHaveValue('12:00');
    await page.getByLabel('Starts').fill('13:00');
    await page.getByLabel('Ends').fill('15:00');
    await page.getByRole('button', { name: 'Save' }).click();

    await page.getByRole('button', { name: 'Edit time window for Lunch' }).click();
    await expect(page.getByLabel('Starts')).toHaveValue('13:00');
    await expect(page.getByLabel('Ends')).toHaveValue('15:00');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Undo' }).click();
    await page.getByRole('button', { name: 'Edit time window for Lunch' }).click();
    await expect(page.getByLabel('Starts')).toHaveValue('12:00');
    await expect(page.getByLabel('Ends')).toHaveValue('14:00');
  });
});
