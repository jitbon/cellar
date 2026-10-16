import { expect, test, type Page } from '@playwright/test';
import {
  createAccount,
  createTrip,
  dateIn,
  deleteAccount,
  goToDay,
  mockOpenMeteo,
  openBlockMenu,
  openDayMenu,
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

    await expect(
      page.getByRole('button', { name: /^Morning weather: Clear/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Afternoon weather: Rain, 70% chance of rain/ }).first(),
    ).toBeVisible();
  });

  test('a trip months away shows "Forecast from"', async ({ page }) => {
    await mockOpenMeteo(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Far away', day(90), day(92));
    await setTripLocationDirect(tripIdOf(page.url()), KYOTO);
    await page.reload();

    await openDayMenu(page, day(90));
    await expect(page.getByRole('menuitem', { name: /^Forecast from / })).toBeVisible();
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
    await openDayMenu(page, day(16));
    await expect(page.getByRole('menuitem', { name: `Forecast from ${day(1)}` })).toBeVisible();
  });

  test('with the weather API down the banner shows and editing still works', async ({ page }) => {
    await mockOpenMeteo(page, 'fail');
    await signIn(page, account);
    await createTrip(page, 'Offline weather', day(0), day(2));
    await setTripLocationDirect(tripIdOf(page.url()), KYOTO);
    // Drop cached forecasts only; clearing everything would also sign the user out.
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('weather:')) localStorage.removeItem(key);
      }
    });
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
    await lunch.scrollIntoViewIfNeeded();
    const from = (await card.boundingBox())!;
    const to = (await lunch.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('[data-drag-overlay]')).toHaveCount(0);
    const after = (await page.getByText('Walk', { exact: true }).boundingBox())!;
    expect(after.y).toBeLessThan(from.y);
  });

  test('editing a block window changes it and undo restores it', async ({ page }) => {
    await mockOpenMeteo(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Window edit', day(0), day(1));

    await openBlockMenu(page, 'Lunch');
    await page.getByRole('menuitem', { name: 'Edit time window for Lunch' }).click();
    await expect(page.getByLabel('Starts')).toHaveValue('12:00');
    await page.getByLabel('Starts').fill('13:00');
    await page.getByLabel('Ends').fill('15:00');
    await page.getByRole('button', { name: 'Save' }).click();

    await openBlockMenu(page, 'Lunch');
    await page.getByRole('menuitem', { name: 'Edit time window for Lunch' }).click();
    await expect(page.getByLabel('Starts')).toHaveValue('13:00');
    await expect(page.getByLabel('Ends')).toHaveValue('15:00');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Undo' }).click();
    await openBlockMenu(page, 'Lunch');
    await page.getByRole('menuitem', { name: 'Edit time window for Lunch' }).click();
    await expect(page.getByLabel('Starts')).toHaveValue('12:00');
    await expect(page.getByLabel('Ends')).toHaveValue('14:00');
  });
});

async function openTripWithWeather(page: Page, name: string) {
  await mockOpenMeteo(page, 'ok');
  await signIn(page, account);
  await createTrip(page, name, day(0), day(2));
  await setTripLocationDirect(tripIdOf(page.url()), KYOTO);
  await page.reload();
  await goToDay(page, 1);
}

const afternoonIcon = (page: Page) =>
  page.getByRole('button', { name: /^Afternoon weather:/ }).first();

test.describe('Day weather summary (feature 009)', () => {
  test.use({ locale: 'en-US' });

  // Fixture: clear 06-13, rain 70% 14-17, partly cloudy after, every day.
  const phrase = (page: Page, date: string) =>
    page.getByRole('button', { name: `Weather for ${date}: Sunny, PM rain` });

  test('each in-range day header reads "Sunny, PM rain"; details on hover and focus', async ({
    page,
  }) => {
    await mockOpenMeteo(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Summary days', day(0), day(2));
    await setTripLocationDirect(tripIdOf(page.url()), KYOTO);
    await page.reload();

    await expect(phrase(page, day(0))).toBeVisible();
    await expect(phrase(page, day(0))).toHaveText('Sunny, PM rain');

    await phrase(page, day(0)).hover();
    await expect(page.getByText(/^High \d+°F · Low \d+°F$/)).toBeVisible();
    await expect(page.getByText('Rain up to 70%')).toBeVisible();
    await expect(page.getByText(/^Forecast as of /).first()).toBeVisible();
    await page.mouse.move(0, 0);

    await phrase(page, day(0)).focus();
    await expect(page.getByText('Rain up to 70%')).toBeVisible();
  });

  test('travel labels become icons beside the phrase; the header stays two lines', async ({
    page,
  }) => {
    await mockOpenMeteo(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Summary arrive', day(0), day(2));
    await setTripLocationDirect(tripIdOf(page.url()), KYOTO);
    await page.reload();

    await openDayMenu(page, day(0));
    await page.getByRole('menuitem', { name: `Set arrival and departure for ${day(0)}` }).click();
    await page.getByLabel('Arrival block').selectOption({ label: 'Lunch' });
    await page.getByRole('button', { name: 'Save' }).click();

    const header = page.getByTestId('day-header').first();
    await expect(header.getByRole('button', { name: /^Arrive · Lunch\./ })).toBeVisible();
    await expect(header.getByText('Arrive · Lunch', { exact: true })).toHaveCount(0);
    await expect(phrase(page, day(0))).toBeVisible();
    const lineHeight = await header.evaluate((el) =>
      parseFloat(getComputedStyle(el).lineHeight || '16'),
    );
    expect((await header.boundingBox())!.height).toBeLessThanOrEqual(lineHeight * 2 + 24);
  });

  test('no phrase for days beyond the forecast or trips without a location', async ({ page }) => {
    await mockOpenMeteo(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Summary far', day(40), day(42));
    await setTripLocationDirect(tripIdOf(page.url()), KYOTO);
    await page.reload();
    await expect(page.getByTestId('day-header').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Weather for / })).toHaveCount(0);

    await page.goto('/');
    await createTrip(page, 'Summary unlocated', day(0), day(2));
    await expect(page.getByTestId('day-header').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Weather for / })).toHaveCount(0);
  });
});

test.describe('US2: forecast details', () => {
  test.use({ locale: 'en-US' });

  test('hover shows details in Fahrenheit', async ({ page }) => {
    await openTripWithWeather(page, 'Hover details');
    await afternoonIcon(page).hover();
    await expect(page.getByText('70% chance of rain')).toBeVisible();
    await expect(page.getByText(/^\d+°F$/)).toBeVisible();
    await expect(page.getByText(/^Forecast as of /)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Weather data by Open-Meteo.com' })).toBeVisible();
  });

  test('keyboard focus shows details', async ({ page }) => {
    await openTripWithWeather(page, 'Focus details');
    await afternoonIcon(page).focus();
    await expect(page.getByText('70% chance of rain')).toBeVisible();
  });
});

test.describe('US2: Celsius locale', () => {
  test.use({ locale: 'en-GB' });

  test('temperature is shown in Celsius', async ({ page }) => {
    await openTripWithWeather(page, 'Celsius details');
    await afternoonIcon(page).hover();
    await expect(page.getByText(/^\d+°C$/)).toBeVisible();
  });
});

test.describe('US2: touch at 360px', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test('tap opens the popover and tapping elsewhere closes it', async ({ page }) => {
    await openTripWithWeather(page, 'Tap details');
    await afternoonIcon(page).tap();
    await expect(page.getByText('70% chance of rain')).toBeVisible();
    await page.getByRole('heading', { name: 'Tap details' }).tap();
    await expect(page.getByText('70% chance of rain')).toHaveCount(0);
  });
});

test.describe('US3: set where the trip is', () => {
  async function pickPlace(page: Page, opener: string | RegExp, query: string, option: string) {
    await page.getByRole('button', { name: opener }).click();
    await page.getByRole('combobox', { name: 'Search for a place' }).fill(query);
    await page.getByRole('option', { name: option }).click();
  }

  test('search, override a day, change the trip, clear, and undo', async ({ page }) => {
    test.setTimeout(90_000);
    const requests: URL[] = [];
    page.on('request', (r) => {
      if (r.url().includes('open-meteo.com')) requests.push(new URL(r.url()));
    });
    await mockOpenMeteo(page, 'ok');
    await signIn(page, account);
    await createTrip(page, 'Kyoto US3', day(0), day(5));

    // no location: prompt, no icons
    await expect(page.getByText('Add a location to see the weather')).toBeVisible();
    await expect(page.getByRole('button', { name: /weather:/ })).toHaveCount(0);

    // search and pick
    await pickPlace(page, 'Add a location', 'Kyo', 'Kyoto, Japan');
    await expect(page.getByRole('button', { name: /^Morning weather:/ }).first()).toBeVisible();

    // override day 4
    await goToDay(page, 4);
    await openDayMenu(page, day(3));
    await page.getByRole('menuitem', { name: `Set location for ${day(3)}` }).click();
    await page.getByRole('combobox', { name: 'Search for a place' }).fill('Osa');
    await page.getByRole('option', { name: 'Osaka, Japan' }).click();
    await expect(page.getByRole('button', { name: /^Osaka\./ })).toBeVisible();

    // changing the trip keeps the override
    await pickPlace(page, /^Change trip location/, 'Sap', 'Sapporo, Japan');
    await expect(
      page.getByRole('button', { name: 'Change trip location (Sapporo, Japan)' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^Osaka\./ })).toBeVisible();

    // use the trip location again
    await openDayMenu(page, day(3));
    await page.getByRole('menuitem', { name: `Use trip location on ${day(3)}` }).click();
    await expect(page.getByRole('button', { name: /^Osaka\./ })).toHaveCount(0);

    // three undos reverse the last three steps
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('button', { name: /^Osaka\./ })).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(
      page.getByRole('button', { name: 'Change trip location (Kyoto, Japan)' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('button', { name: /^Osaka\./ })).toHaveCount(0);

    // no match keeps the previous location
    await page.getByRole('button', { name: /^Change trip location/ }).click();
    await page.getByRole('combobox', { name: 'Search for a place' }).fill('zzzxqq');
    await expect(page.getByText('No matching place found')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(
      page.getByRole('button', { name: 'Change trip location (Kyoto, Japan)' }),
    ).toBeVisible();

    // FR-012: only coordinates or the search text leave the device
    const forecast = requests.filter((u) => u.hostname === 'api.open-meteo.com');
    const geocode = requests.filter((u) => u.hostname === 'geocoding-api.open-meteo.com');
    expect(forecast.length).toBeGreaterThan(0);
    expect(geocode.length).toBeGreaterThan(0);
    for (const u of forecast) {
      expect([...u.searchParams.keys()].sort()).toEqual(
        ['forecast_days', 'hourly', 'latitude', 'longitude', 'timezone'].sort(),
      );
    }
    for (const u of geocode) {
      expect([...u.searchParams.keys()].sort()).toEqual(['count', 'format', 'language', 'name']);
    }
  });
});
