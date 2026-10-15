import AxeBuilder from '@axe-core/playwright';
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

let account: Account;

test.beforeAll(async () => {
  account = await createAccount();
});
test.afterAll(async () => {
  await deleteAccount(account);
});

async function expectNoSeriousViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test('SC-006: create trip, add item, place item, edit block using only the keyboard', async ({
  page,
}) => {
  await signIn(page, account);

  // Create a trip without the mouse.
  await page.getByRole('button', { name: 'New trip' }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Name', { exact: true }).fill('Keys');
  await page.keyboard.press('Tab');
  await page.getByLabel('Start date').fill('2027-04-01');
  await page.getByLabel('End date').fill('2027-04-03');
  await page.getByLabel('End date').press('Enter');
  await expect(page.getByRole('heading', { name: 'Keys' })).toBeVisible();

  // Add a list item.
  const showList = page.getByRole('button', { name: 'Show list' });
  if (await showList.isVisible()) {
    await showList.focus();
    await page.keyboard.press('Enter');
  }
  await page.getByLabel('Name', { exact: true }).first().focus();
  await page.keyboard.type('Tsukiji Market');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Tsukiji Market')).toBeVisible();

  // Place it with the non-drag alternative.
  await page.getByRole('button', { name: 'Place Tsukiji Market in a block' }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Time block').selectOption({ label: 'Breakfast' });
  await page.getByRole('button', { name: 'Place', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/placed 1×/)).toBeVisible();

  // Rename a block.
  await goToDay(page, 1);
  await page.getByRole('button', { name: 'Rename Evening' }).focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Rename Evening').fill('Late evening');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Rename Late evening' })).toBeVisible();

  // No horizontal page scroll (the grid scrolls inside its own container).
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test('axe: sign-in, trips and planner have no serious or critical violations', async ({ page }) => {
  await page.goto('/signin');
  await expectNoSeriousViolations(page);

  await signIn(page, account);
  await expectNoSeriousViolations(page);

  await createTrip(page, 'Axe', '2027-04-01', '2027-04-02');
  await expectNoSeriousViolations(page);
});

test('axe: weather icons, an open popover and the location picker have no serious violations', async ({
  page,
}) => {
  await mockOpenMeteo(page, 'ok');
  await signIn(page, account);
  await createTrip(page, 'Axe weather', dateIn('Asia/Tokyo', 0), dateIn('Asia/Tokyo', 2));
  await setTripLocationDirect(page.url().split('/').pop()!, {
    name: 'Kyoto, Japan',
    lat: 35.0211,
    lon: 135.7538,
    tz: 'Asia/Tokyo',
  });
  await page.reload();
  await goToDay(page, 1);

  const icon = page.getByRole('button', { name: /^Afternoon weather:/ }).first();
  await expect(icon).toBeVisible();
  await expectNoSeriousViolations(page);

  await icon.focus();
  await expect(page.getByText('Weather data by Open-Meteo.com')).toBeVisible();
  await expectNoSeriousViolations(page);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^Change trip location/ }).click();
  await page.getByRole('combobox', { name: 'Search for a place' }).fill('Kyo');
  await expect(page.getByRole('option', { name: 'Kyoto, Japan' })).toBeVisible();
  await expectNoSeriousViolations(page);
});
